import type { Poi } from "@/lib/schemas/trip";
import { buildFallbackMatrix } from "@/lib/geo/shared";
import type { GeoProvider, GeoSearchParams, TravelMode } from "@/lib/geo/types";
import { getDefaultCountryForDestination } from "@/lib/planning/destination";

function buildMockPoi(destination: string, tag: string, index: number): Poi {
  const baseLat = 31.2304 + index * 0.012;
  const baseLng = 121.4737 + index * 0.01;

  return {
    id: `${destination}-${tag}-${index}`,
    name: `${destination} ${tag} sample spot ${index + 1}`,
    address: `${destination} sample address ${index + 1}`,
    city: destination,
    country: getDefaultCountryForDestination(destination),
    categories: [tag],
    latitude: baseLat,
    longitude: baseLng,
    recommendedDurationMinutes: 90 + index * 15,
    openingHoursText: "09:00-18:00"
  };
}

export class MockGeoProvider implements GeoProvider {
  name = "mock";
  capabilities = {
    supportsCountryFallback: true,
    supportsOpeningHours: true,
    accurateInternational: false
  };

  async searchPois(params: GeoSearchParams) {
    return params.tags.flatMap((tag, tagIndex) =>
      Array.from({ length: 3 }, (_, index) =>
        buildMockPoi(params.destination, tag, tagIndex * 3 + index)
      )
    );
  }

  async getPoiDetail(poiId: string) {
    const [destination] = poiId.split("-");
    return buildMockPoi(destination ?? "destination", "landmark", 0);
  }

  async getTravelMatrix(points: Poi[], _mode: TravelMode) {
    return buildFallbackMatrix(points);
  }

  async getOpeningHours(_poiId: string) {
    return "09:00-18:00";
  }
}
