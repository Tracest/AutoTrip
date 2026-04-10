import { z } from "zod";
import {
  listAvailableModels,
  requestStructuredJson,
  requestStructuredJsonWithTools,
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

  it("requests json mode for local Ollama structured output", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ok: true
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    await requestStructuredJson({
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "",
      model: "qwen3:8b",
      temperature: 0.2,
      systemPrompt: "Return JSON",
      userPrompt: "Return {\"ok\":true}",
      schema: z.object({
        ok: z.boolean()
      })
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ollama"
        }),
        body: expect.stringContaining("\"response_format\":{\"type\":\"json_object\"}")
      })
    );
  });

  it("lists local Ollama models from the tags endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ name: "qwen3:8b" }, { name: "llama3.1:8b" }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await listAvailableModels({
      baseUrl: "http://127.0.0.1:11434/v1"
    });

    expect(result.models).toEqual(["llama3.1:8b", "qwen3:8b"]);
    expect(result.endpoint).toBe("http://127.0.0.1:11434/api/tags");
  });

  it("retries once on a retryable upstream failure", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(
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
      temperature: 0.2,
      retries: 1
    });

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("supports native tool-calling loops before parsing final JSON", async () => {
    const executeTool = vi.fn().mockResolvedValue({
      results: [{ title: "Guiyang attraction" }]
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "",
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "web_search",
                        arguments: JSON.stringify({
                          query: "Guiyang attractions"
                        })
                      }
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ok: true,
                    source: "tool-loop"
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof fetch;

    const result = await requestStructuredJsonWithTools({
      baseUrl: "https://example.com/v1",
      apiKey: "test-key",
      model: "demo",
      temperature: 0.2,
      systemPrompt: "Use tools before final JSON.",
      userPrompt: "Research Guiyang and return JSON.",
      schema: z.object({
        ok: z.boolean(),
        source: z.string()
      }),
      tools: [
        {
          name: "web_search",
          description: "Search the web.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string"
              }
            },
            required: ["query"]
          },
          execute: executeTool
        }
      ]
    });

    expect(result).toEqual({
      ok: true,
      source: "tool-loop"
    });
    expect(executeTool).toHaveBeenCalledWith({
      query: "Guiyang attractions"
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("supports pseudo tool calls when the model does not emit native tool metadata", async () => {
    const executeTool = vi.fn().mockResolvedValue({
      pages: [{ title: "Page" }]
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    tool: "fetch_url",
                    arguments: {
                      url: "https://example.com/guiyang"
                    }
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ok: true
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof fetch;

    const result = await requestStructuredJsonWithTools({
      baseUrl: "https://example.com/v1",
      apiKey: "test-key",
      model: "demo",
      temperature: 0.2,
      systemPrompt: "Use tools before final JSON.",
      userPrompt: "Research Guiyang and return JSON.",
      schema: z.object({
        ok: z.boolean()
      }),
      tools: [
        {
          name: "fetch_url",
          description: "Fetch a page.",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string"
              }
            },
            required: ["url"]
          },
          execute: executeTool
        }
      ]
    });

    expect(result).toEqual({
      ok: true
    });
    expect(executeTool).toHaveBeenCalledWith({
      url: "https://example.com/guiyang"
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to pseudo tool mode when the upstream model rejects native tools", async () => {
    const executeTool = vi.fn().mockResolvedValue({
      results: [{ title: "Guiyang attraction" }]
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "registry.ollama.ai/library/deepseek-r1:8b does not support tools"
            }
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    tool: "web_search",
                    arguments: {
                      query: "贵阳 景点 夜景"
                    }
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ok: true,
                    mode: "pseudo-after-native-fallback"
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof fetch;

    const result = await requestStructuredJsonWithTools({
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "",
      model: "deepseek-r1:8b",
      temperature: 0.2,
      systemPrompt: "Use tools before final JSON.",
      userPrompt: "Research Guiyang and return JSON.",
      schema: z.object({
        ok: z.boolean(),
        mode: z.string()
      }),
      tools: [
        {
          name: "web_search",
          description: "Search the web.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string"
              }
            },
            required: ["query"]
          },
          execute: executeTool
        }
      ]
    });

    expect(result).toEqual({
      ok: true,
      mode: "pseudo-after-native-fallback"
    });
    expect(executeTool).toHaveBeenCalledWith({
      query: "贵阳 景点 夜景"
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:11434/v1/chat/completions",
      expect.objectContaining({
        body: expect.not.stringContaining("\"tools\":")
      })
    );
  });
});
