import { z } from "zod";
import {
  requestStructuredJson,
  resolveChatCompletionsUrl,
  testOpenAICompatibleConnection
} from "@/lib/llm/openai-compatible";

describe("openai compatible client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("tests model connectivity with a trivial completion", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://example.com/v1",
      apiKey: "test-key",
      model: "demo",
      temperature: 0.2
    });

    expect(result.ok).toBe(true);
    expect(result.preview).toBe("ok");
    expect(result.endpoint).toBe("https://example.com/v1/chat/completions");
  });

  it("accepts a full chat completions endpoint as the base url", () => {
    expect(resolveChatCompletionsUrl("https://example.com/v1/chat/completions")).toBe(
      "https://example.com/v1/chat/completions"
    );
  });

  it("rejects responses api paths with an actionable error", () => {
    expect(() => resolveChatCompletionsUrl("https://example.com/responses")).toThrow(
      /chat\/completions, not a Responses API path/
    );
  });

  it("parses structured JSON from an OpenAI-compatible response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ok: true,
                  label: "trip"
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await requestStructuredJson({
      baseUrl: "https://example.com/v1",
      apiKey: "test-key",
      model: "demo",
      temperature: 0.2,
      systemPrompt: "Return JSON",
      userPrompt: "Return {\"ok\":true,\"label\":\"trip\"}",
      schema: z.object({
        ok: z.boolean(),
        label: z.string()
      })
    });

    expect(result).toEqual({
      ok: true,
      label: "trip"
    });
  });
});
