import { formatISO } from "date-fns";
import type { LlmProviderConfig } from "@prisma/client";
import { decryptString } from "@/lib/security/crypto";
import { createGeoProvider } from "@/lib/geo";
import { buildHeuristicItinerary, scoreCandidates } from "@/lib/planning/heuristics";
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from "@/lib/planning/prompt";
import { mergeIssues, repairItinerary, validateItinerary } from "@/lib/planning/validator";
import { requestStructuredJson } from "@/lib/llm/openai-compatible";
import type { Itinerary, ItineraryDay, ItineraryItem, PlanningIssue, TripRequest } from "@/lib/schemas/trip";
import { itinerarySchema } from "@/lib/schemas/trip";

type ProgressEvent = {
  stage: "candidates" | "preplan" | "llm" | "validate" | "persist";
  message: string;
};

type PlanTripOptions = {
  request: TripRequest;
  llmConfig?: LlmProviderConfig | null;
  onProgress?: (event: ProgressEvent) => void;
};

type ReplanOptions = {
  request: TripRequest;
  currentItinerary: Itinerary;
  llmConfig?: LlmProviderConfig | null;
  onProgress?: (event: ProgressEvent) => void;
};

function emit(onProgress: PlanTripOptions["onProgress"], event: ProgressEvent) {
  onProgress?.(event);
}

function buildMetadata(geoProviderName: string, usedModel?: string, betaNotice?: string) {
  return {
    geoProvider: geoProviderName,
    usedModel,
    betaNotice,
    createdAt: formatISO(new Date())
  };
}

function derivePlanningIssues(request: TripRequest, geoProviderName: string) {
  const issues: PlanningIssue[] = [];
  const isDomestic = /[\u4e00-\u9fa5]/.test(request.destination);

  if (!isDomestic) {
    issues.push({
      severity: "warning",
      code: "intl-beta",
      message: "International destinations currently use a lighter geo fallback path.",
      source: geoProviderName,
      suggestion: "Review travel times and opening hours manually before departing."
    });
  }

  return issues;
}

async function buildModelItinerary(
  request: TripRequest,
  llmConfig: LlmProviderConfig,
  heuristic: Itinerary
) {
  const parsed = await requestStructuredJson({
    baseUrl: llmConfig.baseUrl,
    apiKey: decryptString(llmConfig.apiKeyEncrypted),
    model: llmConfig.model,
    temperature: llmConfig.temperature,
    schema: itinerarySchema,
    systemPrompt: buildPlannerSystemPrompt(),
    userPrompt: `${buildPlannerUserPrompt(request, scoreCandidates(request, heuristic.days.flatMap((day) => day.items.map((item) => item.poi))))}\nUse this heuristic baseline if needed:\n${JSON.stringify(heuristic, null, 2)}`
  });

  return itinerarySchema.parse({
    ...parsed,
    metadata: {
      ...parsed.metadata,
      createdAt: formatISO(new Date())
    }
  });
}

export async function planTrip(options: PlanTripOptions) {
  const geoProvider = createGeoProvider();
  const baseIssues = derivePlanningIssues(options.request, geoProvider.name);

  emit(options.onProgress, {
    stage: "candidates",
    message: "Collecting candidate places from the geo provider."
  });

  const candidates = await geoProvider.searchPois({
    destination: options.request.destination,
    tags: [...options.request.interests, "美食", "城市地标"],
    radius: 12000
  });

  const ranked = scoreCandidates(options.request, candidates);
  const chosen = ranked.slice(0, Math.max(options.request.days * 6, 8)).map((entry) => entry.poi);

  emit(options.onProgress, {
    stage: "preplan",
    message: "Building a rule-based draft with travel time heuristics."
  });

  const travelMatrix = await geoProvider.getTravelMatrix(chosen, "driving");
  const heuristic = buildHeuristicItinerary(
    options.request,
    ranked,
    travelMatrix,
    buildMetadata(
      geoProvider.name,
      options.llmConfig?.model,
      baseIssues.find((issue) => issue.code === "intl-beta")?.message
    ),
    baseIssues
  );

  let itinerary = heuristic;

  if (options.llmConfig?.enabled) {
    emit(options.onProgress, {
      stage: "llm",
      message: "Handing the draft to the configured LLM for itinerary refinement."
    });

    try {
      itinerary = await buildModelItinerary(options.request, options.llmConfig, heuristic);
    } catch (error) {
      baseIssues.push({
        severity: "warning",
        code: "llm-fallback",
        message:
          error instanceof Error
            ? `LLM refinement failed, so the heuristic itinerary was kept: ${error.message}`
            : "LLM refinement failed, so the heuristic itinerary was kept.",
        source: "llm-planner",
        suggestion: "Check your model endpoint configuration and try re-planning."
      });
      itinerary = {
        ...heuristic,
        issues: [...heuristic.issues, ...baseIssues]
      };
    }
  }

  emit(options.onProgress, {
    stage: "validate",
    message: "Validating overlaps, duplicates, and long transfers."
  });

  const repaired = repairItinerary(itinerary);
  const mergedIssues = mergeIssues(itinerary.issues, repaired.issues);
  return {
    itinerary: {
      ...repaired.itinerary,
      issues: mergedIssues
    },
    issues: mergedIssues
  };
}

function collectLockedItems(itinerary: Itinerary) {
  const lockedByDate = new Map<string, ItineraryItem[]>();

  for (const day of itinerary.days) {
    lockedByDate.set(
      day.date,
      day.items.filter((item) => item.locked)
    );
  }

  return lockedByDate;
}

function mergeLockedItems(fresh: Itinerary, lockedItemsByDate: Map<string, ItineraryItem[]>) {
  const days: ItineraryDay[] = fresh.days.map((day) => {
    const lockedItems = lockedItemsByDate.get(day.date) ?? [];
    const lockedPoiIds = new Set(lockedItems.map((item) => item.poi.id));
    const items = [...lockedItems, ...day.items.filter((item) => !lockedPoiIds.has(item.poi.id))].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    return {
      ...day,
      items
    };
  });

  const merged = itinerarySchema.parse({
    ...fresh,
    days
  });

  const repaired = repairItinerary(merged);
  const mergedIssues = mergeIssues(merged.issues, repaired.issues);
  return {
    itinerary: {
      ...repaired.itinerary,
      issues: mergedIssues
    },
    issues: mergedIssues
  };
}

export async function replanUnlockedSegments(options: ReplanOptions) {
  const fresh = await planTrip({
    request: options.request,
    llmConfig: options.llmConfig,
    onProgress: options.onProgress
  });

  return mergeLockedItems(fresh.itinerary, collectLockedItems(options.currentItinerary));
}

export function validateEditedItinerary(itinerary: Itinerary) {
  return validateItinerary(itinerary);
}
