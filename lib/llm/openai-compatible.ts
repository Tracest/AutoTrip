import { z } from "zod";
import {
  getDefaultApiKeyForBaseUrl,
  isLikelyOllamaBaseUrl,
  resolveModelsUrl
} from "@/lib/llm/provider-utils";

type ReasoningEffort = "none" | "low" | "medium" | "high";

type CompletionOptions<T extends z.ZodTypeAny> = {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  schema: T;
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
  timeoutMs?: number;
  retries?: number;
};

type TestConnectionOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs?: number;
  retries?: number;
};

type PostChatCompletionOptions = {
  baseUrl: string;
  apiKey: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
};

type ModelListOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
};

const DEFAULT_TEST_TIMEOUT_MS = Number(process.env.LLM_TEST_TIMEOUT_MS ?? 20_000);
const DEFAULT_PLANNING_TIMEOUT_MS = Number(process.env.LLM_PLANNING_TIMEOUT_MS ?? 90_000);
const DEFAULT_TEST_RETRIES = Number(process.env.LLM_TEST_RETRIES ?? 0);
const DEFAULT_PLANNING_RETRIES = Number(process.env.LLM_PLANNING_RETRIES ?? 1);
const DEFAULT_LOCAL_OLLAMA_TEST_TIMEOUT_MS = 30_000;
const DEFAULT_LOCAL_OLLAMA_PLANNING_TIMEOUT_MS = 180_000;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim();
}

export function resolveChatCompletionsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  const url = new URL(normalized);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/chat/completions")) {
    return url.toString();
  }

  if (pathname.endsWith("/responses") || pathname.endsWith("/v1/responses")) {
    throw new Error(
      "This app expects an OpenAI-compatible base URL for chat/completions, not a Responses API path. Use the provider root, a /v1 base URL, or a full /chat/completions endpoint."
    );
  }

  return new URL("chat/completions", normalized.endsWith("/") ? normalized : `${normalized}/`).toString();
}

function extractJsonObject(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object.");
  }

  return raw.slice(start, end + 1);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(apiKey?: string) {
  const resolvedApiKey = apiKey?.trim() || "";
  return {
    "Content-Type": "application/json",
    ...(resolvedApiKey ? { Authorization: `Bearer ${resolvedApiKey}` } : {})
  };
}

async function extractErrorDetail(response: Response) {
  const raw = await response.text();
  let detail = raw;

  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        message?: string;
        type?: string;
        code?: string | number;
      };
      message?: string;
    };
    detail =
      parsed.error?.message ??
      parsed.message ??
      raw;
  } catch {
    // Keep raw response text when it is not JSON.
  }

  return detail;
}

function extractMessageContent(
  content?:
    | string
    | Array<{
        text?: string;
      }>
    | null
) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content.map((part) => part?.text ?? "").join("").trim();
}

async function postChatCompletion({
  baseUrl,
  apiKey,
  body,
  timeoutMs = DEFAULT_PLANNING_TIMEOUT_MS,
  retries = DEFAULT_PLANNING_RETRIES
}: PostChatCompletionOptions) {
  const endpoint = resolveChatCompletionsUrl(baseUrl);
  const effectiveTimeoutMs =
    timeoutMs === DEFAULT_PLANNING_TIMEOUT_MS && isLikelyOllamaBaseUrl(baseUrl)
      ? DEFAULT_LOCAL_OLLAMA_PLANNING_TIMEOUT_MS
      : timeoutMs;
  let attempt = 0;

  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: buildHeaders(apiKey || getDefaultApiKeyForBaseUrl(baseUrl)),
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timeout);
      const canRetry = attempt <= retries;
      if (error instanceof Error && error.name === "AbortError") {
        if (canRetry) {
          await delay(Math.min(1_500 * attempt, 4_000));
          continue;
        }
        throw new Error(`LLM request timed out after ${Math.round(effectiveTimeoutMs / 1000)}s. Endpoint: ${endpoint}`);
      }
      if (canRetry) {
        await delay(Math.min(1_500 * attempt, 4_000));
        continue;
      }
      throw new Error(
        `Unable to reach the model endpoint ${endpoint}. ${error instanceof Error ? error.message : String(error)}`
      );
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const detail = await extractErrorDetail(response);

      if (attempt <= retries && isRetryableStatus(response.status)) {
        await delay(Math.min(1_500 * attempt, 4_000));
        continue;
      }

      throw new Error(`LLM request failed (${response.status}) at ${endpoint}: ${detail}`);
    }

    return (await response.json()) as {
      choices?: Array<{
        message?: {
          content?:
            | string
            | Array<{
                text?: string;
              }>;
        };
      }>;
    };
  }
}

