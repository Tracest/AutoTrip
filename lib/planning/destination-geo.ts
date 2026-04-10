import { haversineDistanceKm } from "@/lib/geo/shared";
import { getCoreCitySeedPois } from "@/lib/planning/core-city-seeds";
import type { Poi } from "@/lib/schemas/trip";

type GeoPoint = Pick<Poi, "latitude" | "longitude">;

export const maxDestinationPoiDistanceKm = 80;

function hasFiniteCoordinates(point: GeoPoint) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

function getPoiCentroid(pois: GeoPoint[]) {
  const validPois = pois.filter(hasFiniteCoordinates);

  if (validPois.length === 0) {
    return undefined;
  }

  return {
    latitude: validPois.reduce((sum, poi) => sum + poi.latitude, 0) / validPois.length,
    longitude: validPois.reduce((sum, poi) => sum + poi.longitude, 0) / validPois.length
  };
}

export function getDestinationGeoAnchor(destination: string) {
  return getPoiCentroid(getCoreCitySeedPois(destination));
}

export function getPoiDistanceFromDestination(destination: string, poi: GeoPoint) {
  const anchor = getDestinationGeoAnchor(destination);

  if (!anchor || !hasFiniteCoordinates(poi)) {
    return null;
  }

  return haversineDistanceKm(anchor, poi);
}

export function partitionDestinationOutlierPois(
  destination: string,
  pois: Poi[],
  maxDistanceKm = maxDestinationPoiDistanceKm
) {
  const anchor = getDestinationGeoAnchor(destination);

  if (!anchor) {
    return {
      anchor: undefined,
      kept: [...pois],
      dropped: [] as Array<{ poi: Poi; distanceKm: number }>
    };
  }

  const kept: Poi[] = [];
  const dropped: Array<{ poi: Poi; distanceKm: number }> = [];

  for (const poi of pois) {
    if (!hasFiniteCoordinates(poi)) {
      kept.push(poi);
      continue;
    }

    const distanceKm = haversineDistanceKm(anchor, poi);
    if (distanceKm > maxDistanceKm) {
      dropped.push({ poi, distanceKm });
      continue;
    }

    kept.push(poi);
  }

  return {
    anchor,
    kept,
    dropped
  };
}
