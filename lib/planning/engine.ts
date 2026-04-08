import { formatISO } from "date-fns";
import { z } from "zod";
import type { LlmProviderConfig } from "@prisma/client";
import { decryptString } from "@/lib/security/crypto";
import { createGeoProvider } from "@/lib/geo";
import {
  buildHeuristicItinerary,
  localizeCategoryLabel,
  scoreCandidates
} from "@/lib/planning/heuristics";
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildPoiVerifierSystemPrompt,
  buildPoiVerifierUserPrompt,
  buildPoiResearchSystemPrompt,
  buildPoiResearchUserPrompt
} from "@/lib/planning/prompt";
import {
  containsCjk,
  getDefaultCountryForDestination,
  isLikelyDomesticDestination,
  shouldPreferChineseOutput
} from "@/lib/planning/destination";
import { mergeIssues, repairItinerary, validateItinerary } from "@/lib/planning/validator";
import { requestStructuredJson } from "@/lib/llm/openai-compatible";
import { isLikelyOllamaBaseUrl } from "@/lib/llm/provider-utils";
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

type RelaxedPoi = z.infer<typeof relaxedPoiSchema>;
type RelaxedItinerary = z.infer<typeof relaxedItinerarySchema>;

const genericPoiNamePattern =
  /^(food|foods|history|historic|nightview|nightviews|museum|museums|park|parks|restaurant|restaurants|landmark|landmarks|shopping|mall|nightmarket|nightmarkets)$/i;
const accommodationPattern = /(hotel|hostel|resort|apartment|inn|guesthouse|酒店|宾馆|民宿|客栈)/i;
const vagueAddressPattern = /(various locations|multiple locations|city center|downtown|across the city)/i;
const areaLikePoiNamePattern =
  /\b(road|street|district|area|town|lane|financial district|concession|neighbou?rhood|central area|downtown)\b/i;

function findArrayCandidate(payload: Record<string, unknown>, preferredKeys: string[]) {
  for (const key of preferredKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return Object.values(payload).find(Array.isArray);
}

function normalizeRelaxedPoiValue(value: unknown) {
  if (typeof value === "string") {
    return {
      name: value
    };
  }

  return value;
}

function normalizePoiResearchPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return {
      pois: payload.map(normalizeRelaxedPoiValue)
    };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = findArrayCandidate(record, ["pois", "items", "candidates", "places", "recommendations", "data"]);

    if (Array.isArray(candidates)) {
      return {
        pois: candidates.map(normalizeRelaxedPoiValue)
      };
    }
  }

  return payload;
}

function normalizeItineraryPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return {
      days: payload
    };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (record.itinerary && typeof record.itinerary === "object") {
      return normalizeItineraryPayload(record.itinerary);
    }

    if (record.plan && typeof record.plan === "object") {
      return normalizeItineraryPayload(record.plan);
    }

    if (record.schedule && typeof record.schedule === "object") {
      return normalizeItineraryPayload(record.schedule);
    }

    const days = findArrayCandidate(record, ["days", "itinerary", "schedule"]);
    if (Array.isArray(days)) {
      return {
        ...record,
        days
      };
    }
  }

  return payload;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/|,.;:()（）【】\[\]]+/g, "");
}

