import { addDays, format, parseISO } from "date-fns";
import type { TravelMatrixEntry } from "@/lib/geo/types";
import { normalizeDestinationTerm, shouldPreferChineseOutput } from "@/lib/planning/destination";
import {
  getPoiBuckets,
  getPoiPrimaryBucket,
  getPoiQualityScore,
  type PoiBucket
} from "@/lib/planning/poi-signals";
import { itinerarySchema } from "@/lib/schemas/trip";
import type {
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  PlanningIssue,
  Poi,
  TripRequest
} from "@/lib/schemas/trip";
import { addMinutesToTime, clamp } from "@/lib/utils/time";

export type CandidateScore = {
  poi: Poi;
  score: number;
};

const defaultCategoryLabel = "景点";
const lunchBreakNote = "建议在附近安排午餐或咖啡休息。";
const firstDayTitle = "城市经典初印象";
const maxLegTravelMinutes = 300;
const categoryLocalizationMap = new Map<string, string>([
  ["history", "历史"],
  ["historic", "历史"],
  ["culture", "人文"],
  ["museum", "博物馆"],
  ["museums", "博物馆"],
  ["food", "美食"],
  ["foods", "美食"],
  ["restaurant", "美食"],
  ["restaurants", "美食"],
  ["nightview", "夜景"],
  ["nightviews", "夜景"],
  ["nightlife", "夜生活"],
  ["shopping", "逛街"],
  ["architecture", "建筑"],
  ["park", "公园"],
  ["parks", "公园"],
  ["nature", "自然"],
  ["family", "亲子"],
  ["landmark", "地标"],
  ["landmarks", "地标"]
]);

const bucketLabelMap: Record<PoiBucket, { zh: string; en: string }> = {
  culture: { zh: "历史", en: "History" },
  food: { zh: "美食", en: "Food" },
  night: { zh: "夜景", en: "Night View" },
  nature: { zh: "自然", en: "Nature" },
  other: { zh: defaultCategoryLabel, en: "Sight" }
};

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase();
}

function uniqueBuckets(values: PoiBucket[]) {
  return Array.from(new Set(values));
}

function getMealSlotIndex(dayCount: number) {
  return dayCount >= 5 ? 2 : dayCount >= 3 ? 1 : -1;
}

function getRequestedBuckets(request: TripRequest) {
  return new Set<PoiBucket>(
    request.interests.flatMap((interest) =>
      getPoiBuckets({
        name: interest,
        address: "",
        categories: [interest],
        openingHoursText: undefined
      }).filter((bucket) => bucket !== "other")
    )
  );
}

function bucketMatchesPreference(poi: Poi, bucket: PoiBucket) {
  return getPoiBuckets(poi).includes(bucket);
}

function getBucketPreferenceRank(poi: Poi, buckets: PoiBucket[]) {
  const poiBuckets = getPoiBuckets(poi);
  let bestRank = buckets.length;

  for (const bucket of poiBuckets) {
    const rank = buckets.indexOf(bucket);
    if (rank !== -1) {
      bestRank = Math.min(bestRank, rank);
    }
  }

  return bestRank;
}

function matchesInterestText(category: string, interest: string) {
  const normalizedCategory = normalizeCategoryKey(category);
  const normalizedInterest = normalizeCategoryKey(interest);

  if (!normalizedCategory || !normalizedInterest) {
    return false;
  }

  if (
    normalizedCategory.includes(normalizedInterest) ||
    normalizedInterest.includes(normalizedCategory)
  ) {
    return true;
  }

  const categoryBuckets = getPoiBuckets({
    name: category,
    address: "",
    categories: [category],
    openingHoursText: undefined
  });
  const interestBuckets = getPoiBuckets({
    name: interest,
    address: "",
    categories: [interest],
    openingHoursText: undefined
  });

  return categoryBuckets.some((bucket) => bucket !== "other" && interestBuckets.includes(bucket));
}

function getBucketDisplayLabel(destination: string, bucket: PoiBucket) {
  return shouldPreferChineseOutput(destination) ? bucketLabelMap[bucket].zh : bucketLabelMap[bucket].en;
}

