import { fetchWebPage, searchWeb } from "@/lib/llm/web-research";

describe("web research tools", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses Bing RSS search results into normalized records", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        `<?xml version="1.0" encoding="utf-8" ?>
          <rss version="2.0">
            <channel>
              <item>
                <title>Guiyang Travel Guide</title>
                <link>https://example.com/guiyang-guide</link>
                <description>Top sights and food streets.</description>
                <pubDate>Thu, 10 Apr 2026 00:00:00 GMT</pubDate>
              </item>
              <item>
                <title>Guiyang Night View</title>
                <link>https://example.com/guiyang-night</link>
                <description>Observation decks and skyline views.</description>
              </item>
            </channel>
          </rss>`,
        {
          status: 200,
          headers: {
            "content-type": "text/xml; charset=utf-8"
          }
        }
      )
    ) as typeof fetch;

    const result = await searchWeb("Guiyang attractions", {
      maxResults: 2,
      market: "en-US"
    });

    expect(result.source).toBe("bing-rss");
    expect(result.results).toEqual([
      {
        title: "Guiyang Travel Guide",
        url: "https://example.com/guiyang-guide",
        snippet: "Top sights and food streets.",
        publishedAt: "Thu, 10 Apr 2026 00:00:00 GMT"
      },
      {
        title: "Guiyang Night View",
        url: "https://example.com/guiyang-night",
        snippet: "Observation decks and skyline views.",
        publishedAt: undefined
      }
    ]);
  });

  it("extracts readable title, description, and body text from HTML pages", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        `<!doctype html>
          <html>
            <head>
              <title>Guiyang Museum</title>
              <meta name="description" content="A city museum in Guiyang.">
            </head>
            <body>
              <main>
                <h1>Guiyang Museum</h1>
                <p>Open daily.</p>
                <script>window.ignore = true;</script>
              </main>
            </body>
          </html>`,
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        }
      )
    ) as typeof fetch;

    const page = await fetchWebPage("https://example.com/guiyang-museum", {
      maxChars: 500
    });

    expect(page.title).toBe("Guiyang Museum");
    expect(page.description).toBe("A city museum in Guiyang.");
    expect(page.content).toContain("Open daily.");
    expect(page.content).not.toContain("window.ignore");
  });

  it("rejects localhost and private network URLs", async () => {
    await expect(fetchWebPage("http://127.0.0.1:3000")).rejects.toThrow(
      /private network URLs are not allowed/i
    );
  });
});
