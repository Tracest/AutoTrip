import { formatISO } from "date-fns";
import { z } from "zod";
import type { LlmProviderConfig } from "@prisma/client";
import { decryptString } from "@/lib/security/crypto";
import { createGeoProvider } from "@/lib/geo";
import { buildHeuristicItinerary, scoreCandidates } from "@/lib/planning/heuristics";
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildPoiResearchSystemPrompt,
  buildPoiResearchUserPrompt
} from "@/lib/planning/prompt";
import { mergeIssues, repairItinerary, validateItinerary } from "@/lib/planning/validator";
import { requestStructuredJson } from "@/lib/llm/openai-compatible";
import type { Itinerary, ItineraryDay, ItineraryItem, PlanningIssue, Poi, TripRequest } from "@/lib/schemas/trip";
import { addMinutesToTime } from "@/lib/utils/time";
import { itinerarySchema, relaxedItinerarySchema, relaxedPoiSchema } from "@/lib/schemas/trip";

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

const llmPoiCandidatesSchema = z.object({
  pois: z.array(relaxedPoiSchema).min(1).max(40)
});

type RelaxedPoi = z.infer<typeof relaxedPoiSchema>;
type RelaxedItinerary = z.infer<typeof relaxedItinerarySchema>;

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/|,.;:()（）【】\[\]]+/g, "");
}

