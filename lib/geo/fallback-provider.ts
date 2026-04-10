import { buildFallbackMatrix } from "@/lib/geo/shared";
import type { GeoProvider, GeoSearchParams, TravelMode } from "@/lib/geo/types";
import type { Poi } from "@/lib/schemas/trip";

export class FallbackGeoProvider implements GeoProvider {
  name = "fallback";
  capabilities = {
    supportsCountryFallback: true,
    supportsOpeningHours: false,
    accurateInternational: false
  };

  async searchPois(_params: GeoSearchParams): Promise<Poi[]> {
    return [];
  }

  async getPoiDetail(_poiId: string) {
    return null;
  }

  async getTravelMatrix(points: Poi[], _mode: TravelMode) {
    return buildFallbackMatrix(points);
  }

  async getOpeningHours(_poiId: string) {
    return undefined;
  }
}
