import type { CandidateScore } from "@/lib/planning/heuristics";
import type { TripRequest } from "@/lib/schemas/trip";

export function buildPlannerSystemPrompt() {
  return [
    "You are an itinerary planner.",
    "Use the provided candidate POIs and day buckets.",
    "Return structured JSON that matches the requested schema exactly.",
    "Respect locked constraints, opening-hour hints, and realistic travel pacing.",
    "Do not invent POIs outside the candidate list."
  ].join(" ");
}

export function buildPlannerUserPrompt(request: TripRequest, rankedPois: CandidateScore[]) {
  return JSON.stringify(
    {
      request,
      candidates: rankedPois.slice(0, request.days * 6).map(({ poi, score }) => ({
        id: poi.id,
        name: poi.name,
        address: poi.address,
        categories: poi.categories,
        recommendedDurationMinutes: poi.recommendedDurationMinutes,
        openingHoursText: poi.openingHoursText,
        score
      })),
      instructions: {
        perDayStopLimit:
          request.pace === "easy" ? 3 : request.pace === "packed" ? 5 : 4,
        includeLunchBreakHint: true
      }
    },
    null,
    2
  );
}

export function buildPoiResearchSystemPrompt() {
  return [
    "You are a travel POI researcher.",
    "Return real-world points of interest for the given destination and interests.",
    "Prefer famous, actually existing places over generic recommendations.",
    "Do not invent placeholder names, fake addresses, or synthetic identifiers.",
    "Return JSON only."
  ].join(" ");
}

export function buildPoiResearchUserPrompt(request: TripRequest, desiredCount: number) {
  return JSON.stringify(
    {
      destination: request.destination,
      interests: request.interests,
      mustVisit: request.mustVisit,
      hotelArea: request.hotelArea,
      notes: request.notes,
      desiredCount,
      requirements: {
        useRealPoisOnly: true,
        mixFoodAndSightseeing: true,
        includeApproximateCoordinates: true,
        avoidPlaceholderWords: ["推荐点", "示例地址", "poi 1", "spot 1"]
      }
    },
    null,
    2
  );
}
