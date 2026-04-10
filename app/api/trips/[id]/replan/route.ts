import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { itinerarySchema, planningTripRequestSchema } from "@/lib/schemas/trip";
import { replanUnlockedSegments } from "@/lib/planning/engine";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { serializeTripDetail } from "@/lib/trips/serialization";
import { ZodError } from "zod";

type Context = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: Context) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("未授权访问。", 401);
  }

  const trip = await prisma.trip.findFirst({
    where: {
      id: context.params.id,
      ownerId: user.id
    }
  });

  if (!trip) {
    return jsonError("未找到该行程。", 404);
  }

  try {
    const itinerary = itinerarySchema.parse(trip.itinerary);
    const request = planningTripRequestSchema.parse(trip.request);
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
    if (
      error instanceof ZodError &&
      error.issues.some((issue) => issue.path[0] === "destination")
    ) {
      return jsonError("当前仅支持已收录城市的一键重排，请重新创建支持城市的行程。", 400, error.issues);
    }

    return jsonError("重排行程失败。", 400, error instanceof Error ? error.message : error);
  }
}