export function localizeCategoryLabel(destination: string, category?: string) {
  if (!category) {
    return defaultCategoryLabel;
  }

  if (!shouldPreferChineseOutput(destination)) {
    return category;
  }

  return categoryLocalizationMap.get(normalizeCategoryKey(category)) ?? category;
}

function getPoiDisplayCategory(destination: string, poi: Poi) {
  const primaryBucket = getPoiPrimaryBucket(poi);
  if (primaryBucket === "food" || primaryBucket === "night") {
    return getBucketDisplayLabel(destination, primaryBucket);
  }

  const localizedCategory = poi.categories
    .map((category) => localizeCategoryLabel(destination, category))
    .find(Boolean);

  if (localizedCategory) {
    return localizedCategory;
  }

  return getBucketDisplayLabel(destination, getPoiPrimaryBucket(poi));
}

function getFocusCategories(request: TripRequest, dayPois: Poi[]) {
  return Array.from(new Set(dayPois.map((poi) => getPoiDisplayCategory(request.destination, poi)).filter(Boolean))).slice(
    0,
    2
  );
}

export function scoreCandidates(request: TripRequest, pois: Poi[]) {
  const interestTerms = request.interests;
  const mustVisitTerms = request.mustVisit.map((poi) => normalizeDestinationTerm(poi));
  const requestedBuckets = getRequestedBuckets(request);

  return pois
    .map((poi) => {
      const interestScore = poi.categories.reduce((sum, category) => {
        return sum + (interestTerms.some((interest) => matchesInterestText(category, interest)) ? 6 : 0);
      }, 0);
      const bucketScore = getPoiBuckets(poi).reduce((sum, bucket) => {
        return sum + (requestedBuckets.has(bucket) ? 5 : 0);
      }, 0);
      const mustVisitScore = mustVisitTerms.some((term) =>
        normalizeDestinationTerm(poi.name).includes(term)
      )
        ? 14
        : 0;
      const balancedBonus =
        request.pace === "easy"
          ? -poi.recommendedDurationMinutes / 90
          : poi.recommendedDurationMinutes / 120;
      const qualityScore = getPoiQualityScore(request.destination, poi);

      return {
        poi,
        score: interestScore + bucketScore + mustVisitScore + qualityScore + balancedBonus + 10
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function getDailyCapacity(pace: TripRequest["pace"]) {
  switch (pace) {
    case "easy":
      return 3;
    case "packed":
      return 5;
    default:
      return 4;
  }
}

function findTravelMinutes(matrix: TravelMatrixEntry[], fromId: string, toId: string) {
  const rawMinutes =
    matrix.find((entry) => entry.fromPoiId === fromId && entry.toPoiId === toId)?.minutes ??
    matrix.find((entry) => entry.fromPoiId === toId && entry.toPoiId === fromId)?.minutes ??
    20;

  if (!Number.isFinite(rawMinutes)) {
    return 20;
  }

  return clamp(Math.round(rawMinutes), 0, maxLegTravelMinutes);
}

function getDayTitle(request: TripRequest, dayIndex: number, dayPois: Poi[]) {
  const focusCategories = getFocusCategories(request, dayPois);
  const focusSummary = focusCategories.join(" / ");

  if (!focusSummary) {
    return dayIndex === 0 ? firstDayTitle : `第 ${dayIndex + 1} 天主题游`;
  }

  if (dayIndex === 0) {
    return `${focusSummary}初印象`;
  }

  return `${focusSummary}主题线`;
}

function buildCoreBucketPreference(request: TripRequest, available: CandidateScore[]) {
  const requestedBuckets = getRequestedBuckets(request);
  const availableBuckets = new Set(available.flatMap((entry) => getPoiBuckets(entry.poi)));
  const preferred: PoiBucket[] = [];

  for (const bucket of ["culture", "nature", "other"] as const) {
    if (bucket === "other" || requestedBuckets.has(bucket) || availableBuckets.has(bucket)) {
      preferred.push(bucket);
    }
  }

  return uniqueBuckets(preferred.length > 0 ? preferred : ["other"]);
}

function buildDaySlotPreferences(
  request: TripRequest,
  dayCount: number,
  available: CandidateScore[]
) {
  const core = buildCoreBucketPreference(request, available);
  const hasFood = available.some((entry) => bucketMatchesPreference(entry.poi, "food"));
  const hasNight = available.some((entry) => bucketMatchesPreference(entry.poi, "night"));
  const mealSlotIndex = getMealSlotIndex(dayCount);

  return Array.from({ length: dayCount }, (_, slotIndex) => {
    if (slotIndex === 0) {
      return core;
    }

    if (slotIndex === dayCount - 1) {
      return uniqueBuckets(hasNight ? ["night", "food", ...core] : ["food", ...core, "night"]);
    }

    if (slotIndex === mealSlotIndex) {
      return uniqueBuckets(hasFood ? ["food", ...core, "night"] : [...core, "food", "night"]);
    }

    return uniqueBuckets([...core, "food", "night"]);
  });
}

function rankCandidateForSlot(
  candidate: CandidateScore,
  slotIndex: number,
  dayCount: number,
  selected: CandidateScore[],
  remaining: CandidateScore[],
  slotPreferences: PoiBucket[],
  travelMatrix: TravelMatrixEntry[]
) {
  const primaryBucket = getPoiPrimaryBucket(candidate.poi);
  const preferenceRank = getBucketPreferenceRank(candidate.poi, slotPreferences);
  const mealSlotIndex = getMealSlotIndex(dayCount);
  const previous = selected.at(-1)?.poi;
  const hasUnusedNight = remaining.some(
    (entry) => entry.poi.id !== candidate.poi.id && bucketMatchesPreference(entry.poi, "night")
  );
  const hasUnusedFood = remaining.some(
    (entry) => entry.poi.id !== candidate.poi.id && bucketMatchesPreference(entry.poi, "food")
  );

  let score = candidate.score * 100 + (slotPreferences.length - preferenceRank) * 18;

  if (previous) {
    score -= findTravelMinutes(travelMatrix, previous.id, candidate.poi.id) * 0.8;
    if (getPoiPrimaryBucket(previous) === primaryBucket) {
      score -= 12;
    }
  }

  if (selected.some((entry) => getPoiPrimaryBucket(entry.poi) === primaryBucket)) {
    score -= 6;
  }
  if (slotIndex === 0 && primaryBucket === "food") {
    score -= 20;
  }
  if (slotIndex < dayCount - 1 && primaryBucket === "night") {
    score -= 58;
  }
  if (slotIndex === dayCount - 1 && primaryBucket === "night") {
    score += 36;
  }
  if (slotIndex === mealSlotIndex && primaryBucket === "food") {
    score += 42;
  }
  if (slotIndex === mealSlotIndex && primaryBucket !== "food" && hasUnusedFood) {
    score -= 24;
  }
  if (slotIndex === dayCount - 1 && primaryBucket !== "night" && hasUnusedNight) {
    score -= 28;
  }

  return score;
}

function selectDayCandidates(
  request: TripRequest,
  pool: CandidateScore[],
  dayCount: number,
  travelMatrix: TravelMatrixEntry[]
) {
  const remaining = [...pool];
  const selected: CandidateScore[] = [];
  const slotPreferences = buildDaySlotPreferences(request, dayCount, remaining);
  const reservedBySlot = new Map<number, CandidateScore>();
  const mealSlotIndex = getMealSlotIndex(dayCount);

  if (dayCount > 1) {
    const nightCandidates = remaining
      .map((candidate, index) => ({ candidate, index }))
      .filter((entry) => bucketMatchesPreference(entry.candidate.poi, "night"))
      .sort((left, right) => right.candidate.score - left.candidate.score);

    const reservedNight = nightCandidates[0];
    if (reservedNight && reservedNight.candidate.score >= 30) {
      reservedBySlot.set(dayCount - 1, remaining.splice(reservedNight.index, 1)[0]);
    }
  }

  if (mealSlotIndex !== -1 && mealSlotIndex !== dayCount - 1) {
    const foodCandidates = remaining
      .map((candidate, index) => ({ candidate, index }))
      .filter((entry) => bucketMatchesPreference(entry.candidate.poi, "food"))
      .sort((left, right) => right.candidate.score - left.candidate.score);

    const reservedFood = foodCandidates[0];
    if (reservedFood) {
      reservedBySlot.set(mealSlotIndex, remaining.splice(reservedFood.index, 1)[0]);
    }
  }

  for (let slotIndex = 0; slotIndex < dayCount; slotIndex += 1) {
    const reservedCandidate = reservedBySlot.get(slotIndex);
    if (reservedCandidate) {
      selected.push(reservedCandidate);
      continue;
    }

    if (remaining.length === 0) {
      break;
    }

    const preferences = slotPreferences[slotIndex] ?? ["culture", "nature", "other", "food", "night"];
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let candidateIndex = 0; candidateIndex < remaining.length; candidateIndex += 1) {
      const score = rankCandidateForSlot(
        remaining[candidateIndex],
        slotIndex,
        dayCount,
        selected,
        remaining,
        preferences,
        travelMatrix
      );

      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return {
    selected,
    remaining
  };
}

function getDayItemCount(remainingCount: number, remainingDays: number, capacity: number) {
  if (remainingCount <= 0) {
    return 0;
  }

  return Math.min(capacity, Math.ceil(remainingCount / remainingDays));
}

export function buildHeuristicItinerary(
  request: TripRequest,
  rankedPois: CandidateScore[],
  travelMatrix: TravelMatrixEntry[],
  metadata: Itinerary["metadata"],
  issues: PlanningIssue[] = []
) {
  const start = parseISO(request.startDate);
  const capacity = getDailyCapacity(request.pace);
  const days: ItineraryDay[] = [];
  let remaining = [...rankedPois];

  for (let dayIndex = 0; dayIndex < request.days; dayIndex += 1) {
    const remainingDays = request.days - dayIndex;
    const dayCount = getDayItemCount(remaining.length, remainingDays, capacity);
    const { selected, remaining: rest } = selectDayCandidates(
      request,
      remaining,
      dayCount,
      travelMatrix
    );
    const dayPois = selected.map((entry) => entry.poi);
    const mealSlotIndex = getMealSlotIndex(dayPois.length);
    let currentTime = "09:00";
    let previousPoi: Poi | null = null;
    let totalTravelMinutes = 0;

    const items: ItineraryItem[] = dayPois.map((poi, itemIndex) => {
      const travelMinutes = previousPoi ? findTravelMinutes(travelMatrix, previousPoi.id, poi.id) : 0;
      totalTravelMinutes += travelMinutes;
      const startTime = addMinutesToTime(currentTime, travelMinutes);
      const maxDuration =
        itemIndex === dayPois.length - 1 && getPoiPrimaryBucket(poi) === "night"
          ? request.pace === "packed"
            ? 150
            : 100
          : request.pace === "packed"
            ? 150
            : 120;
      const durationMinutes = clamp(poi.recommendedDurationMinutes, 60, maxDuration);
      const endTime = addMinutesToTime(startTime, durationMinutes);
      const gapAfter = itemIndex === mealSlotIndex ? 60 : itemIndex === dayPois.length - 1 ? 0 : 20;
      currentTime = addMinutesToTime(endTime, gapAfter);
      previousPoi = poi;

      return {
        id: `${format(addDays(start, dayIndex), "yyyyMMdd")}-${poi.id}`,
        poi,
        category: getPoiDisplayCategory(request.destination, poi),
        startTime,
        endTime,
        durationMinutes,
        travelMinutesFromPrevious: travelMinutes,
        locked: false,
        notes: itemIndex === mealSlotIndex ? lunchBreakNote : undefined
      };
    });

    days.push({
      date: format(addDays(start, dayIndex), "yyyy-MM-dd"),
      title: getDayTitle(request, dayIndex, dayPois),
      totalTravelMinutes,
      intensityScore: clamp((items.length * 2 + totalTravelMinutes / 45) / 1.2, 1, 9.5),
      items
    });

    remaining = rest;
  }

  return itinerarySchema.parse({
    request,
    days,
    issues,
    metadata
  });
}
