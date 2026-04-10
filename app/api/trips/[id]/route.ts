import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { enrichItineraryPoiImages } from "@/lib/planning/poi-images";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { serializeTripDetail } from "@/lib/trips/serialization";

type Context = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: Context) {
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

  const detail = serializeTripDetail(trip);
  const itinerary = await enrichItineraryPoiImages(detail.itinerary);

  return jsonOk({
    ...detail,
    itinerary
  });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("未授权访问。", 401);
  }

  const deleted = await prisma.trip.deleteMany({
    where: {
      id: context.params.id,
      ownerId: user.id
    }
  });

  if (deleted.count === 0) {
    return jsonError("未找到该行程。", 404);
  }

  return jsonOk({
    deleted: true,
    id: context.params.id
  });
}
