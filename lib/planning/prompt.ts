import type { CandidateScore } from "@/lib/planning/heuristics";
import {
  getDefaultCountryForDestination,
  getDestinationAliases,
  shouldPreferChineseOutput
} from "@/lib/planning/destination";
import type { TripRequest } from "@/lib/schemas/trip";

function getPreferredLanguage(destination: string) {
  return shouldPreferChineseOutput(destination) ? "zh-CN" : "en";
}

function getLanguageInstructions(destination: string) {
  if (shouldPreferChineseOutput(destination)) {
    return {
      preferredLanguage: "zh-CN",
      languageRule:
        "For destinations in China, all POI names, addresses, day titles, categories, and notes must be in Simplified Chinese.",
      translationRule:
        'Do not keep English display names such as "The Bund" or "Shanghai Museum"; use their normal Chinese display names instead.',
      avoidAreaRule:
        "Do not use broad areas, roads, districts, neighborhoods, or towns as POIs unless they are actual tourist attractions."
    };
  }

  return {
    preferredLanguage: "en",
    languageRule: "Use the most common traveler-facing local display names.",
    translationRule: "Prefer stable real-world names over generic descriptions.",
    avoidAreaRule:
      "Do not use broad areas, roads, districts, neighborhoods, or towns as POIs unless they are actual tourist attractions."
  };
}

export function buildPlannerSystemPrompt() {
  return [
    "You are an itinerary planner.",
    "Use only the provided candidate POIs and day buckets.",
    "Return structured JSON that matches the requested schema exactly.",
    "Respect opening-hour hints, realistic travel pacing, and the trip's daily stop limit.",
    "Do not invent POIs outside the candidate list.",
    "If some details are uncertain, keep the heuristic structure and fill conservative times.",
    "Prefer preserving candidate IDs while improving names, titles, categories, and schedule details.",
    "If the request says the preferred language is zh-CN, all traveler-facing text must be Simplified Chinese."
  ].join(" ");
}

export function buildPlannerUserPrompt(request: TripRequest, rankedPois: CandidateScore[]) {
  const outputRules = getLanguageInstructions(request.destination);

  return JSON.stringify(
    {
      request,
      outputRequirements: {
        preferredLanguage: outputRules.preferredLanguage,
        languageRule: outputRules.languageRule,
        translationRule: outputRules.translationRule,
        avoidAreaRule: outputRules.avoidAreaRule,
        preserveCandidateIds: true
      },
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
    "Only return places physically located in the destination city or its immediate metro area.",
    "Prefer famous, actually existing places over generic recommendations.",
    "Do not invent placeholder names, fake addresses, or synthetic identifiers.",
    "Avoid hotels, apartment buildings, office towers, and purely generic labels unless the user explicitly asked for them.",
    "Do not use roads, districts, neighborhoods, financial districts, or broad areas as POIs unless they are true tourist attractions.",
    "If the request says the preferred language is zh-CN, output Simplified Chinese names and addresses.",
    "If you are unsure about an address or coordinate, omit that field instead of guessing.",
    "The top-level JSON must be an object with a `pois` array.",
    "Return JSON only."
  ].join(" ");
}

export function buildPoiResearchUserPrompt(request: TripRequest, desiredCount: number) {
  const destinationAliases = getDestinationAliases(request.destination);
  const outputRules = getLanguageInstructions(request.destination);

  return JSON.stringify(
    {
      destination: request.destination,
      destinationAliases,
      preferredLanguage: getPreferredLanguage(request.destination),
      interests: request.interests,
      mustVisit: request.mustVisit,
      hotelArea: request.hotelArea,
      notes: request.notes,
      desiredCount,
      requirements: {
        useRealPoisOnly: true,
        mixFoodAndSightseeing: true,
        includeApproximateCoordinatesIfKnown: true,
        includeAddressOnlyIfConfident: true,
        avoidPlaceholderWords: ["recommended spot", "sample address", "poi 1", "spot 1"],
        keepResultsInsideDestination: true,
        avoidHotelsAndAccommodation: true,
        avoidAreaLevelPlaces: true,
        outputLanguageRule: outputRules.languageRule,
        translationRule: outputRules.translationRule
      },
      responseShapeExample: {
        pois: [
          {
            name: shouldPreferChineseOutput(request.destination)
              ? "\u4e0a\u6d77\u535a\u7269\u9986"
              : "Sample Landmark",
            address: shouldPreferChineseOutput(request.destination)
              ? "\u4e0a\u6d77\u5e02\u9ec4\u6d66\u533a\u4eba\u6c11\u5927\u9053201\u53f7"
              : `${request.destination} central district`,
            city: request.destination,
            country: getDefaultCountryForDestination(request.destination),
            categories: request.interests.slice(0, 2),
            latitude: 26.57,
            longitude: 106.71,
            recommendedDurationMinutes: 90
          }
        ]
      }
    },
    null,
    2
  );
}

export function buildPoiVerifierSystemPrompt() {
  return [
    "You are vetting travel POI candidates.",
    "Keep only places you are reasonably confident are truly inside the requested destination city or metro area.",
    "Remove generic labels, hotels, residential buildings, roads, districts, neighborhoods, and broad areas that are not true POIs.",
    "Prefer culturally relevant landmarks, museums, food streets, parks, and real attractions.",
    "Preserve the original `id` exactly for every kept candidate.",
    "If the request says the preferred language is zh-CN, localize the kept POI names and addresses into Simplified Chinese.",
    "The top-level JSON must be an object with a `pois` array.",
    "Return JSON only."
  ].join(" ");
}

export function buildPoiVerifierUserPrompt(request: TripRequest, candidates: Array<Record<string, unknown>>) {
  const destinationAliases = getDestinationAliases(request.destination);
  const outputRules = getLanguageInstructions(request.destination);

  return JSON.stringify(
    {
      destination: request.destination,
      destinationAliases,
      preferredLanguage: getPreferredLanguage(request.destination),
      interests: request.interests,
      mustVisit: request.mustVisit,
      notes: request.notes,
      candidatePois: candidates,
      keepRules: {
        cityMustMatchDestination: true,
        removeAccommodation: true,
        removeGenericNames: true,
        removeAreaLevelPlaces: true,
        keepOnlyHighConfidenceMatches: true,
        preserveExistingIds: true,
        outputLanguageRule: outputRules.languageRule,
        translationRule: outputRules.translationRule
      },
      responseShapeExample: {
        pois: candidates.slice(0, 2)
      }
    },
    null,
    2
  );
}
