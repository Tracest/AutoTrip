import { llmTestSchema } from "@/lib/schemas/llm";
import { testOpenAICompatibleConnection } from "@/lib/llm/openai-compatible";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { requireAdminUser } from "@/lib/auth/guards";
import { getDefaultApiKeyForBaseUrl } from "@/lib/llm/provider-utils";
import { decryptString } from "@/lib/security/crypto";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("未授权访问。", 401);
  }

  try {
    const payload = llmTestSchema.parse(await request.json());
    const fallbackApiKey = getDefaultApiKeyForBaseUrl(payload.baseUrl);
    const savedKeyMatchesBaseUrl = user.llmConfig?.baseUrl === payload.baseUrl;
    const apiKey =
      payload.apiKey.trim().length > 0
        ? payload.apiKey
        : savedKeyMatchesBaseUrl && user.llmConfig?.apiKeyEncrypted
          ? decryptString(user.llmConfig.apiKeyEncrypted)
          : fallbackApiKey;

    if (!apiKey) {
      return jsonError("测试模型连接时必须提供 API Key；如果使用本地 Ollama 则可留空。", 400);
    }

    const result = await testOpenAICompatibleConnection({
      ...payload,
      apiKey
    });
    return jsonOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "连接测试失败。";
    return jsonError(message, 400);
  }
}
