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
import { enrichItineraryPoiImages } from "@/lib/planning/poi-images";
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildPoiResearchSystemPrompt,
  buildPoiResearchUserPrompt
} from "@/lib/planning/prompt";
import {
  containsCjk,
  getDefaultCountryForDestination,
  isLikelyDomesticDestination,
  matchesDestinationAlias,
  normalizeDestinationTerm,
  resolvePlanningDestination,
  shouldPreferChineseOutput
} from "@/lib/planning/destination";
import { getDestinationGeoAnchor, partitionDestinationOutlierPois } from "@/lib/planning/destination-geo";
import { getCoreCitySeedPois } from "@/lib/planning/core-city-seeds";
import { mergeIssues, repairItinerary, validateItinerary } from "@/lib/planning/validator";
import { requestStructuredJson, requestStructuredJsonWithTools } from "@/lib/llm/openai-compatible";
import { createWebResearchTools } from "@/lib/llm/web-research";
import { isLikelyOllamaBaseUrl } from "@/lib/llm/provider-utils";
import {
  getPoiQualityScore,
  hasVenueLikeSignal,
  isBroadAreaLikePoiName,
  normalizePoiCategories
} from "@/lib/planning/poi-signals";
import type { Itinerary, ItineraryDay, ItineraryItem, PlanningIssue, Poi, TripRequest } from "@/lib/schemas/trip";
import { addMinutesToTime, normalizeTimeValue } from "@/lib/utils/time";
import { itinerarySchema, relaxedItinerarySchema, relaxedPoiSchema } from "@/lib/schemas/trip";
import { getMeaningfulPoiAddress } from "@/lib/utils/poi-address";

type ProgressEvent = {
  stage: "candidates" | "preplan" | "llm" | "validate" | "persist";
  message: string;
};

type PlanTripOptions = {
  request: TripRequest;
  llmConfig?: LlmProviderConfig | null;
  onProgress?: (event: ProgressEvent) => void;
  skipPoiImageEnrichment?: boolean;
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
const administrativeRegionPoiNamePattern =
  /(?:province|city|district|county|prefecture|region|自治州|自治区|特别行政区|省|市|区|县|州)$/iu;
const transitInfrastructurePoiNamePattern =
  /(轨道交通\s*\d+\s*号线|地铁\s*\d+\s*号线|轨道交通|地铁|有轨电车|公交线路|铁路线路|metro line|subway line|rail line|tram line|line\s*\d+)/i;
const mediaOrganizationPoiNamePattern =
  /(广播电视台|电视台|广播电台|电台|融媒体中心|传媒集团|新闻中心|tv station|television station|radio station|media group)/i;
const officeOrResidentialPoiNamePattern =
  /(写字楼|办公楼|办公大厦|产业园|工业园|公寓|住宅小区|商务中心|office tower|office building|apartment complex|residential complex)/i;

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

function createSyntheticCoordinates(
  seed: string,
  destination: string,
  index: number,
  anchor?: {
    latitude: number;
    longitude: number;
  }
) {
  const hash = hashString(`${seed}:${index}`);
  const isDomestic = isLikelyDomesticDestination(destination);
  const destinationAnchor = getDestinationGeoAnchor(destination);
  const baseLat = anchor?.latitude ?? destinationAnchor?.latitude ?? (isDomestic ? 30 : 40);
  const baseLng = anchor?.longitude ?? destinationAnchor?.longitude ?? (isDomestic ? 112 : 2);
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

function getPoiCentroid(pois: Poi[]) {
  const validPois = pois.filter(
    (poi) => Number.isFinite(poi.latitude) && Number.isFinite(poi.longitude)
  );

  if (validPois.length === 0) {
    return undefined;
  }

  return {
    latitude: validPois.reduce((sum, poi) => sum + poi.latitude, 0) / validPois.length,
    longitude: validPois.reduce((sum, poi) => sum + poi.longitude, 0) / validPois.length
  };
}

function isAdministrativeRegionLikePoiName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return false;
  }

  return administrativeRegionPoiNamePattern.test(trimmed) && !hasVenueLikeSignal(trimmed);
}

function isClearlyInvalidPoiName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return true;
  }

  return (
    genericPoiNamePattern.test(trimmed) ||
    areaLikePoiNamePattern.test(trimmed) ||
    isBroadAreaLikePoiName(trimmed) ||
    isAdministrativeRegionLikePoiName(trimmed) ||
    transitInfrastructurePoiNamePattern.test(trimmed) ||
    mediaOrganizationPoiNamePattern.test(trimmed) ||
    officeOrResidentialPoiNamePattern.test(trimmed)
  );
}

