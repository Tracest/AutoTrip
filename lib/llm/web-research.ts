import { z } from "zod";
import type { ChatCompletionTool } from "@/lib/llm/openai-compatible";
import { shouldPreferChineseOutput } from "@/lib/planning/destination";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
};

type FetchedPage = {
  url: string;
  finalUrl: string;
  title: string;
  description?: string;
  contentType: string;
  content: string;
  truncated: boolean;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CHARS = 6_000;
const MAX_RESULTS = 8;
const MAX_BATCH_URLS = 4;
const MAX_RESPONSE_CHARS = 16_000;
const MAX_FETCH_BYTES = 350_000;

const webSearchArgsSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(MAX_RESULTS).optional()
});

const fetchUrlArgsSchema = z.object({
  url: z.string().url(),
  maxChars: z.number().int().min(800).max(10_000).optional()
});

const multiFetchUrlArgsSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(MAX_BATCH_URLS),
  maxCharsPerPage: z.number().int().min(800).max(8_000).optional()
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return {
      text: value,
      truncated: false
    };
  }

  return {
    text: `${value.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`,
    truncated: true
  };
}

function extractXmlTag(value: string, tag: string) {
  const match = value.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : "";
}

function extractMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${key}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]).trim();
    }
  }

  return undefined;
}

function isBlockedHostname(hostname: string) {
  const lower = hostname.trim().toLowerCase();

  if (!lower) {
    return true;
  }

  if (
    lower === "localhost" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }

  if (/^(127\.|10\.|192\.168\.)/.test(lower)) {
    return true;
  }

  const private172 = lower.match(/^172\.(\d+)\./);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  if (/^(169\.254\.)/.test(lower)) {
    return true;
  }

  if (
    lower.startsWith("[::1]") ||
    lower.startsWith("[fc") ||
    lower.startsWith("[fd") ||
    lower.startsWith("[fe80:")
  ) {
    return true;
  }

  return false;
}

function assertPublicUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("Local and private network URLs are not allowed.");
  }

  return parsed;
}

