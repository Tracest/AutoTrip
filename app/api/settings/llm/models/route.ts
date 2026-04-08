import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/guards";
import { listAvailableModels } from "@/lib/llm/openai-compatible";
import { getDefaultApiKeyForBaseUrl } from "@/lib/llm/provider-utils";
import { decryptString } from "@/lib/security/crypto";
import { jsonError, jsonOk } from "@/lib/utils/http";

const modelListSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional().default("")
});

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const payload = modelListSchema.parse(await request.json());
    const savedKeyMatchesBaseUrl = user.llmConfig?.baseUrl === payload.baseUrl;
    const apiKey =
      payload.apiKey.trim().length > 0
        ? payload.apiKey
        : savedKeyMatchesBaseUrl && user.llmConfig?.apiKeyEncrypted
          ? decryptString(user.llmConfig.apiKeyEncrypted)
          : getDefaultApiKeyForBaseUrl(payload.baseUrl);

    const result = await listAvailableModels({
      baseUrl: payload.baseUrl,
      apiKey
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError("Unable to load available models.", 400, error instanceof Error ? error.message : error);
  }
}
