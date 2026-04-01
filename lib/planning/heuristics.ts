import { addDays, format, parseISO } from "date-fns";
import type { Itinerary, ItineraryDay, ItineraryItem, PlanningIssue, Poi, TripRequest } from "@/lib/schemas/trip";
import { itinerarySchema } from "@/lib/schemas/trip";
import { addMinutesToTime, clamp } from "@/lib/utils/time";
import type { TravelMatrixEntry } from "@/lib/geo/types";

export type CandidateScore = {
  poi: Poi;
  score: number;
};

export function scoreCandidates(request: TripRequest, pois: Poi[]) {
  const interestTerms = request.interests.map((interest) => interest.toLowerCase());
  const mustVisitTerms = request.mustVisit.map((poi) => poi.toLowerCase());

  return pois
    .map((poi) => {
      const interestScore = poi.categories.reduce((sum, category) => {
        return sum + (interestTerms.some((term) => category.toLowerCase().includes(term)) ? 6 : 0);
      }, 0);
      const mustVisitScore = mustVisitTerms.some((term) => poi.name.toLowerCase().includes(term)) ? 12 : 0;
      const balancedBonus =
        request.pace === "easy" ? -poi.recommendedDurationMinutes / 90 : poi.recommendedDurationMinutes / 120;

      return {
        poi,
        score: interestScore + mustVisitScore + balancedBonus + 10
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
  return (
    matrix.find((entry) => entry.fromPoiId === fromId && entry.toPoiId === toId)?.minutes ??
    matrix.find((entry) => entry.fromPoiId === toId && entry.toPoiId === fromId)?.minutes ??
    20
  );
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

  for (let dayIndex = 0; dayIndex < request.days; dayIndex += 1) {
    const dayPois = rankedPois
      .slice(dayIndex * capacity, dayIndex * capacity + capacity)
      .map((entry) => entry.poi);

    let currentTime = "09:00";
    let previousPoi: Poi | null = null;
    let totalTravelMinutes = 0;
    const items: ItineraryItem[] = dayPois.map((poi, itemIndex) => {
      const travelMinutes = previousPoi ? findTravelMinutes(travelMatrix, previousPoi.id, poi.id) : 0;
      totalTravelMinutes += travelMinutes;
      const startTime = addMinutesToTime(currentTime, travelMinutes);
      const durationMinutes = clamp(poi.recommendedDurationMinutes, 60, request.pace === "packed" ? 150 : 120);
      const endTime = addMinutesToTime(startTime, durationMinutes);
      currentTime = itemIndex === 1 ? addMinutesToTime(endTime, 60) : addMinutesToTime(endTime, 20);
      previousPoi = poi;

      return {
        id: `${format(addDays(start, dayIndex), "yyyyMMdd")}-${poi.id}`,
        poi,
        category: poi.categories[0] ?? "景点",
        startTime,
        endTime,
        durationMinutes,
        travelMinutesFromPrevious: travelMinutes,
        locked: false,
        notes: itemIndex === 1 ? "建议在附近安排午餐或咖啡休息。" : undefined
      };
    });

    days.push({
      date: format(addDays(start, dayIndex), "yyyy-MM-dd"),
      title: dayIndex === 0 ? "抵达与城市打开方式" : `第 ${dayIndex + 1} 天游玩`,
      totalTravelMinutes,
      intensityScore: clamp((items.length * 2 + totalTravelMinutes / 45) / 1.2, 1, 9.5),
      items
    });
  }

  return itinerarySchema.parse({
    request,
    days,
    issues,
    metadata
  });
}
