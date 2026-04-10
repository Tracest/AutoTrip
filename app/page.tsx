import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { isLikelyOllamaBaseUrl } from "@/lib/llm/provider-utils";
import { enrichItineraryPoiImages } from "@/lib/planning/poi-images";
import { serializeTripDetail, serializeTripSummary } from "@/lib/trips/serialization";
import type { LlmSettingsResponse } from "@/lib/schemas/llm";
import type { TripDetail } from "@/lib/schemas/trip";
import { DashboardClient } from "@/components/dashboard-client";

export default async function HomePage() {
  const user = await requireAdminUser();
  if (!user) {
    redirect("/login");
  }

  const [trips, latestTrip] = await Promise.all([
    prisma.trip.findMany({
      where: {
        ownerId: user.id
      },
      select: {
        id: true,
        title: true,
        destination: true,
        startDate: true,
        days: true,
        status: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 12
    }),
    prisma.trip.findFirst({
      where: {
        ownerId: user.id
      },
      select: {
        id: true,
        title: true,
        destination: true,
        startDate: true,
        days: true,
        status: true,
        updatedAt: true,
        request: true,
        itinerary: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    })
  ]);
  let initialSelectedTrip: TripDetail | null = null;

  if (latestTrip) {
    const detail = serializeTripDetail(latestTrip);
    initialSelectedTrip = {
      ...detail,
      itinerary: await enrichItineraryPoiImages(detail.itinerary)
    };
  }

  const initialConfig: LlmSettingsResponse = user.llmConfig
    ? {
      configured: true,
      baseUrl: user.llmConfig.baseUrl,
      model: user.llmConfig.model,
      apiStyle: "openai",
      temperature: user.llmConfig.temperature,
      enabled: user.llmConfig.enabled,
      hasApiKey: !isLikelyOllamaBaseUrl(user.llmConfig.baseUrl),
      apiKeyOptional: isLikelyOllamaBaseUrl(user.llmConfig.baseUrl)
    }
  : {
      configured: false
    };

  return (
    <DashboardClient
      userEmail={user.email}
      initialConfig={initialConfig}
      initialTrips={trips.map(serializeTripSummary)}
      initialSelectedTrip={initialSelectedTrip}
    />
  );
}
