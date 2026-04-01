import type { Poi } from "@/lib/schemas/trip";
import type { GeoProvider, GeoSearchParams, TravelMode } from "@/lib/geo/types";
import { buildFallbackMatrix, normalizeCategory } from "@/lib/geo/shared";

type AmapPlace = {
  id?: string;
  name?: string;
  address?: string;
  cityname?: string;
  type?: string;
  location?: string;
  business_area?: string;
  opentime_today?: string;
  opentime_week?: string;
};

function createUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://restapi.amap.com/v3/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function parseLocation(location?: string) {
  if (!location) return null;
  const [lng, lat] = location.split(",").map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { latitude: lat, longitude: lng };
}

function toPoi(place: AmapPlace, destination: string, fallbackTag: string): Poi | null {
  const coords = parseLocation(place.location);
  if (!coords || !place.id || !place.name) {
    return null;
  }

  return {
    id: place.id,
    name: place.name,
    address: place.address ?? place.business_area ?? destination,
    city: place.cityname || destination,
    country: "CN",
    categories: normalizeCategory(place.type ?? fallbackTag),
    latitude: coords.latitude,
    longitude: coords.longitude,
    recommendedDurationMinutes: 90,
    openingHoursText: place.opentime_today ?? place.opentime_week
  };
}

export class AmapProvider implements GeoProvider {
  constructor(private apiKey: string) {}

  name = "amap";
  capabilities = {
    supportsCountryFallback: true,
    supportsOpeningHours: true,
    accurateInternational: false
  };

  async searchPois(params: GeoSearchParams) {
    const results: Poi[] = [];

    for (const tag of params.tags) {
      const response = await fetch(
        createUrl("place/text", {
          key: this.apiKey,
          keywords: `${params.destination} ${tag}`,
          city: params.destination,
          children: "1",
          offset: "6",
          extensions: "all"
        }),
        { next: { revalidate: 60 * 60 } }
      );

      if (!response.ok) {
        continue;
      }

      const json = (await response.json()) as { pois?: AmapPlace[] };
      for (const poi of json.pois ?? []) {
        const normalized = toPoi(poi, params.destination, tag);
        if (normalized) {
          results.push(normalized);
        }
      }
    }

    return dedupePois(results);
  }

  async getPoiDetail(poiId: string) {
    const response = await fetch(
      createUrl("place/detail", {
        key: this.apiKey,
        id: poiId,
        extensions: "all"
      }),
      { next: { revalidate: 60 * 60 } }
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as { pois?: AmapPlace[] };
    return toPoi(json.pois?.[0] ?? {}, "目的地", "景点");
  }

  async getTravelMatrix(points: Poi[], mode: TravelMode) {
    if (points.length < 2) return [];

    const origins = points.map((point) => `${point.longitude},${point.latitude}`).join("|");
    const destination = `${points[0]?.longitude},${points[0]?.latitude}`;
    const type = mode === "walking" ? "3" : mode === "transit" ? "0" : "1";

    const response = await fetch(
      createUrl("distance", {
        key: this.apiKey,
        origins,
        destination,
        type
      }),
      { cache: "no-store" }
    );

    if (!response.ok) {
      return buildFallbackMatrix(points);
    }

    const json = (await response.json()) as {
      results?: Array<{ distance?: string; duration?: string }>;
    };

    const matrix = buildFallbackMatrix(points);
    const results = json.results ?? [];

    for (let index = 1; index < points.length; index += 1) {
      const result = results[index - 1];
      const matching = matrix.find(
        (entry) => entry.fromPoiId === points[index].id && entry.toPoiId === points[0].id
      );

      if (!matching || !result?.duration) continue;
      matching.minutes = Math.max(5, Math.round(Number(result.duration) / 60));
    }

    return matrix;
  }

  async getOpeningHours(poiId: string) {
    const detail = await this.getPoiDetail(poiId);
    return detail?.openingHoursText;
  }
}

function dedupePois(pois: Poi[]) {
  const seen = new Set<string>();
  return pois.filter((poi) => {
    if (seen.has(poi.id)) return false;
    seen.add(poi.id);
    return true;
  });
}
