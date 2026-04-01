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
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
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
  const endpoint = new URL("chat/completions", normalizeBaseUrl(baseUrl));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${message}`);
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
    preview: content ?? ""
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
