import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { itineraryDaySchema, itinerarySchema } from "@/lib/schemas/trip";
import { repairItinerary } from "@/lib/planning/validator";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { serializeTripDetail } from "@/lib/trips/serialization";

type Context = {
  params: {
    id: string;
  };
};

const updateItemsSchema = z.object({
  days: z.array(itineraryDaySchema)
});

export async function PATCH(request: Request, context: Context) {
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
    const payload = updateItemsSchema.parse(await request.json());
    const current = itinerarySchema.parse(trip.itinerary);
    const repaired = repairItinerary({
      ...current,
      days: payload.days
    });

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        itinerary: {
          ...repaired.itinerary,
          issues: repaired.issues
        },
        planningIssues: repaired.issues
      }
    });

    return jsonOk(
      serializeTripDetail({
        ...updated,
        request: trip.request,
        itinerary: {
          ...repaired.itinerary,
          issues: repaired.issues
        }
      })
    );
  } catch (error) {
    return jsonError("Unable to save itinerary edits.", 400, error instanceof Error ? error.message : error);
  }
}