export async function testOpenAICompatibleConnection(options: TestConnectionOptions) {
  const timeoutMs =
    options.timeoutMs ??
    (isLikelyOllamaBaseUrl(options.baseUrl) ? DEFAULT_LOCAL_OLLAMA_TEST_TIMEOUT_MS : DEFAULT_TEST_TIMEOUT_MS);
  const payload = await postChatCompletion({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    timeoutMs,
    retries: options.retries ?? DEFAULT_TEST_RETRIES,
    body: {
      model: options.model,
      temperature: options.temperature,
      max_tokens: 8,
      messages: [
        {
          role: "system",
          content: "Reply with the single word ok."
        },
        {
          role: "user",
          content: "ok"
        }
      ]
    }
  });

  const content = extractMessageContent(payload.choices?.[0]?.message?.content).trim().toLowerCase();
  return {
    ok: Boolean(content),
    preview: content ?? "",
    endpoint: resolveChatCompletionsUrl(options.baseUrl)
  };
}

export async function requestStructuredJson<T extends z.ZodTypeAny>(options: CompletionOptions<T>) {
  const timeoutMs =
    options.timeoutMs ??
    (isLikelyOllamaBaseUrl(options.baseUrl) ? DEFAULT_LOCAL_OLLAMA_PLANNING_TIMEOUT_MS : DEFAULT_PLANNING_TIMEOUT_MS);
  const isLocalOllama = isLikelyOllamaBaseUrl(options.baseUrl);
  const payload = await postChatCompletion({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    timeoutMs,
    retries: options.retries ?? DEFAULT_PLANNING_RETRIES,
    body: {
      model: options.model,
      temperature: options.temperature,
      ...(typeof options.maxTokens === "number" ? { max_tokens: options.maxTokens } : {}),
      ...(isLocalOllama && options.reasoningEffort
        ? {
            reasoning_effort: options.reasoningEffort
          }
        : {}),
      messages: [
        {
          role: "system",
          content: `${options.systemPrompt}\nReturn JSON only. Do not wrap it in markdown.`
        },
        {
          role: "user",
          content: options.userPrompt
        }
      ],
      ...(isLocalOllama
        ? {
            response_format: {
              type: "json_object"
            }
          }
        : {})
    }
  });

  const content = extractMessageContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  const parsed = JSON.parse(extractJsonObject(content));
  return options.schema.parse(parsed);
}

export async function listAvailableModels(options: ModelListOptions) {
  const endpoint = resolveModelsUrl(options.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: buildHeaders(options.apiKey || getDefaultApiKeyForBaseUrl(options.baseUrl)),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await extractErrorDetail(response);
      throw new Error(`Model list request failed (${response.status}) at ${endpoint}: ${detail}`);
    }

    const payload = (await response.json()) as {
      models?: Array<{ name?: string }>;
      data?: Array<{ id?: string }>;
    };

    const models = isLikelyOllamaBaseUrl(options.baseUrl)
      ? (payload.models ?? []).map((entry) => entry.name ?? "").filter(Boolean)
      : (payload.data ?? []).map((entry) => entry.id ?? "").filter(Boolean);

    return {
      endpoint,
      models: Array.from(new Set(models)).sort((left, right) => left.localeCompare(right))
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Model list request timed out after ${Math.round((options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS) / 1000)}s. Endpoint: ${endpoint}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
