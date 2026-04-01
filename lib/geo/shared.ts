import type { Poi } from "@/lib/schemas/trip";
import type { TravelMatrixEntry } from "@/lib/geo/types";

export function haversineMinutes(from: Poi, to: Poi, speedKph = 22) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  const distance = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const minutes = Math.max(8, Math.round((distance / speedKph) * 60));
  return minutes;
}

export function buildFallbackMatrix(points: Poi[]) {
  const matrix: TravelMatrixEntry[] = [];

  for (const from of points) {
    for (const to of points) {
      if (from.id === to.id) continue;
      matrix.push({
        fromPoiId: from.id,
        toPoiId: to.id,
        minutes: haversineMinutes(from, to)
      });
    }
  }

  return matrix;
}

export function normalizeCategory(raw: string) {
  return raw
    .split(/[;|>]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