function shouldRepairCandidateCoordinates(request: TripRequest, poi: Poi) {
  if (isClearlyInvalidPoiName(poi.name)) {
    return false;
  }

  const alignedByAddress = matchesDestinationAlias(poi.address, request.destination);
  const alignedByCity = matchesDestinationAlias(poi.city, request.destination);
  if (!alignedByAddress && !alignedByCity) {
    return false;
  }

  if (alignedByAddress) {
    return true;
  }

  return getPoiQualityScore(request.destination, poi) >= 10;
}

function repairCandidateCoordinates(request: TripRequest, candidates: Poi[]) {
  return candidates.map((poi, index) => {
    const { anchor, dropped } = partitionDestinationOutlierPois(request.destination, [poi]);
    if (!anchor || dropped.length === 0 || !shouldRepairCandidateCoordinates(request, poi)) {
      return poi;
    }

    const synthetic = createSyntheticCoordinates(
      `${request.destination}:${poi.name}:${poi.address}:${poi.city ?? ""}`,
      request.destination,
      index,
      anchor
    );

    return {
      ...poi,
      latitude: synthetic.latitude,
      longitude: synthetic.longitude
    };
  });
}

function sanitizeCandidatePool(request: TripRequest, candidates: Poi[], issues: PlanningIssue[]) {
  const categorizedCandidates = candidates.map((poi) => ({
    ...poi,
    categories: normalizePoiCategories(request.destination, poi)
  }));
  const repairedCandidates = repairCandidateCoordinates(request, categorizedCandidates);
  const { kept, dropped } = partitionDestinationOutlierPois(request.destination, repairedCandidates);

  if (dropped.length === 0) {
    return repairedCandidates;
  }

  issues.push({
    severity: "warning",
    code: "geo-outlier-filter",
    message: localizeForRequest(
      request,
      `Removed ${dropped.length} candidate places that were far outside ${request.destination}.`,
      `已剔除 ${dropped.length} 个明显偏离 ${request.destination} 的候选点。`
    ),
    source: "candidate-builder",
    suggestion: localizeForRequest(
      request,
      `Filtered outliers: ${dropped.slice(0, 3).map((entry) => entry.poi.name).join(", ")}.`,
      `已过滤的异常地点包括：${dropped.slice(0, 3).map((entry) => entry.poi.name).join("、")}。`
    )
  });

  return kept;
}

