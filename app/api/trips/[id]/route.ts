import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
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

  return jsonOk(serializeTripDetail(trip));
}
