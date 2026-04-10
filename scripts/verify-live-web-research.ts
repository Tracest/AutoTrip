import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { planTrip } from "@/lib/planning/engine";

function encryptString(plaintext: string) {
  const raw = process.env.APP_ENCRYPTION_KEY ?? "";
  const decoded = Buffer.from(raw, "base64");
  const key = decoded.length === 32 ? decoded : createHash("sha256").update(raw).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

async function main() {
  process.env.AUTO_TRIP_FORCE_MOCK = "";
  const model = process.env.LIVE_CHECK_MODEL || "deepseek-r1:8b";
  const destination = process.env.LIVE_CHECK_DESTINATION || "贵阳";
  const debug = process.env.LIVE_CHECK_DEBUG === "1";
  const originalFetch = global.fetch;

  if (debug) {
    global.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const response = await originalFetch(input, init);

      if (url.includes("/chat/completions")) {
        const requestBody = typeof init?.body === "string" ? init.body : "";
        const responseText = await response.clone().text();

        console.log("===LLM_REQUEST===");
        console.log(
          JSON.stringify(
            {
              url,
              requestBody: requestBody.slice(0, 4_000)
            },
            null,
            2
          )
        );
        console.log("===LLM_RESPONSE===");
        console.log(responseText.slice(0, 8_000));
      }

      return response;
    }) as typeof fetch;
  }

  try {
    const result = await planTrip({
      request: {
        destination,
        startDate: "2026-04-10",
        days: 2,
        travelers: 2,
        interests: ["美食", "夜景", "自然"],
        pace: "balanced",
        budget: "balanced",
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      },
      llmConfig: {
        id: "live-check",
        ownerId: "local-admin",
        baseUrl: "http://127.0.0.1:11434/v1",
        apiKeyEncrypted: encryptString("ollama"),
        model,
        apiStyle: "openai",
        temperature: 0.2,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      onProgress: (event) => {
        console.log(`[progress:${event.stage}] ${event.message}`);
      }
    });

    const items = result.itinerary.days.flatMap((day) =>
      day.items.map((item) => ({
        date: day.date,
        title: day.title,
        name: item.poi.name,
        address: item.poi.address,
        city: item.poi.city,
        categories: item.poi.categories,
        sourcePageUrl: item.poi.sourcePageUrl,
        imageProvider: item.poi.image?.provider ?? null
      }))
    );

    console.log("===LIVE_PLAN_SUMMARY===");
    console.log(
      JSON.stringify(
        {
          model,
          destination,
          candidateSource: result.itinerary.metadata.candidateSource,
          candidateCount: result.itinerary.metadata.candidateCount,
          geoProvider: result.itinerary.metadata.geoProvider,
          issueCodes: result.issues.map((issue) => issue.code),
          items
        },
        null,
        2
      )
    );
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error("[verify-live-web-research] 运行失败", error);
  process.exitCode = 1;
});
