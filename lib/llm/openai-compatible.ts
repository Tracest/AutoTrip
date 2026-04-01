import { z } from "zod";

type CompletionOptions<T extends z.ZodTypeAny> = {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  schema: T;
};

type TestConnectionOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
};

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

async function postChatCompletion(baseUrl: string, apiKey: string, body: Record<string, unknown>) {
  const endpoint = resolveChatCompletionsUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`LLM request timed out after 20s. Endpoint: ${endpoint}`);
    }
    throw new Error(
      `Unable to reach the model endpoint ${endpoint}. ${error instanceof Error ? error.message : String(error)}`
    );
  }

  clearTimeout(timeout);

  if (!response.ok) {
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

    throw new Error(`LLM request failed (${response.status}) at ${endpoint}: ${detail}`);
  }

  return (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
}

export async function testOpenAICompatibleConnection(options: TestConnectionOptions) {
  const payload = await postChatCompletion(options.baseUrl, options.apiKey, {
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
  });

  const content = payload.choices?.[0]?.message?.content?.trim().toLowerCase();
  return {
    ok: Boolean(content),
    preview: content ?? "",
    endpoint: resolveChatCompletionsUrl(options.baseUrl)
  };
}

export async function requestStructuredJson<T extends z.ZodTypeAny>(options: CompletionOptions<T>) {
  const payload = await postChatCompletion(options.baseUrl, options.apiKey, {
    model: options.model,
    temperature: options.temperature,
    messages: [
      {
        role: "system",
        content: `${options.systemPrompt}\nReturn JSON only. Do not wrap it in markdown.`
      },
      {
        role: "user",
        content: options.userPrompt
      }
    ]
  });

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  const parsed = JSON.parse(extractJsonObject(content));
  return options.schema.parse(parsed);
}
