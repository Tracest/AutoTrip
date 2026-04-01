import { llmTestSchema } from "@/lib/schemas/llm";
import { testOpenAICompatibleConnection } from "@/lib/llm/openai-compatible";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { requireAdminUser } from "@/lib/auth/guards";
import { decryptString } from "@/lib/security/crypto";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const payload = llmTestSchema.parse(await request.json());
    const apiKey =
      payload.apiKey.trim().length > 0
        ? payload.apiKey
        : user.llmConfig?.apiKeyEncrypted
          ? decryptString(user.llmConfig.apiKeyEncrypted)
          : "";

    if (!apiKey) {
      return jsonError("API key is required to test the model connection.", 400);
    }

    const result = await testOpenAICompatibleConnection({
      ...payload,
      apiKey
    });
    return jsonOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed.";
    return jsonError(message, 400);
  }
}
