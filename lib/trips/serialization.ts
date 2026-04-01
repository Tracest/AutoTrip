import type { Trip } from "@prisma/client";
import type { Itinerary, TripDetail, TripRequest, TripSummary } from "@/lib/schemas/trip";
import { itinerarySchema, tripRequestSchema } from "@/lib/schemas/trip";

type TripRecord = Pick<Trip, "id" | "title" | "destination" | "startDate" | "days" | "status" | "updatedAt"> & {
  request?: unknown;
  itinerary?: unknown;
};

export function serializeTripSummary(trip: TripRecord): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate.toISOString(),
    days: trip.days,
    status: trip.status,
    updatedAt: trip.updatedAt.toISOString()
  };
}

export function serializeTripDetail(trip: TripRecord & { request: unknown; itinerary: unknown }): TripDetail {
  return {
    ...serializeTripSummary(trip),
    request: tripRequestSchema.parse(trip.request) as TripRequest,
    itinerary: itinerarySchema.parse(trip.itinerary) as Itinerary
  };
}