function categoryMatchesInterest(category: string, interest: string) {
  const normalizedCategory = normalizeKey(category);
  const normalizedInterest = normalizeKey(interest);

  if (!normalizedCategory || !normalizedInterest) {
    return false;
  }

  if (
    normalizedCategory.includes(normalizedInterest) ||
    normalizedInterest.includes(normalizedCategory)
  ) {
    return true;
  }

  const synonymGroups = [
    ["历史", ["历史", "博物馆", "建筑", "人文"]],
    ["美食", ["美食", "小吃", "点心", "餐饮"]],
    ["夜景", ["夜景", "观景", "地标", "建筑"]],
    ["自然", ["自然", "公园", "园林"]],
    ["亲子", ["亲子", "乐园"]],
    ["拍照", ["拍照", "观景", "地标"]]
  ] as const;

  for (const [interestKey, aliases] of synonymGroups) {
    const normalizedAliases = aliases.map((alias) => normalizeKey(alias));
    const interestMatchesGroup =
      normalizeKey(interestKey) === normalizedInterest || normalizedAliases.includes(normalizedInterest);
    const categoryMatchesGroup = normalizedAliases.includes(normalizedCategory);

    if (interestMatchesGroup && categoryMatchesGroup) {
      return true;
    }
  }

  return false;
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

function createSyntheticCoordinates(seed: string, destination: string, index: number) {
  const hash = hashString(`${seed}:${index}`);
  const isDomestic = isLikelyDomesticDestination(destination);
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

  const synthetic = createSyntheticCoordinates(
    `${request.destination}:${relaxedPoi.name}`,
    request.destination,
    index
  );
  const id = relaxedPoi.id ?? matchedCandidate?.id ?? `${createSlug(request.destination)}-${createSlug(relaxedPoi.name)}-${index + 1}`;

  return {
    id,
    name: relaxedPoi.name,
    address: relaxedPoi.address ?? matchedCandidate?.address ?? `${request.destination}${relaxedPoi.name}`,
    city: relaxedPoi.city ?? matchedCandidate?.city ?? request.destination,
    country:
      relaxedPoi.country ??
      matchedCandidate?.country ??
      getDefaultCountryForDestination(request.destination),
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

function cleanLlmFallbackPois(
  request: TripRequest,
  pois: Poi[],
  options?: {
    requireLocalizedDisplayName?: boolean;
  }
) {
  const seen = new Set<string>();
  const mustVisitHints = request.mustVisit.map((item) => normalizeKey(item));
  const hotelAreaHint = normalizeKey(request.hotelArea ?? "");
  const destinationCountry = getDefaultCountryForDestination(request.destination);
  const prefersChineseOutput = shouldPreferChineseOutput(request.destination);
  const requireLocalizedDisplayName = options?.requireLocalizedDisplayName ?? true;

  return pois.filter((poi) => {
    const placeholderPattern = /推荐点|示例地址|spot\s*\d+|poi\s*\d+/i;
    const key = poi.name.trim().toLowerCase();
    const normalizedName = normalizeKey(poi.name);
    const normalizedAddress = normalizeKey(poi.address);
    const normalizedCountry = poi.country.trim().toUpperCase();
    const explicitlyRequestedPoi =
      mustVisitHints.some((hint) => normalizedName.includes(hint) || normalizedAddress.includes(hint));
    const mentionsAccommodation =
      accommodationPattern.test(poi.name) || accommodationPattern.test(poi.address);
    const explicitlyRequestedAccommodation =
      explicitlyRequestedPoi ||
      (hotelAreaHint.length > 0 && normalizedAddress.includes(hotelAreaHint));
    const hasExplicitCountryMismatch =
      normalizedCountry.length > 0 &&
      ((destinationCountry === "CN" && normalizedCountry !== "CN") ||
        (destinationCountry === "INTL" && normalizedCountry === "CN"));
    const isAreaLikeName = areaLikePoiNamePattern.test(poi.name.trim());
    const lacksChineseDisplayName =
      requireLocalizedDisplayName &&
      prefersChineseOutput &&
      !containsCjk(poi.name) &&
      !explicitlyRequestedPoi;

    if (
      !key ||
      placeholderPattern.test(poi.name) ||
      placeholderPattern.test(poi.address) ||
      genericPoiNamePattern.test(poi.name.trim()) ||
      isAreaLikeName ||
      vagueAddressPattern.test(poi.address) ||
      lacksChineseDisplayName ||
      hasExplicitCountryMismatch ||
      (mentionsAccommodation && !explicitlyRequestedAccommodation)
    ) {
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
  const isDomestic = isLikelyDomesticDestination(request.destination);

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

function serializePoiForVerifier(poi: Poi) {
  return {
    id: poi.id,
    name: poi.name,
    address: poi.address,
    city: poi.city,
    country: poi.country,
    categories: poi.categories,
    recommendedDurationMinutes: poi.recommendedDurationMinutes
  };
}

function selectDiverseCandidates(
  request: TripRequest,
  ranked: Array<{
    poi: Poi;
    score: number;
  }>,
  desiredCount: number
) {
  const selected: Poi[] = [];
  const seen = new Set<string>();
  const rankedBuckets = request.interests.map((interest) => ({
    interest,
    index: 0,
    entries: ranked.filter((entry) =>
      entry.poi.categories.some((category) => {
        const normalizedCategory = normalizeKey(category);
        const normalizedInterest = normalizeKey(interest);

        return (
          normalizedCategory.includes(normalizedInterest) ||
          normalizedInterest.includes(normalizedCategory)
        );
      })
    )
  }));

  const pushCandidate = (poi: Poi) => {
    if (selected.length >= desiredCount || seen.has(poi.id)) {
      return;
    }

    seen.add(poi.id);
    selected.push(poi);
  };

  while (selected.length < desiredCount) {
    let madeProgress = false;

    for (const bucket of rankedBuckets) {
      while (bucket.index < bucket.entries.length && seen.has(bucket.entries[bucket.index].poi.id)) {
        bucket.index += 1;
      }

      const match = bucket.entries[bucket.index];
      if (!match) {
        continue;
      }

      pushCandidate(match.poi);
      bucket.index += 1;
      madeProgress = true;

      if (selected.length >= desiredCount) {
        break;
      }
    }

    if (!madeProgress) {
      break;
    }
  }

  for (const entry of ranked) {
    pushCandidate(entry.poi);
  }

  return selected;
}

function assertCandidateCoverage(request: TripRequest, chosen: Poi[]) {
  const missingInterests = request.interests.filter(
    (interest) =>
      !chosen.some((poi) => poi.categories.some((category) => categoryMatchesInterest(category, interest)))
  );

  if (missingInterests.length > 0) {
    throw new Error(
      localizeForRequest(
        request,
        `Collected candidates did not cover these requested interests: ${missingInterests.join(", ")}.`,
        `当前收集到的候选点无法覆盖这些兴趣：${missingInterests.join("、")}。`
      )
    );
  }

  if (chosen.length < Math.min(6, request.days * 2)) {
    throw new Error(
      localizeForRequest(
        request,
        "Not enough high-confidence candidates were found for a usable itinerary.",
        "高置信候选点数量不足，暂时无法生成可用行程。"
      )
    );
  }
}

function localizeForRequest(request: TripRequest, english: string, chinese: string) {
  return shouldPreferChineseOutput(request.destination) ? chinese : english;
}

function summarizeLlmPlanningError(request: TripRequest, error: unknown) {
  if (!(error instanceof Error)) {
    return localizeForRequest(
      request,
      "The model did not return a usable itinerary structure.",
      "模型没有返回可用的行程结构。"
    );
  }

  const raw = error.message.trim();
  if (raw.startsWith("[") || raw.includes("\"invalid_type\"") || raw.includes("\"path\"")) {
    return localizeForRequest(
      request,
      "The model returned an incomplete itinerary structure.",
      "模型返回的行程结构不完整。"
    );
  }

  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
}

function preferLocalizedText(
  request: TripRequest,
  primary: string | undefined,
  fallback: string | undefined
) {
  if (!primary) {
    return fallback;
  }

  if (!shouldPreferChineseOutput(request.destination)) {
    return primary;
  }

  if (containsCjk(primary) || !fallback || !containsCjk(fallback)) {
    return primary;
  }

  return fallback;
}

function summarizeHeuristicForPrompt(heuristic: Itinerary) {
  return {
    days: heuristic.days.map((day) => ({
      date: day.date,
      title: day.title,
      items: day.items.map((item) => ({
        poiId: item.poi.id,
        poiName: item.poi.name,
        category: item.category,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMinutes: item.durationMinutes,
        travelMinutesFromPrevious: item.travelMinutesFromPrevious,
        notes: item.notes
      }))
    }))
  };
}

function shouldVerifyLocalCandidates(request: TripRequest, pois: Poi[]) {
  if (pois.length === 0) {
    return false;
  }

  return pois.some((poi) => {
    const areaLikeName = areaLikePoiNamePattern.test(poi.name);
    const needsChineseLocalization =
      shouldPreferChineseOutput(request.destination) && !containsCjk(poi.name);

    return areaLikeName || needsChineseLocalization;
  });
}

async function buildLlmCandidatePois(request: TripRequest, llmConfig: LlmProviderConfig, desiredCount: number) {
  const isLocalOllama = isLikelyOllamaBaseUrl(llmConfig.baseUrl);
  const apiKey = decryptString(llmConfig.apiKeyEncrypted);
  const attempts = isLocalOllama ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const raw = await requestStructuredJson({
        baseUrl: llmConfig.baseUrl,
        apiKey,
        model: llmConfig.model,
        temperature: isLocalOllama
          ? Math.min(llmConfig.temperature, attempt === 0 ? 0.2 : 0.1)
          : Math.min(llmConfig.temperature, 0.4),
        maxTokens: isLocalOllama ? 1_400 : undefined,
        reasoningEffort: isLocalOllama ? "none" : undefined,
        schema: z.unknown(),
        systemPrompt: buildPoiResearchSystemPrompt(),
        userPrompt: buildPoiResearchUserPrompt(request, desiredCount),
        retries: isLocalOllama ? 0 : 1
      });
      const parsed = z.object({
        pois: z.array(relaxedPoiSchema).min(1).max(40)
      }).parse(normalizePoiResearchPayload(raw));

      const normalized = parsed.pois.map((poi: RelaxedPoi, index: number) =>
        toPoiFromRelaxed(poi, request, index)
      );
      const cleaned = cleanLlmFallbackPois(request, normalized, {
        requireLocalizedDisplayName: !isLocalOllama
      });

      if (cleaned.length === 0) {
        lastError = new Error("The model returned no usable POIs after filtering.");
        continue;
      }

      if (!isLocalOllama || !shouldVerifyLocalCandidates(request, cleaned)) {
        const finalized = cleanLlmFallbackPois(request, cleaned, {
          requireLocalizedDisplayName: true
        });
        if (finalized.length > 0) {
          return finalized;
        }

        lastError = new Error("The model returned POIs, but none passed final localization checks.");
        continue;
      }

      try {
        const verifiedRaw = await requestStructuredJson({
          baseUrl: llmConfig.baseUrl,
          apiKey,
          model: llmConfig.model,
          temperature: Math.min(llmConfig.temperature, 0.1),
          maxTokens: 1_200,
          reasoningEffort: "none",
          schema: z.unknown(),
          systemPrompt: buildPoiVerifierSystemPrompt(),
          userPrompt: buildPoiVerifierUserPrompt(
            request,
            cleaned.map((poi) => serializePoiForVerifier(poi))
          ),
          timeoutMs: 45_000,
          retries: 0
        });
        const verified = z.object({
          pois: z.array(relaxedPoiSchema).max(40)
        }).parse(normalizePoiResearchPayload(verifiedRaw));
        const candidateLookup = createCandidateLookup(cleaned);
        const vetted = cleanLlmFallbackPois(
          request,
          verified.pois.map((poi: RelaxedPoi, index: number) =>
            toPoiFromRelaxed(poi, request, index, candidateLookup)
          ),
          {
            requireLocalizedDisplayName: true
          }
        );

        if (vetted.length > 0) {
          return vetted;
        }
      } catch {
        // Fall through to final strict cleanup and retry if needed.
      }

      const finalized = cleanLlmFallbackPois(request, cleaned, {
        requireLocalizedDisplayName: true
      });
      if (finalized.length > 0) {
        return finalized;
      }

      lastError = new Error("The model returned POIs, but none passed final localization checks.");
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("The model did not return any usable POIs.");
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
      const resolvedPoi =
        shouldPreferChineseOutput(request.destination) &&
        !containsCjk(poi.name) &&
        heuristicItem?.poi &&
        containsCjk(heuristicItem.poi.name)
          ? heuristicItem.poi
          : poi;
      const startTime = parsedItem.startTime ?? heuristicItem?.startTime ?? "09:00";
      const durationMinutes =
        parsedItem.durationMinutes ??
        heuristicItem?.durationMinutes ??
        resolvedPoi.recommendedDurationMinutes ??
        90;
      const endTime = parsedItem.endTime ?? addMinutesToTime(startTime, durationMinutes);
      const localizedCategory =
        preferLocalizedText(
          request,
          parsedItem.category,
          heuristicItem?.category ??
            localizeCategoryLabel(request.destination, resolvedPoi.categories[0])
        ) ??
        localizeCategoryLabel(request.destination, resolvedPoi.categories[0]) ??
        heuristicItem?.category ??
        "\u666f\u70b9";
      const localizedNotes = preferLocalizedText(request, parsedItem.notes, heuristicItem?.notes);

      return {
        id: parsedItem.id ?? heuristicItem?.id ?? `${heuristicDay.date}-${resolvedPoi.id}`,
        poi: resolvedPoi,
        category: parsedItem.category ?? poi.categories[0] ?? heuristicItem?.category ?? "景点",
        startTime,
        endTime,
        durationMinutes,
        travelMinutesFromPrevious:
          parsedItem.travelMinutesFromPrevious ?? heuristicItem?.travelMinutesFromPrevious ?? 0,
        notes: parsedItem.notes ?? heuristicItem?.notes,
        ...(localizedCategory ? { category: localizedCategory } : {}),
        ...(localizedNotes ? { notes: localizedNotes } : {}),
        locked: parsedItem.locked ?? false
      };
    });

    const localizedTitle = preferLocalizedText(request, parsedDay.title, heuristicDay.title);

    return {
      date: parsedDay.date ?? heuristicDay.date,
      title: parsedDay.title ?? heuristicDay.title,
      totalTravelMinutes:
        parsedDay.totalTravelMinutes ??
        items.reduce((sum, item) => sum + item.travelMinutesFromPrevious, 0),
      intensityScore: parsedDay.intensityScore ?? heuristicDay.intensityScore,
      ...(localizedTitle ? { title: localizedTitle } : {}),
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
  const isLocalOllama = isLikelyOllamaBaseUrl(llmConfig.baseUrl);
  const isFastLocalRefinement = isLocalOllama;
  const raw = await requestStructuredJson({
    baseUrl: llmConfig.baseUrl,
    apiKey: decryptString(llmConfig.apiKeyEncrypted),
    model: llmConfig.model,
    temperature: isLocalOllama ? Math.min(llmConfig.temperature, 0.2) : llmConfig.temperature,
    maxTokens: isLocalOllama ? 2_400 : undefined,
    reasoningEffort: isLocalOllama ? "none" : undefined,
    timeoutMs: isFastLocalRefinement ? 45_000 : undefined,
    retries: isFastLocalRefinement ? 0 : undefined,
    schema: z.unknown(),
    systemPrompt: buildPlannerSystemPrompt(),
    userPrompt: `${buildPlannerUserPrompt(request, scoreCandidates(request, heuristic.days.flatMap((day) => day.items.map((item) => item.poi))))}\nUse this heuristic baseline if needed:\n${JSON.stringify(summarizeHeuristicForPrompt(heuristic), null, 2)}`
  });
  const parsed = relaxedItinerarySchema.parse(normalizeItineraryPayload(raw));

  return normalizeLlmItinerary(parsed, request, heuristic, metadata, carriedIssues);
}

export async function planTrip(options: PlanTripOptions) {
  const geoProvider = createGeoProvider();
  const baseIssues = derivePlanningIssues(options.request, geoProvider.name);
  const desiredCandidateCount = Math.max(options.request.days * 6, 8);

  emit(options.onProgress, {
    stage: "candidates",
    message: localizeForRequest(
      options.request,
      "Collecting candidate places from the geo provider.",
      "正在收集候选景点。"
    )
  });

  let candidates =
    geoProvider.name === "mock"
      ? []
      : await geoProvider.searchPois({
          destination: options.request.destination,
          tags: [...options.request.interests, "美食", "城市地标"],
          radius: 12000
        });
  let candidateSource = geoProvider.name;

  if (geoProvider.name === "wikimedia" && candidates.length > 0) {
    baseIssues.push({
      severity: "warning",
      code: "online-guide-source",
      message: localizeForRequest(
        options.request,
        "POI candidates were collected from live online travel guides.",
        "候选点来自在线公开旅行资料。"
      ),
      source: "candidate-builder",
      suggestion: localizeForRequest(
        options.request,
        "Opening hours and travel times can still drift; configure AMAP_API_KEY if you need map-grade precision.",
        "营业时间与通勤仍可能变动；如需更高精度，可再配置 AMAP_API_KEY。"
      )
    });
  }

  if (geoProvider.name === "mock") {
    if (options.llmConfig?.enabled) {
      emit(options.onProgress, {
        stage: "candidates",
        message: localizeForRequest(
          options.request,
          "Map data is not configured, so the LLM is assembling real POI candidates.",
          "未配置地图数据，正在由模型补全真实候选点。"
        )
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
            message: localizeForRequest(
              options.request,
              "Map data is unavailable, so POI candidates were generated by the LLM.",
              "当前未接入地图数据，因此候选点由模型生成。"
            ),
            source: "candidate-builder",
            suggestion: localizeForRequest(
              options.request,
              "Verify names, locations, and opening hours manually, or configure AMAP_API_KEY for higher confidence.",
              "可手动核对名称、位置与营业时间；如需更高置信度，再配置 AMAP_API_KEY。"
            )
          });
        } else {
          throw new Error(
            localizeForRequest(
              options.request,
              "No map provider is configured, and the model did not return any usable real POIs. If you are using Ollama, confirm the model is installed and can answer structured JSON prompts.",
              "当前未配置地图数据，模型也没有返回可用的真实候选点。若你在使用 Ollama，请确认模型已安装且能正常输出 JSON。"
            )
          );
        }
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? localizeForRequest(
                options.request,
                `No map provider is configured and real POI fallback failed: ${error.message}`,
                `未配置地图数据，且模型候选点补全失败：${error.message}`
              )
            : localizeForRequest(
                options.request,
                "No map provider is configured and real POI fallback failed.",
                "未配置地图数据，且模型候选点补全失败。"
              )
        );
      }
    } else {
      throw new Error(
        localizeForRequest(
          options.request,
          "No map provider is configured, and LLM refinement is disabled. Enable a local Ollama model or configure AMAP_API_KEY before planning.",
          "当前未配置地图数据，且模型能力未启用。请先启用本地 Ollama 模型，或配置 AMAP_API_KEY 后再进行规划。"
        )
      );
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      localizeForRequest(
        options.request,
        "No usable candidate places were found for this request. Adjust the destination or model settings and try again.",
        "没有找到可用的候选点，请调整目的地或模型配置后重试。"
      )
    );
  }

  const ranked = scoreCandidates(options.request, candidates);
  const chosen = selectDiverseCandidates(options.request, ranked, desiredCandidateCount);
  assertCandidateCoverage(options.request, chosen);
  const chosenRanked = chosen.map((poi) => ranked.find((entry) => entry.poi.id === poi.id) ?? { poi, score: 0 });

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
    message: localizeForRequest(
      options.request,
      "Building a rule-based draft with travel time heuristics.",
      "正在根据通勤与节奏生成初版行程。"
    )
  });

  const travelMatrix = await geoProvider.getTravelMatrix(chosen, "driving");
  const heuristic = buildHeuristicItinerary(
    options.request,
    chosenRanked,
    travelMatrix,
    metadata,
    baseIssues
  );

  let itinerary = heuristic;

  if (options.llmConfig?.enabled) {
    emit(options.onProgress, {
      stage: "llm",
      message: localizeForRequest(
        options.request,
        "Handing the draft to the configured LLM for itinerary refinement.",
        "正在由模型润色并细化行程。"
      )
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
      const shouldSuppressRefinementIssue =
        candidateSource === "wikimedia" && isLikelyOllamaBaseUrl(options.llmConfig.baseUrl);

      if (!shouldSuppressRefinementIssue) {
        baseIssues.push({
          severity: "warning",
          code: "llm-fallback",
          message:
            error instanceof Error
              ? localizeForRequest(
                  options.request,
                  `The model did not complete structured refinement, so the verified rule-based itinerary was kept: ${summarizeLlmPlanningError(options.request, error)}`,
                  `模型未完成结构化细化，已采用可执行的规则行程：${summarizeLlmPlanningError(options.request, error)}`
                )
              : localizeForRequest(
                  options.request,
                  "The model did not complete structured refinement, so the verified rule-based itinerary was kept.",
                  "模型未完成结构化细化，已采用可执行的规则行程。"
                ),
          source: "llm-planner",
          suggestion: localizeForRequest(
            options.request,
            "Check your model configuration, or keep editing the current itinerary directly.",
            "可检查模型配置，或直接在当前行程上继续编辑。"
          )
        });
      }

      itinerary = {
        ...heuristic,
        issues: [...heuristic.issues, ...baseIssues]
      };
    }
  }

  emit(options.onProgress, {
    stage: "validate",
    message: localizeForRequest(
      options.request,
      "Validating overlaps, duplicates, and long transfers.",
      "正在校验时间冲突、重复景点和超长通勤。"
    )
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