function createSlug(value: string) {
  return normalizeKey(value)
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "poi";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function createSyntheticCoordinates(seed: string, index: number) {
  const hash = hashString(`${seed}:${index}`);
  const isDomestic = /[\u4e00-\u9fa5]/.test(seed);
  const baseLat = isDomestic ? 30 : 40;
  const baseLng = isDomestic ? 112 : 2;
  const latOffset = ((hash % 1000) - 500) / 10_000;
  const lngOffset = (((hash >> 8) % 1000) - 500) / 10_000;
  return {
    latitude: Number((baseLat + latOffset + index * 0.003).toFixed(6)),
    longitude: Number((baseLng + lngOffset + index * 0.003).toFixed(6))
  };
}

function createCandidateLookup(candidates: Poi[]) {
  const byId = new Map<string, Poi>();
  const byName = new Map<string, Poi>();

  for (const candidate of candidates) {
    byId.set(candidate.id, candidate);
    byName.set(normalizeKey(candidate.name), candidate);
  }

  return {
    byId,
    byName
  };
}

function toPoiFromRelaxed(
  relaxedPoi: RelaxedPoi,
  request: TripRequest,
  index: number,
  candidateLookup?: ReturnType<typeof createCandidateLookup>
) {
  const matchedCandidate =
    (relaxedPoi.id ? candidateLookup?.byId.get(relaxedPoi.id) : undefined) ??
    candidateLookup?.byName.get(normalizeKey(relaxedPoi.name));

  const synthetic = createSyntheticCoordinates(`${request.destination}:${relaxedPoi.name}`, index);
  const id = relaxedPoi.id ?? matchedCandidate?.id ?? `${createSlug(request.destination)}-${createSlug(relaxedPoi.name)}-${index + 1}`;

  return {
    id,
    name: relaxedPoi.name,
    address: relaxedPoi.address ?? matchedCandidate?.address ?? `${request.destination}${relaxedPoi.name}`,
    city: relaxedPoi.city ?? matchedCandidate?.city ?? request.destination,
    country: relaxedPoi.country ?? matchedCandidate?.country ?? (/[\u4e00-\u9fa5]/.test(request.destination) ? "CN" : "INTL"),
    categories:
      relaxedPoi.categories?.filter(Boolean) ??
      matchedCandidate?.categories ??
      request.interests.slice(0, 2),
    latitude: relaxedPoi.latitude ?? matchedCandidate?.latitude ?? synthetic.latitude,
    longitude: relaxedPoi.longitude ?? matchedCandidate?.longitude ?? synthetic.longitude,
    recommendedDurationMinutes:
      relaxedPoi.recommendedDurationMinutes ?? matchedCandidate?.recommendedDurationMinutes ?? 90,
    openingHoursText: relaxedPoi.openingHoursText ?? matchedCandidate?.openingHoursText
  } satisfies Poi;
}

function cleanLlmFallbackPois(pois: Poi[]) {
  const seen = new Set<string>();
  return pois.filter((poi) => {
    const placeholderPattern = /推荐点|示例地址|spot\s*\d+|poi\s*\d+/i;
    const key = poi.name.trim().toLowerCase();
    if (!key || placeholderPattern.test(poi.name) || placeholderPattern.test(poi.address)) {
      return false;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

async function buildLlmCandidatePois(request: TripRequest, llmConfig: LlmProviderConfig, desiredCount: number) {
  const parsed = await requestStructuredJson({
    baseUrl: llmConfig.baseUrl,
    apiKey: decryptString(llmConfig.apiKeyEncrypted),
    model: llmConfig.model,
    temperature: Math.min(llmConfig.temperature, 0.4),
    schema: llmPoiCandidatesSchema,
    systemPrompt: buildPoiResearchSystemPrompt(),
    userPrompt: buildPoiResearchUserPrompt(request, desiredCount),
    timeoutMs: 60_000,
    retries: 1
  });

  const normalized = parsed.pois.map((poi: RelaxedPoi, index: number) =>
    toPoiFromRelaxed(poi, request, index)
  );
  return cleanLlmFallbackPois(normalized);
}

function normalizeLlmItinerary(
  parsed: RelaxedItinerary,
  request: TripRequest,
  heuristic: Itinerary,
  metadata: Itinerary["metadata"],
  carriedIssues: PlanningIssue[]
) {
  const heuristicCandidates = heuristic.days.flatMap((day) => day.items.map((item) => item.poi));
  const candidateLookup = createCandidateLookup(heuristicCandidates);

  const days: ItineraryDay[] = heuristic.days.map((heuristicDay, dayIndex) => {
    const parsedDay = parsed.days[dayIndex];
    if (!parsedDay || parsedDay.items.length === 0) {
      return heuristicDay;
    }

    const items: ItineraryItem[] = parsedDay.items.map((parsedItem, itemIndex) => {
      const heuristicItem = heuristicDay.items[itemIndex];
      const poi = toPoiFromRelaxed(parsedItem.poi, request, dayIndex * 10 + itemIndex, candidateLookup);
      const startTime = parsedItem.startTime ?? heuristicItem?.startTime ?? "09:00";
      const durationMinutes =
        parsedItem.durationMinutes ??
        heuristicItem?.durationMinutes ??
        poi.recommendedDurationMinutes ??
        90;
      const endTime = parsedItem.endTime ?? addMinutesToTime(startTime, durationMinutes);

      return {
        id: parsedItem.id ?? heuristicItem?.id ?? `${heuristicDay.date}-${poi.id}`,
        poi,
        category: parsedItem.category ?? poi.categories[0] ?? heuristicItem?.category ?? "景点",
        startTime,
        endTime,
        durationMinutes,
        travelMinutesFromPrevious:
          parsedItem.travelMinutesFromPrevious ?? heuristicItem?.travelMinutesFromPrevious ?? 0,
        notes: parsedItem.notes ?? heuristicItem?.notes,
        locked: parsedItem.locked ?? false
      };
    });

    return {
      date: parsedDay.date ?? heuristicDay.date,
      title: parsedDay.title ?? heuristicDay.title,
      totalTravelMinutes:
        parsedDay.totalTravelMinutes ??
        items.reduce((sum, item) => sum + item.travelMinutesFromPrevious, 0),
      intensityScore: parsedDay.intensityScore ?? heuristicDay.intensityScore,
      items
    };
  });

  return itinerarySchema.parse({
    ...heuristic,
    request,
    days,
    issues: mergeIssues(carriedIssues, parsed.issues ?? []),
    metadata: {
      ...metadata,
      createdAt: formatISO(new Date())
    }
  });
}

async function buildModelItinerary(
  request: TripRequest,
  llmConfig: LlmProviderConfig,
  heuristic: Itinerary,
  metadata: Itinerary["metadata"],
  carriedIssues: PlanningIssue[]
) {
  const parsed = await requestStructuredJson({
    baseUrl: llmConfig.baseUrl,
    apiKey: decryptString(llmConfig.apiKeyEncrypted),
    model: llmConfig.model,
    temperature: llmConfig.temperature,
    schema: relaxedItinerarySchema,
    systemPrompt: buildPlannerSystemPrompt(),
    userPrompt: `${buildPlannerUserPrompt(request, scoreCandidates(request, heuristic.days.flatMap((day) => day.items.map((item) => item.poi))))}\nUse this heuristic baseline if needed:\n${JSON.stringify(heuristic, null, 2)}`
  });

  return normalizeLlmItinerary(parsed, request, heuristic, metadata, carriedIssues);
}

export async function planTrip(options: PlanTripOptions) {
  const geoProvider = createGeoProvider();
  const baseIssues = derivePlanningIssues(options.request, geoProvider.name);
  const desiredCandidateCount = Math.max(options.request.days * 6, 8);

  emit(options.onProgress, {
    stage: "candidates",
    message: "Collecting candidate places from the geo provider."
  });

  let candidates = await geoProvider.searchPois({
    destination: options.request.destination,
    tags: [...options.request.interests, "美食", "城市地标"],
    radius: 12000
  });
  let candidateSource = geoProvider.name;

  if (geoProvider.name === "mock") {
    if (options.llmConfig?.enabled) {
      emit(options.onProgress, {
        stage: "candidates",
        message: "Map data is not configured, so the LLM is assembling real POI candidates."
      });

      try {
        const llmCandidates = await buildLlmCandidatePois(
          options.request,
          options.llmConfig,
          desiredCandidateCount
        );

        if (llmCandidates.length > 0) {
          candidates = llmCandidates;
          candidateSource = "llm-fallback";
          baseIssues.push({
            severity: "warning",
            code: "llm-poi-fallback",
            message: "Map data is unavailable, so POI candidates were generated by the LLM.",
            source: "candidate-builder",
            suggestion: "Verify names, locations, and opening hours manually, or configure AMAP_API_KEY for higher confidence."
          });
        } else {
          baseIssues.push({
            severity: "warning",
            code: "mock-geo-provider",
            message: "No map provider is configured, and LLM POI fallback returned nothing useful.",
            source: "candidate-builder",
            suggestion: "Configure AMAP_API_KEY to replace placeholder POIs with real map data."
          });
        }
      } catch (error) {
        baseIssues.push({
          severity: "warning",
          code: "mock-geo-provider",
          message:
            error instanceof Error
              ? `No map provider is configured, so placeholder POIs were used after LLM fallback failed: ${error.message}`
              : "No map provider is configured, so placeholder POIs were used.",
          source: "candidate-builder",
          suggestion: "Configure AMAP_API_KEY to replace placeholder POIs with real map data."
        });
      }
    } else {
      baseIssues.push({
        severity: "warning",
        code: "mock-geo-provider",
        message: "No map provider is configured, so placeholder POIs were used.",
        source: "candidate-builder",
        suggestion: "Configure AMAP_API_KEY and enable LLM refinement for much better itinerary quality."
      });
    }
  }

  const ranked = scoreCandidates(options.request, candidates);
  const chosen = ranked.slice(0, desiredCandidateCount).map((entry) => entry.poi);

  const metadata = {
    ...buildMetadata(
      geoProvider.name,
      options.llmConfig?.model,
      baseIssues.find((issue) => issue.code === "intl-beta")?.message
    ),
    candidateSource,
    candidateCount: chosen.length
  };

  emit(options.onProgress, {
    stage: "preplan",
    message: "Building a rule-based draft with travel time heuristics."
  });

  const travelMatrix = await geoProvider.getTravelMatrix(chosen, "driving");
  const heuristic = buildHeuristicItinerary(
    options.request,
    ranked,
    travelMatrix,
    metadata,
    baseIssues
  );

  let itinerary = heuristic;

  if (options.llmConfig?.enabled) {
    emit(options.onProgress, {
      stage: "llm",
      message: "Handing the draft to the configured LLM for itinerary refinement."
    });

    try {
      itinerary = await buildModelItinerary(
        options.request,
        options.llmConfig,
        heuristic,
        metadata,
        baseIssues
      );
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
