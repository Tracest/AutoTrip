import { prisma } from "@/lib/db/prisma";
import { requireAdminUser } from "@/lib/auth/guards";
import { llmSettingsSchema, type LlmSettingsResponse } from "@/lib/schemas/llm";
import { encryptString } from "@/lib/security/crypto";
import { jsonError, jsonOk } from "@/lib/utils/http";

export async function GET() {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const config: LlmSettingsResponse = user.llmConfig
    ? {
        configured: true,
        baseUrl: user.llmConfig.baseUrl,
        model: user.llmConfig.model,
        apiStyle: "openai",
        temperature: user.llmConfig.temperature,
        enabled: user.llmConfig.enabled
      }
    : {
        configured: false
      };

  return jsonOk(config);
}

export async function PUT(request: Request) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const payload = llmSettingsSchema.parse(await request.json());
    const encryptedKey =
      payload.apiKey.trim().length > 0
        ? encryptString(payload.apiKey)
        : user.llmConfig?.apiKeyEncrypted;

    if (!encryptedKey) {
      return jsonError("API key is required the first time you save the LLM settings.", 400);
    }

    const updated = await prisma.llmProviderConfig.upsert({
      where: {
        ownerId: user.id
      },
      create: {
        ownerId: user.id,
        baseUrl: payload.baseUrl,
        apiKeyEncrypted: encryptedKey,
        model: payload.model,
        apiStyle: payload.apiStyle,
        temperature: payload.temperature,
        enabled: payload.enabled
      },
      update: {
        baseUrl: payload.baseUrl,
        apiKeyEncrypted: encryptedKey,
        model: payload.model,
        apiStyle: payload.apiStyle,
        temperature: payload.temperature,
        enabled: payload.enabled
      }
    });

    return jsonOk({
      configured: true,
      baseUrl: updated.baseUrl,
      model: updated.model,
      temperature: updated.temperature,
      apiStyle: "openai",
      enabled: updated.enabled
    });
  } catch (error) {
    return jsonError("Unable to save LLM settings.", 400, error instanceof Error ? error.message : error);
  }
}