function toPoiFromRelaxed(
  relaxedPoi: RelaxedPoi,
  request: TripRequest,
  index: number,
  candidateLookup?: ReturnType<typeof createCandidateLookup>,
  fallbackGeoAnchor?: {
    latitude: number;
    longitude: number;
  }
) {
  const matchedCandidate =
    (relaxedPoi.id ? candidateLookup?.byId.get(relaxedPoi.id) : undefined) ??
    candidateLookup?.byName.get(normalizeKey(relaxedPoi.name));
  const resolvedCity = relaxedPoi.city ?? matchedCandidate?.city ?? request.destination;
  const resolvedAddress =
    getMeaningfulPoiAddress({
      address: relaxedPoi.address ?? matchedCandidate?.address,
      city: resolvedCity
    }) ?? "";

  const synthetic = createSyntheticCoordinates(
    `${request.destination}:${relaxedPoi.name}`,
    request.destination,
    index,
    fallbackGeoAnchor
  );
  const id = relaxedPoi.id ?? matchedCandidate?.id ?? `${createSlug(request.destination)}-${createSlug(relaxedPoi.name)}-${index + 1}`;
  const resolvedCategories = normalizePoiCategories(request.destination, {
    name: relaxedPoi.name,
    address: resolvedAddress,
    categories:
      relaxedPoi.categories?.filter(Boolean) ??
      matchedCandidate?.categories ??
      request.interests.slice(0, 2),
    openingHoursText: relaxedPoi.openingHoursText ?? matchedCandidate?.openingHoursText
  });

  return {
    id,
    name: relaxedPoi.name,
    address: resolvedAddress,
    city: resolvedCity,
    country:
      relaxedPoi.country ??
      matchedCandidate?.country ??
      getDefaultCountryForDestination(request.destination),
    categories: resolvedCategories,
    latitude: relaxedPoi.latitude ?? matchedCandidate?.latitude ?? synthetic.latitude,
    longitude: relaxedPoi.longitude ?? matchedCandidate?.longitude ?? synthetic.longitude,
    recommendedDurationMinutes:
      relaxedPoi.recommendedDurationMinutes ?? matchedCandidate?.recommendedDurationMinutes ?? 90,
    openingHoursText: relaxedPoi.openingHoursText ?? matchedCandidate?.openingHoursText,
    sourcePageUrl: relaxedPoi.sourcePageUrl ?? matchedCandidate?.sourcePageUrl,
    image: relaxedPoi.image ?? matchedCandidate?.image
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
  const normalizedPlanningDestination = normalizeKey(resolvePlanningDestination(request.destination));
  const genericDestinationPoiSuffixes = [
    "\u7f8e\u98df\u8857",
    "\u5c0f\u5403\u8857",
    "\u591c\u666f",
    "\u591c\u6e38",
    "\u89c2\u666f\u53f0",
    "food street",
    "snack street",
    "night view",
    "night tour"
  ].map((value) => normalizeKey(value));

  const filtered = pois.filter((poi) => {
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
    const lacksChineseDisplayName =
      requireLocalizedDisplayName &&
      prefersChineseOutput &&
      !containsCjk(poi.name) &&
      !explicitlyRequestedPoi;
    const destinationPrefixedGenericPoi =
      normalizedPlanningDestination.length > 0 &&
      normalizedName.startsWith(normalizedPlanningDestination) &&
      genericDestinationPoiSuffixes.includes(normalizedName.slice(normalizedPlanningDestination.length));

    if (
      !key ||
      placeholderPattern.test(poi.name) ||
      placeholderPattern.test(poi.address) ||
      isClearlyInvalidPoiName(poi.name) ||
      vagueAddressPattern.test(poi.address) ||
      lacksChineseDisplayName ||
      destinationPrefixedGenericPoi ||
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

  return mergeCandidatePools(request.destination, filtered);
}

function derivePlanningIssues(request: TripRequest, geoProviderName: string) {
  const issues: PlanningIssue[] = [];
  const isDomestic = isLikelyDomesticDestination(request.destination);
  const planningDestination = resolvePlanningDestination(request.destination);

  if (!isDomestic) {
    issues.push({
      severity: "warning",
      code: "intl-beta",
      message: "International destinations currently use a lighter geo fallback path.",
      source: geoProviderName,
      suggestion: "Review travel times and opening hours manually before departing."
    });
  }

  if (normalizeDestinationTerm(planningDestination) !== normalizeDestinationTerm(request.destination)) {
    issues.push({
      severity: "warning",
      code: "broad-destination-fallback",
      message: localizeForRequest(
        request,
        `Province-level destination input was narrowed to the provincial capital for planning: ${request.destination} -> ${planningDestination}.`,
        `当前会先按省会城市规划该省级目的地：${request.destination} -> ${planningDestination}。`
      ),
      source: geoProviderName,
      suggestion: localizeForRequest(
        request,
        "If you want another city inside the province, enter that city directly for more precise results.",
        "如果你想规划省内其他城市，请直接填写城市名以获得更精确的结果。"
      )
    });
  }

  return issues;
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
      entry.poi.categories.some((category) => categoryMatchesInterest(category, interest))
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

function getMissingInterestCoverage(request: TripRequest, pois: Poi[]) {
  return request.interests.filter(
    (interest) =>
      !pois.some((poi) => poi.categories.some((category) => categoryMatchesInterest(category, interest)))
  );
}

const poiVariantSuffixes = [
  "\u591c\u666f",
  "\u591c\u6e38",
  "\u591c\u8272",
  "\u89c2\u666f",
  "\u89c2\u666f\u53f0",
  "\u89c2\u666f\u70b9",
  "\u6253\u5361",
  "\u6253\u5361\u70b9",
  "\u666f\u533a",
  "\u666f\u70b9",
  "\u98ce\u666f\u533a",
  "\u65c5\u6e38\u533a",
  "nightview",
  "nightviewspot",
  "nighttour",
  "viewpoint",
  "scenicspot"
].map((value) => normalizeKey(value));

function normalizePoiVariantName(name: string) {
  let normalized = normalizeKey(name);

  for (const suffix of poiVariantSuffixes) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length + 1) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }

  return normalized;
}

function normalizeSourcePageUrl(url?: string) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    const pathname = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `${parsed.origin.toLowerCase()}${pathname}`;
  } catch {
    return "";
  }
}

function areEquivalentPoiAddresses(left: string, right: string) {
  const normalizedLeft = normalizeKey(left);
  const normalizedRight = normalizeKey(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    (normalizedLeft.length >= 6 && normalizedRight.includes(normalizedLeft)) ||
    (normalizedRight.length >= 6 && normalizedLeft.includes(normalizedRight))
  );
}

function areSemanticallyEquivalentPois(left: Poi, right: Poi) {
  const normalizedLeftCity = normalizeKey(left.city ?? "");
  const normalizedRightCity = normalizeKey(right.city ?? "");

  if (normalizedLeftCity && normalizedRightCity && normalizedLeftCity !== normalizedRightCity) {
    return false;
  }

  const normalizedLeftSource = normalizeSourcePageUrl(left.sourcePageUrl);
  const normalizedRightSource = normalizeSourcePageUrl(right.sourcePageUrl);
  if (normalizedLeftSource && normalizedLeftSource === normalizedRightSource) {
    return true;
  }

  const normalizedLeftVariant = normalizePoiVariantName(left.name);
  const normalizedRightVariant = normalizePoiVariantName(right.name);

  if (!normalizedLeftVariant || normalizedLeftVariant !== normalizedRightVariant) {
    return false;
  }

  return areEquivalentPoiAddresses(left.address, right.address);
}

function getPoiVariantSpecificityPenalty(name: string) {
  return normalizePoiVariantName(name) !== normalizeKey(name) ? 2 : 0;
}

function getPoiMergePreferenceScore(destination: string, poi: Poi) {
  return (
    getPoiQualityScore(destination, poi) +
    (poi.sourcePageUrl ? 4 : 0) +
    (poi.image ? 2 : 0) +
    Math.min(poi.categories.length, 3) +
    (poi.address.trim().length > 0 ? 2 : 0) -
    getPoiVariantSpecificityPenalty(poi.name)
  );
}

function mergeEquivalentPoiVariants(destination: string, current: Poi, incoming: Poi) {
  const preferIncoming =
    getPoiMergePreferenceScore(destination, incoming) >
    getPoiMergePreferenceScore(destination, current);
  const primary = preferIncoming ? incoming : current;
  const secondary = preferIncoming ? current : incoming;

  return {
    ...primary,
    address: primary.address || secondary.address,
    city: primary.city || secondary.city,
    country: primary.country || secondary.country,
    categories: normalizePoiCategories(destination, {
      ...primary,
      categories: [...primary.categories, ...secondary.categories]
    }),
    latitude: primary.latitude ?? secondary.latitude,
    longitude: primary.longitude ?? secondary.longitude,
    recommendedDurationMinutes:
      primary.recommendedDurationMinutes ?? secondary.recommendedDurationMinutes ?? 90,
    openingHoursText: primary.openingHoursText ?? secondary.openingHoursText,
    sourcePageUrl: primary.sourcePageUrl ?? secondary.sourcePageUrl,
    image: primary.image ?? secondary.image
  };
}

function mergeCandidatePools(destination: string, ...pools: Poi[][]) {
  const merged: Poi[] = [];
  const seenIds = new Map<string, number>();
  const seenNames = new Map<string, number>();

  for (const pool of pools) {
    for (const poi of pool) {
      const idKey = poi.id.trim();
      const nameKey = normalizeKey(`${poi.name}:${poi.city ?? ""}`);

      const existingIndex =
        (idKey ? seenIds.get(idKey) : undefined) ??
        (nameKey ? seenNames.get(nameKey) : undefined) ??
        merged.findIndex((existingPoi) => areSemanticallyEquivalentPois(existingPoi, poi));

      if (typeof existingIndex === "number" && existingIndex >= 0) {
        const mergedPoi = mergeEquivalentPoiVariants(destination, merged[existingIndex], poi);
        merged[existingIndex] = mergedPoi;

        if (idKey) {
          seenIds.set(idKey, existingIndex);
        }
        if (mergedPoi.id.trim()) {
          seenIds.set(mergedPoi.id.trim(), existingIndex);
        }
        if (nameKey) {
          seenNames.set(nameKey, existingIndex);
        }
        const mergedNameKey = normalizeKey(`${mergedPoi.name}:${mergedPoi.city ?? ""}`);
        if (mergedNameKey) {
          seenNames.set(mergedNameKey, existingIndex);
        }
        continue;
      }

      if (idKey) {
        seenIds.set(idKey, merged.length);
      }
      if (nameKey) {
        seenNames.set(nameKey, merged.length);
      }

      merged.push(poi);
    }
  }

  return merged;
}

function getMinimumUsableCandidateCount(request: TripRequest) {
  return Math.min(6, request.days * 2);
}

function supplementCandidatesWithCoreCitySeeds(options: {
  request: TripRequest;
  destination: string;
  candidates: Poi[];
  coreCitySeeds: Poi[];
  minimumUsableCandidateCount: number;
  issues: PlanningIssue[];
}) {
  const {
    request,
    destination,
    candidates,
    coreCitySeeds,
    minimumUsableCandidateCount,
    issues
  } = options;

  if (coreCitySeeds.length === 0 || candidates.length === 0) {
    return candidates;
  }

  const missingInterestCoverageBeforeSeeds = getMissingInterestCoverage(request, candidates);
  const mergedCandidates = mergeCandidatePools(destination, candidates, coreCitySeeds);
  const missingInterestCoverageAfterSeeds = getMissingInterestCoverage(request, mergedCandidates);
  const repairedCoverageBySeeds =
    missingInterestCoverageAfterSeeds.length < missingInterestCoverageBeforeSeeds.length;
  const repairedDepthBySeeds =
    candidates.length < minimumUsableCandidateCount &&
    mergedCandidates.length >= minimumUsableCandidateCount;

  if (mergedCandidates.length <= candidates.length || (!repairedCoverageBySeeds && !repairedDepthBySeeds)) {
    return candidates;
  }

  issues.push({
    severity: "warning",
    code: "core-city-seed-supplement",
    message: repairedCoverageBySeeds
      ? localizeForRequest(
          request,
          `The candidate set for ${destination} missed ${missingInterestCoverageBeforeSeeds.join(", ")}, so curated city seed POIs were merged in.`,
          `${destination} \u7684\u5019\u9009\u70b9\u672a\u8986\u76d6\u8fd9\u4e9b\u5174\u8da3\uff1a${missingInterestCoverageBeforeSeeds.join("\u3001")}\uff0c\u5df2\u5e76\u5165\u5185\u7f6e\u57ce\u5e02\u79cd\u5b50\u70b9\u8865\u9f50\u3002`
        )
      : localizeForRequest(
          request,
          `The candidate set for ${destination} was too thin for a stable itinerary, so curated city seed POIs were merged in.`,
          `${destination} \u7684\u5019\u9009\u70b9\u6570\u91cf\u504f\u8584\uff0c\u5df2\u5e76\u5165\u5185\u7f6e\u57ce\u5e02\u79cd\u5b50\u70b9\u63d0\u9ad8\u89c4\u5212\u7a33\u5b9a\u6027\u3002`
        ),
    source: "candidate-builder",
    suggestion:
      missingInterestCoverageAfterSeeds.length === 0
        ? localizeForRequest(
            request,
            "Coverage is now stable, but you should still spot-check names and opening hours.",
            "\u5f53\u524d\u5019\u9009\u70b9\u8986\u76d6\u5df2\u7a33\u5b9a\uff0c\u4f46\u4ecd\u5efa\u8bae\u62bd\u67e5\u5730\u70b9\u540d\u79f0\u4e0e\u8425\u4e1a\u65f6\u95f4\u3002"
          )
        : localizeForRequest(
            request,
            `Some interests are still thin after merging city seed POIs: ${missingInterestCoverageAfterSeeds.join(", ")}.`,
            `\u5e76\u5165\u5185\u7f6e\u57ce\u5e02\u79cd\u5b50\u70b9\u540e\uff0c\u8fd9\u4e9b\u5174\u8da3\u4ecd\u7136\u504f\u8584\uff1a${missingInterestCoverageAfterSeeds.join("\u3001")}\u3002`
          )
  });

  return mergedCandidates;
}

function assertCandidateCoverage(request: TripRequest, chosen: Poi[]) {
  const missingInterests = getMissingInterestCoverage(request, chosen);

  if (missingInterests.length > 0) {
    throw new Error(
      localizeForRequest(
        request,
        `Collected candidates did not cover these requested interests: ${missingInterests.join(", ")}.`,
        `当前收集到的候选点无法覆盖这些兴趣：${missingInterests.join("、")}。`
      )
    );
  }

  if (chosen.length < getMinimumUsableCandidateCount(request)) {
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

async function buildLlmCandidatePois(
  request: TripRequest,
  llmConfig: LlmProviderConfig,
  desiredCount: number,
  options?: {
    fallbackGeoAnchor?: {
      latitude: number;
      longitude: number;
    };
  }
) {
  const isLocalOllama = isLikelyOllamaBaseUrl(llmConfig.baseUrl);
  const apiKey = decryptString(llmConfig.apiKeyEncrypted);
  const attempts = isLocalOllama ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const raw = await requestStructuredJsonWithTools({
        baseUrl: llmConfig.baseUrl,
        apiKey,
        model: llmConfig.model,
        temperature: isLocalOllama
          ? Math.min(llmConfig.temperature, attempt === 0 ? 0.2 : 0.1)
          : Math.min(llmConfig.temperature, 0.4),
        maxTokens: isLocalOllama ? 2_200 : undefined,
        reasoningEffort: isLocalOllama ? "none" : undefined,
        schema: z.unknown(),
        systemPrompt: buildPoiResearchSystemPrompt(),
        userPrompt: buildPoiResearchUserPrompt(request, desiredCount),
        retries: isLocalOllama ? 0 : 1,
        maxSteps: isLocalOllama ? 10 : 8,
        tools: createWebResearchTools(request.destination)
      });
      const parsed = z.object({
        pois: z.array(relaxedPoiSchema).min(1).max(40)
      }).parse(normalizePoiResearchPayload(raw));

      const normalized = parsed.pois.map((poi: RelaxedPoi, index: number) =>
        toPoiFromRelaxed(poi, request, index, undefined, options?.fallbackGeoAnchor)
      );
      const cleaned = cleanLlmFallbackPois(request, normalized, {
        requireLocalizedDisplayName: !isLocalOllama
      });

      if (cleaned.length === 0) {
        lastError = new Error("The model researched the web but returned no usable POIs.");
        continue;
      }

      const finalized = cleanLlmFallbackPois(request, cleaned, {
        requireLocalizedDisplayName: true
      });
      if (finalized.length > 0) {
        return finalized;
      }

      lastError = new Error("The model researched the web, but none of the returned POIs passed final validation.");
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
      const fallbackStartTime = heuristicItem?.startTime ?? "09:00";
      const startTime = normalizeTimeValue(parsedItem.startTime ?? fallbackStartTime, fallbackStartTime, {
        prefer: "first"
      });
      const durationMinutes =
        parsedItem.durationMinutes ??
        heuristicItem?.durationMinutes ??
        resolvedPoi.recommendedDurationMinutes ??
        90;
      const fallbackEndTime = addMinutesToTime(startTime, durationMinutes);
      const endTime = normalizeTimeValue(parsedItem.endTime ?? fallbackEndTime, fallbackEndTime, {
        prefer: "last"
      });
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
  const minimumUsableCandidateCount = getMinimumUsableCandidateCount(options.request);
  const planningDestination = resolvePlanningDestination(options.request.destination);
  const planningRequest =
    normalizeDestinationTerm(planningDestination) === normalizeDestinationTerm(options.request.destination)
      ? options.request
      : {
          ...options.request,
          destination: planningDestination
        };

  emit(options.onProgress, {
    stage: "candidates",
    message: localizeForRequest(
      options.request,
      "Collecting candidate places from the geo provider.",
      "正在收集候选景点。"
    )
  });

  const coreCitySeeds =
    geoProvider.name === "amap" ? [] : getCoreCitySeedPois(planningRequest.destination);
  let providerSearchError: unknown;
  let candidates: Poi[] = [];

  if (geoProvider.name !== "fallback" && geoProvider.name !== "mock") {
    try {
      candidates = await geoProvider.searchPois({
        destination: planningRequest.destination,
        tags: [...options.request.interests, "美食", "城市地标"],
        radius: 12000
      });
      candidates = sanitizeCandidatePool(planningRequest, candidates, baseIssues);
    } catch (error) {
      providerSearchError = error;
    }
  }

  let candidateSource = geoProvider.name;
  const isModelResearchProvider = geoProvider.name === "fallback" || geoProvider.name === "mock";

  if (isModelResearchProvider && !options.llmConfig?.enabled && coreCitySeeds.length > 0) {
    candidates = mergeCandidatePools(planningRequest.destination, candidates, coreCitySeeds);
    candidateSource = "core-city-seeds";
    baseIssues.push({
      severity: "warning",
      code: "core-city-seed-fallback",
      message: localizeForRequest(
        options.request,
        `Live web research is unavailable for ${planningRequest.destination}, so planning used curated city seed POIs.`,
        `${planningRequest.destination} \u5f53\u524d\u65e0\u6cd5\u8fdb\u884c\u5b9e\u65f6\u8054\u7f51\u8c03\u7814\uff0c\u5df2\u6539\u7528\u5185\u7f6e\u57ce\u5e02\u79cd\u5b50\u70b9\u7ee7\u7eed\u89c4\u5212\u3002`
      ),
      source: "candidate-builder",
      suggestion: localizeForRequest(
        options.request,
        "Enable a compatible LLM or configure AMAP_API_KEY if you want fresher online candidates.",
        "\u5982\u9700\u66f4\u65b0\u7684\u5b9e\u65f6\u5019\u9009\u70b9\uff0c\u8bf7\u542f\u7528\u517c\u5bb9\u7684 LLM \u6216\u914d\u7f6e AMAP_API_KEY\u3002"
      )
    });
  }

  if (providerSearchError && geoProvider.name !== "wikimedia") {
    throw new Error(
      localizeForRequest(
        options.request,
        `Failed to collect candidate places from ${geoProvider.name}: ${providerSearchError instanceof Error ? providerSearchError.message : "Unknown error."}`,
        `从 ${geoProvider.name} 收集候选点失败：${providerSearchError instanceof Error ? providerSearchError.message : "未知错误。"}`
      )
    );
  }

  if (geoProvider.name === "wikimedia") {
    if (providerSearchError || candidates.length === 0) {
      if (coreCitySeeds.length > 0) {
        candidates = mergeCandidatePools(planningRequest.destination, candidates, coreCitySeeds);
        candidateSource = "core-city-seeds";
        baseIssues.push({
          severity: "warning",
          code: "core-city-seed-fallback",
              message: providerSearchError
            ? localizeForRequest(
                options.request,
                `Live online lookup for ${planningRequest.destination} failed, so planning fell back to curated city seed POIs: ${providerSearchError instanceof Error ? providerSearchError.message : "Unknown error."}`,
                `${planningRequest.destination} 的在线候选点检索失败，已改用内置城市种子点继续规划：${providerSearchError instanceof Error ? providerSearchError.message : "未知错误。"}`
              )
            : localizeForRequest(
                options.request,
                `Live online lookup returned no usable POIs for ${planningRequest.destination}, so planning used curated city seed POIs.`,
                `${planningRequest.destination} 的在线检索没有返回可用候选点，已改用内置城市种子点继续规划。`
              ),
          source: "candidate-builder",
          suggestion: localizeForRequest(
            options.request,
            "You can continue planning now. Re-plan later if you want fresher opening hours or more variety from live sources.",
            "当前可以先继续规划；如需更新的营业时间或更多实时候选点，稍后可再重排一次。"
          )
        });
      } else if (providerSearchError) {
        throw new Error(
          localizeForRequest(
            options.request,
            `Failed to collect candidate places from ${geoProvider.name}: ${providerSearchError instanceof Error ? providerSearchError.message : "Unknown error."}`,
            `从 ${geoProvider.name} 收集候选点失败：${providerSearchError instanceof Error ? providerSearchError.message : "未知错误。"}`
          )
        );
      }
    } else {
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

      if (coreCitySeeds.length > 0) {
        const missingInterestCoverageBeforeSeeds = getMissingInterestCoverage(options.request, candidates);
  const mergedCandidates = mergeCandidatePools(planningRequest.destination, candidates, coreCitySeeds);
        const missingInterestCoverageAfterSeeds = getMissingInterestCoverage(options.request, mergedCandidates);
        const repairedCoverageBySeeds =
          missingInterestCoverageAfterSeeds.length < missingInterestCoverageBeforeSeeds.length;
        const repairedDepthBySeeds =
          candidates.length < minimumUsableCandidateCount &&
          mergedCandidates.length >= minimumUsableCandidateCount;

        if (
          mergedCandidates.length > candidates.length &&
          (repairedCoverageBySeeds || repairedDepthBySeeds)
        ) {
          candidates = mergedCandidates;
          baseIssues.push({
            severity: "warning",
            code: "core-city-seed-supplement",
            message: repairedCoverageBySeeds
              ? localizeForRequest(
                  options.request,
                  `The live candidate set for ${planningRequest.destination} missed ${missingInterestCoverageBeforeSeeds.join(", ")}, so curated city seed POIs were merged in.`,
                  `${planningRequest.destination} 的在线候选点未覆盖这些兴趣：${missingInterestCoverageBeforeSeeds.join("、")}，已并入内置城市种子点补齐。`
                )
              : localizeForRequest(
                  options.request,
                  `The live candidate set for ${planningRequest.destination} was too thin for a stable itinerary, so curated city seed POIs were merged in.`,
                  `${planningRequest.destination} 的在线候选点数量偏薄，已并入内置城市种子点提高规划稳定性。`
                ),
            source: "candidate-builder",
            suggestion:
              missingInterestCoverageAfterSeeds.length === 0
                ? localizeForRequest(
                    options.request,
                    "Coverage is now stable, but you should still spot-check names and opening hours.",
                    "当前候选点覆盖已稳定，但仍建议抽查地点名称与营业时间。"
                  )
                : localizeForRequest(
                    options.request,
                    `Some interests are still thin after merging city seed POIs: ${missingInterestCoverageAfterSeeds.join(", ")}.`,
                    `并入内置城市种子点后，这些兴趣仍然偏弱：${missingInterestCoverageAfterSeeds.join("、")}。`
                  )
          });
        }
      }
    }
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
          planningRequest,
          options.llmConfig,
          desiredCandidateCount
        );

        if (llmCandidates.length > 0) {
          candidates = llmCandidates;
          candidates = sanitizeCandidatePool(planningRequest, candidates, baseIssues);
          if (candidates.length === 0) {
            throw new Error(
              localizeForRequest(
                options.request,
                "No map provider is configured, and the model only returned out-of-area POIs.",
                "当前未配置地图数据，模型返回的候选点全部偏离目的地。"
              )
            );
          }
          candidateSource = "llm-web-research";
          baseIssues.push({
            severity: "warning",
            code: "llm-web-research-source",
            message: localizeForRequest(
              options.request,
              "Map data is unavailable, so the configured LLM researched online sources to collect POI candidates.",
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

  const missingInterestCoverage = getMissingInterestCoverage(options.request, candidates);
  if (missingInterestCoverage.length > 0 && options.llmConfig?.enabled) {
    emit(options.onProgress, {
      stage: "candidates",
      message: localizeForRequest(
        options.request,
        `Candidate coverage is missing ${missingInterestCoverage.join(", ")}. Running a targeted model lookup to supplement those interests.`,
        `当前候选点缺少这些兴趣：${missingInterestCoverage.join("、")}，正在定向补充候选点。`
      )
    });

    try {
      const supplementalCandidates = await buildLlmCandidatePois(
        {
          ...planningRequest,
          interests: missingInterestCoverage,
          mustVisit: [],
          hotelArea: undefined,
          notes: undefined
        },
        options.llmConfig,
        Math.max(missingInterestCoverage.length * 4, 6),
        {
          fallbackGeoAnchor: getPoiCentroid(candidates)
        }
      );

      const previousCandidateCount = candidates.length;
       const mergedCandidates = mergeCandidatePools(
         planningRequest.destination,
         candidates,
         supplementalCandidates
       );
      const sanitizedMergedCandidates = sanitizeCandidatePool(
        planningRequest,
        mergedCandidates,
        baseIssues
      );

      if (sanitizedMergedCandidates.length > previousCandidateCount) {
        candidates = sanitizedMergedCandidates;

        candidateSource =
          previousCandidateCount === 0 && isModelResearchProvider
            ? "llm-web-research"
            : "hybrid-supplement";

        const remainingMissingInterests = getMissingInterestCoverage(options.request, candidates);
        const isPrimaryWebResearch = previousCandidateCount === 0 && isModelResearchProvider;
        baseIssues.push({
          severity: "warning",
          code: isPrimaryWebResearch ? "llm-web-research-source" : "interest-coverage-supplement",
          message: localizeForRequest(
            options.request,
            isPrimaryWebResearch
              ? "POI candidates were researched online by the configured LLM."
              : `The initial candidate set missed ${missingInterestCoverage.join(", ")}, so a targeted model supplement was added.`,
            `首轮候选点未覆盖这些兴趣：${missingInterestCoverage.join("、")}，已追加模型补点。`
          ),
          source: "candidate-builder",
          suggestion:
            remainingMissingInterests.length === 0
              ? localizeForRequest(
                  options.request,
                  isPrimaryWebResearch
                    ? "Spot-check names and opening hours, or configure AMAP_API_KEY if you need map-grade precision."
                    : "Coverage has been repaired, but you should still spot-check names and opening hours.",
                  "当前兴趣覆盖已补齐，但仍建议抽查地点名称与营业时间。"
                )
              : localizeForRequest(
                  options.request,
                  `Some interests are still thin after supplementation: ${remainingMissingInterests.join(", ")}.`,
                  `补点后这些兴趣仍然偏弱：${remainingMissingInterests.join("、")}。`
                )
        });
      }
    } catch (error) {
      baseIssues.push({
        severity: "warning",
        code: "interest-coverage-supplement-failed",
        message: localizeForRequest(
          options.request,
          `A targeted model supplement for ${missingInterestCoverage.join(", ")} failed: ${error instanceof Error ? error.message : "Unknown error."}`,
          `针对这些兴趣的定向补点失败：${missingInterestCoverage.join("、")}。${error instanceof Error ? error.message : "未知错误。"}`
        ),
        source: "candidate-builder",
        suggestion: localizeForRequest(
          options.request,
          "Try planning again, switch models, or simplify the requested interests.",
          "请重试规划、切换模型，或适当减少兴趣要求。"
        )
      });
    }
  }

  candidates = supplementCandidatesWithCoreCitySeeds({
    request: options.request,
    destination: planningRequest.destination,
    candidates,
    coreCitySeeds,
    minimumUsableCandidateCount,
    issues: baseIssues
  });

  if (candidates.length === 0) {
    throw new Error(
      localizeForRequest(
        options.request,
        isModelResearchProvider && options.llmConfig?.enabled
          ? "The LLM web researcher did not return any usable candidate places. Try another model, simplify the interests, or configure AMAP_API_KEY."
          : "No usable candidate places were found for this request. Adjust the destination or model settings and try again.",
        "没有找到可用的候选点，请调整目的地或模型配置后重试。"
      )
    );
  }

  const ranked = scoreCandidates(planningRequest, candidates);
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
        candidateSource === "llm-web-research" && isLikelyOllamaBaseUrl(options.llmConfig.baseUrl);

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
  const repairedItinerary = {
    ...repaired.itinerary,
    issues: mergedIssues
  };
  const enrichedItinerary = options.skipPoiImageEnrichment
    ? repairedItinerary
    : await enrichItineraryPoiImages(repairedItinerary);
  return {
    itinerary: enrichedItinerary,
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
    onProgress: options.onProgress,
    skipPoiImageEnrichment: true
  });

  const merged = mergeLockedItems(fresh.itinerary, collectLockedItems(options.currentItinerary));
  const enrichedItinerary = await enrichItineraryPoiImages({
    ...merged.itinerary,
    issues: merged.issues
  });

  return {
    itinerary: enrichedItinerary,
    issues: merged.issues
  };
}

export function validateEditedItinerary(itinerary: Itinerary) {
  return validateItinerary(itinerary);
}
