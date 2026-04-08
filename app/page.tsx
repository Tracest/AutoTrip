import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { isLikelyOllamaBaseUrl } from "@/lib/llm/provider-utils";
import { serializeTripSummary } from "@/lib/trips/serialization";
import type { LlmSettingsResponse } from "@/lib/schemas/llm";
import { DashboardClient } from "@/components/dashboard-client";

export default async function HomePage() {
  const user = await requireAdminUser();
  if (!user) {
    redirect("/login");
  }

  const trips = await prisma.trip.findMany({
    where: {
      ownerId: user.id
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 12
  });

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
    />
  );
}
