import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { itinerarySchema, tripRequestSchema } from "@/lib/schemas/trip";
import { replanUnlockedSegments } from "@/lib/planning/engine";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { serializeTripDetail } from "@/lib/trips/serialization";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: Context) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const trip = await prisma.trip.findFirst({
    where: {
      id: context.params.id,
      ownerId: user.id
    }
  });

  if (!trip) {
    return jsonError("Trip not found.", 404);
  }

  try {
    const itinerary = itinerarySchema.parse(trip.itinerary);
    const request = tripRequestSchema.parse(trip.request);
    const replanned = await replanUnlockedSegments({
      request,
      currentItinerary: itinerary,
      llmConfig: user.llmConfig
    });

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        itinerary: {
          ...replanned.itinerary,
          issues: replanned.issues
        },
        planningIssues: replanned.issues,
        lastPlannedAt: new Date(),
        status: "READY"
      }
    });

    return jsonOk(
      serializeTripDetail({
        ...updated,
        request: trip.request,
        itinerary: {
          ...replanned.itinerary,
          issues: replanned.issues
        }
      })
    );
  } catch (error) {
    return jsonError("Unable to re-plan unlocked items.", 400, error instanceof Error ? error.message : error);
  }
}
