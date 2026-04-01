import type { LlmProviderConfig } from "@prisma/client";
import { encryptString } from "@/lib/security/crypto";
import { planTrip } from "@/lib/planning/engine";
import type { TripRequest } from "@/lib/schemas/trip";

const request: TripRequest = {
  destination: "Paris",
  startDate: "2026-07-12",
  days: 2,
  travelers: 2,
  interests: ["museum", "food", "architecture"],
  pace: "balanced",
  budget: "balanced",
  mustVisit: ["Louvre"],
  hotelArea: "Opera",
  notes: "Prefer compact days."
};

describe("planning pipeline", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    process.env.AMAP_API_KEY = "";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("builds a heuristic itinerary when no llm config is present", async () => {
    const result = await planTrip({
      request
    });

    expect(result.itinerary.days).toHaveLength(2);
    expect(result.itinerary.issues.some((issue) => issue.code === "intl-beta")).toBe(true);
    expect(result.itinerary.issues.some((issue) => issue.code === "mock-geo-provider")).toBe(true);
  });

  it("uses llm-generated poi candidates before itinerary refinement when map data is unavailable", async () => {
    const llmConfig = {
      id: "cfg_1",
      ownerId: "admin_1",
      baseUrl: "https://example.com/v1",
      apiKeyEncrypted: encryptString("test-key"),
      model: "demo-model",
      apiStyle: "openai",
      temperature: 0.4,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LlmProviderConfig;

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    pois: [
                      {
                        name: "Louvre Museum",
                        city: "Paris",
                        country: "FR",
                        categories: ["museum"]
                      },
                      {
                        name: "Musee d'Orsay",
                        city: "Paris",
                        country: "FR",
                        categories: ["museum"]
                      },
                      {
                        name: "Eiffel Tower",
                        city: "Paris",
                        country: "FR",
                        categories: ["architecture"]
                      }
                    ]
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
                    request,
                    days: [
                      {
                        date: "2026-07-12",
                        title: "左岸与博物馆",
                        totalTravelMinutes: 40,
                        intensityScore: 6,
                        items: [
                          {
                            id: "d1-louvre",
                            category: "museum",
                            startTime: "09:00",
                            endTime: "11:00",
                            durationMinutes: 120,
                            travelMinutesFromPrevious: 0,
                            locked: false,
                            poi: {
                              name: "Louvre Museum",
                              city: "Paris",
                              country: "FR"
                            }
                          }
                        ]
                      },
                      {
                        date: "2026-07-13",
                        title: "地标与街区漫步",
                        totalTravelMinutes: 35,
                        intensityScore: 5,
                        items: [
                          {
                            id: "d2-eiffel",
                            category: "architecture",
                            startTime: "10:00",
                            endTime: "11:30",
                            durationMinutes: 90,
                            travelMinutesFromPrevious: 0,
                            locked: false,
                            poi: {
                              name: "Eiffel Tower",
                              city: "Paris",
                              country: "FR"
                            }
                          }
                        ]
                      }
                    ],
                    issues: [],
                    metadata: {
                      geoProvider: "mock",
                      usedModel: "demo-model",
                      betaNotice: "International beta",
                      createdAt: new Date().toISOString()
                    }
                  })
                }
              }
            ]
          }),
          { status: 200 }
        )
      ) as typeof fetch;

    const result = await planTrip({
      request,
      llmConfig
    });

    expect(result.itinerary.days).toHaveLength(2);
    expect(result.itinerary.metadata.usedModel).toBe("demo-model");
    expect(result.itinerary.metadata.candidateSource).toBe("llm-fallback");
    expect(result.itinerary.issues.some((issue) => issue.code === "llm-poi-fallback")).toBe(true);
    expect(result.itinerary.days[0].items[0].poi.id).toContain("paris");
    expect(result.itinerary.days[0].items[0].poi.address).toContain("Paris");
    expect(result.itinerary.days[0].items[0].poi.latitude).toEqual(expect.any(Number));
    expect(result.itinerary.days[0].items[0].poi.longitude).toEqual(expect.any(Number));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