async function fetchTextResponse(url: string, init?: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "User-Agent": "AutoTrip/0.1 (+https://localhost; LLM web research)",
          Accept:
            "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.5",
          ...(init?.headers ?? {})
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}.`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < 1) {
        await delay(350 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch failure.");
}

function extractReadableText(html: string, maxChars: number) {
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const description =
    extractMetaContent(html, "description") ?? extractMetaContent(html, "og:description");
  const body =
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;

  const cleanedBody = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|main|aside|header|footer|nav|li|ul|ol|table|tr|h[1-6])>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n");

  const text = normalizeWhitespace(stripTags(cleanedBody));
  const truncated = truncateText(text, maxChars);

  return {
    title,
    description,
    content: truncated.text,
    truncated: truncated.truncated
  };
}

function extractTextPayload(raw: string, contentType: string, maxChars: number) {
  if (/html|xml/i.test(contentType)) {
    return extractReadableText(raw, maxChars);
  }

  const text = truncateText(normalizeWhitespace(raw), maxChars);
  return {
    title: "",
    description: undefined,
    content: text.text,
    truncated: text.truncated
  };
}

async function readResponseBody(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    return response.text();
  }

  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      chunks.push(value);
      totalLength += value.byteLength;

      if (totalLength > MAX_FETCH_BYTES) {
        break;
      }
    }
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(combined);
}

export async function searchWeb(
  query: string,
  options?: {
    maxResults?: number;
    market?: string;
  }
) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Search query cannot be empty.");
  }

  const maxResults = Math.min(options?.maxResults ?? DEFAULT_MAX_RESULTS, MAX_RESULTS);
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("format", "rss");
  url.searchParams.set("q", trimmedQuery);

  if (options?.market) {
    url.searchParams.set("mkt", options.market);
  }

  const response = await fetchTextResponse(url.toString());
  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  const results: SearchResult[] = [];
  for (const item of items) {
    const rawUrl = extractXmlTag(item, "link");
    if (!rawUrl) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = assertPublicUrl(rawUrl);
    } catch {
      continue;
    }

    results.push({
      title: extractXmlTag(item, "title"),
      url: parsed.toString(),
      snippet: extractXmlTag(item, "description"),
      publishedAt: extractXmlTag(item, "pubDate") || undefined
    });

    if (results.length >= maxResults) {
      break;
    }
  }

  return {
    query: trimmedQuery,
    source: "bing-rss",
    results
  };
}

export async function fetchWebPage(
  url: string,
  options?: {
    maxChars?: number;
  }
) {
  const parsed = assertPublicUrl(url);
  const response = await fetchTextResponse(parsed.toString());
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";

  if (!/html|xml|text\/plain|application\/json/i.test(contentType)) {
    return {
      url: parsed.toString(),
      finalUrl: response.url || parsed.toString(),
      title: "",
      description: undefined,
      contentType,
      content: "Unsupported content type for text extraction.",
      truncated: false
    } satisfies FetchedPage;
  }

  const raw = await readResponseBody(response);
  const extracted = extractTextPayload(raw, contentType, options?.maxChars ?? DEFAULT_MAX_CHARS);

  return {
    url: parsed.toString(),
    finalUrl: response.url || parsed.toString(),
    title: extracted.title,
    description: extracted.description,
    contentType,
    content: extracted.content,
    truncated: extracted.truncated
  } satisfies FetchedPage;
}

export async function fetchManyWebPages(
  urls: string[],
  options?: {
    maxCharsPerPage?: number;
  }
) {
  const uniqueUrls = Array.from(new Set(urls)).slice(0, MAX_BATCH_URLS);
  const pages = await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        return await fetchWebPage(url, {
          maxChars: options?.maxCharsPerPage ?? 4_000
        });
      } catch (error) {
        return {
          url,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  const serialized = JSON.stringify(pages);
  if (serialized.length <= MAX_RESPONSE_CHARS) {
    return {
      pages
    };
  }

  return {
    pages: pages.map((page) => {
      if ("error" in page) {
        return page;
      }

      const shortened = truncateText(page.content, 2_500);
      return {
        ...page,
        content: shortened.text,
        truncated: page.truncated || shortened.truncated
      };
    })
  };
}

export function createWebResearchTools(destination: string): ChatCompletionTool[] {
  const defaultMarket = shouldPreferChineseOutput(destination) ? "zh-CN" : "en-US";

  return [
    {
      name: "web_search",
      description:
        "Search the public web for travel research. Use it to find candidate POIs, official pages, travel guides, reviews, and opening-hour references.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: {
            type: "string",
            description: "Search query. Try both local-language and English queries when helpful."
          },
          maxResults: {
            type: "integer",
            minimum: 1,
            maximum: MAX_RESULTS,
            description: "How many results to return. Prefer small values."
          }
        },
        required: ["query"]
      },
      async execute(input) {
        const args = webSearchArgsSchema.parse(input);
        return searchWeb(args.query, {
          maxResults: args.maxResults,
          market: defaultMarket
        });
      }
    },
    {
      name: "fetch_url",
      description:
        "Fetch a public web page and extract readable text. Use this after search to inspect the actual source content before deciding on POIs.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: {
            type: "string",
            format: "uri",
            description: "Public http or https URL."
          },
          maxChars: {
            type: "integer",
            minimum: 800,
            maximum: 10000,
            description: "Maximum extracted characters to keep from the page."
          }
        },
        required: ["url"]
      },
      async execute(input) {
        const args = fetchUrlArgsSchema.parse(input);
        return fetchWebPage(args.url, {
          maxChars: args.maxChars
        });
      }
    },
    {
      name: "multi_fetch_url",
      description:
        "Fetch several public web pages in one call. Use it when you already have a short list of URLs and want to compare multiple sources quickly.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          urls: {
            type: "array",
            minItems: 1,
            maxItems: MAX_BATCH_URLS,
            items: {
              type: "string",
              format: "uri"
            },
            description: "One to four public URLs."
          },
          maxCharsPerPage: {
            type: "integer",
            minimum: 800,
            maximum: 8000,
            description: "Maximum extracted characters to keep per page."
          }
        },
        required: ["urls"]
      },
      async execute(input) {
        const args = multiFetchUrlArgsSchema.parse(input);
        return fetchManyWebPages(args.urls, {
          maxCharsPerPage: args.maxCharsPerPage
        });
      }
    }
  ];
}
