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

export type ChatCompletionTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: unknown) => Promise<unknown>;
};

type ToolCompletionOptions<T extends z.ZodTypeAny> = CompletionOptions<T> & {
  tools: ChatCompletionTool[];
  maxSteps?: number;
  requireToolUse?: boolean;
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

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
          }>
        | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
};

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
      choices?: ChatCompletionResponse["choices"];
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

function parsePseudoToolCalls(content: string) {
  if (!content) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    return [];
  }

  const toToolCall = (
    value: unknown,
    index: number
  ): {
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  } | null => {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const name =
      (typeof record.tool === "string" && record.tool) ||
      (typeof record.name === "string" && record.name) ||
      (record.function && typeof record.function === "object" && typeof (record.function as Record<string, unknown>).name === "string"
        ? String((record.function as Record<string, unknown>).name)
        : "");
    const args =
      record.arguments ??
      (record.function && typeof record.function === "object"
        ? (record.function as Record<string, unknown>).arguments
        : undefined) ??
      {};

    if (!name) {
      return null;
    }

    return {
      id: `pseudo-tool-${index + 1}`,
      function: {
        name,
        arguments: typeof args === "string" ? args : JSON.stringify(args)
      }
    };
  };

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).tool_calls)) {
    return ((parsed as Record<string, unknown>).tool_calls as unknown[])
      .map((entry, index) => toToolCall(entry, index))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }

  const single = toToolCall(parsed, 0);
  return single ? [single] : [];
}

function stringifyToolResult(result: unknown) {
  return JSON.stringify(result ?? null);
}

function buildPseudoToolCatalog(tools: ToolCompletionOptions<z.ZodTypeAny>["tools"]) {
  return tools
    .map((tool) =>
      [
        `Tool: ${tool.name}`,
        `Description: ${tool.description}`,
        `Arguments schema: ${JSON.stringify(tool.parameters)}`
      ].join("\n")
    )
    .join("\n\n");
}

function supportsNativeToolsError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /does not support tools|tool(?:s)? (?:is|are) not supported|unsupported tool/i.test(error.message);
}

export async function requestStructuredJsonWithTools<T extends z.ZodTypeAny>(
  options: ToolCompletionOptions<T>
) {
  const timeoutMs =
    options.timeoutMs ??
    (isLikelyOllamaBaseUrl(options.baseUrl) ? DEFAULT_LOCAL_OLLAMA_PLANNING_TIMEOUT_MS : DEFAULT_PLANNING_TIMEOUT_MS);
  const isLocalOllama = isLikelyOllamaBaseUrl(options.baseUrl);
  const maxSteps = Math.max(1, Math.min(options.maxSteps ?? 8, 12));
  const toolDefinitions = options.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
  const pseudoToolCatalog = buildPseudoToolCatalog(options.tools);
  const messages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content: [
        options.systemPrompt,
        "You may browse with the provided tools before answering.",
        "Research across multiple independent sources when possible.",
        "Available tools:",
        pseudoToolCatalog,
        "If native tool calling is unavailable, request a tool by returning JSON like {\"tool\":\"web_search\",\"arguments\":{...}} or {\"tool_calls\":[...]}.",
        "When you are done, return the final answer as JSON only and do not wrap it in markdown."
      ].join("\n")
    },
    {
      role: "user",
      content: options.userPrompt
    }
  ];
  const usedTools = new Set<string>();
  let sendNativeTools = toolDefinitions.length > 0;

  for (let step = 0; step < maxSteps; step += 1) {
    let payload;
    try {
      payload = await postChatCompletion({
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
          ...(!sendNativeTools && isLocalOllama
            ? {
                response_format: {
                  type: "json_object"
                }
              }
            : {}),
          messages,
          ...(sendNativeTools ? { tools: toolDefinitions } : {})
        }
      });
    } catch (error) {
      // 兼容不支持原生 tools 的本地模型，降级为“伪工具调用”模式继续执行。
      if (sendNativeTools && supportsNativeToolsError(error)) {
        sendNativeTools = false;
        step -= 1;
        continue;
      }

      throw error;
    }

    const message = payload.choices?.[0]?.message;
    const content = extractMessageContent(message?.content);
    const nativeToolCalls =
      message?.tool_calls?.filter(
        (toolCall) => toolCall.function?.name && typeof toolCall.function.arguments === "string"
      ) ?? [];
    const pseudoToolCalls = nativeToolCalls.length === 0 ? parsePseudoToolCalls(content) : [];
    const toolCalls = nativeToolCalls.length > 0 ? nativeToolCalls : pseudoToolCalls;

    if (toolCalls.length === 0) {
      if (!content) {
        throw new Error("LLM returned an empty response.");
      }

      if (options.requireToolUse && usedTools.size === 0) {
        throw new Error("The model returned JSON without using any research tools.");
      }

      const parsed = JSON.parse(extractJsonObject(content));
      return options.schema.parse(parsed);
    }

    if (nativeToolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: message?.content ?? null,
        tool_calls: message?.tool_calls
      });
    } else {
      messages.push({
        role: "assistant",
        content
      });
    }

    for (const [index, toolCall] of toolCalls.entries()) {
      const toolName = toolCall.function?.name ?? "";
      const tool = options.tools.find((entry) => entry.name === toolName);
      const toolCallId = toolCall.id ?? `tool-call-${step + 1}-${index + 1}`;

      let result: unknown;
      try {
        if (!tool) {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        const parsedArguments = JSON.parse(toolCall.function?.arguments ?? "{}");
        result = await tool.execute(parsedArguments);
        usedTools.add(toolName);
      } catch (error) {
        result = {
          error: error instanceof Error ? error.message : String(error)
        };
      }

      if (nativeToolCalls.length > 0) {
        messages.push({
          role: "tool",
          tool_call_id: toolCallId,
          content: stringifyToolResult(result)
        });
      } else {
        messages.push({
          role: "user",
          content: `Tool result for ${toolName}:\n${stringifyToolResult(result)}`
        });
      }
    }
  }

  throw new Error(`Tool-assisted LLM request exceeded ${maxSteps} steps without producing final JSON.`);
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
