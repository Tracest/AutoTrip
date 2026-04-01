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
  });

  it("refines the itinerary through a mocked llm response", async () => {
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

    global.fetch = vi.fn().mockResolvedValue(
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
                            id: "louvre",
                            name: "Louvre Museum",
                            address: "Rue de Rivoli",
                            city: "Paris",
                            country: "FR",
                            categories: ["museum"],
                            latitude: 48.8606,
                            longitude: 2.3376,
                            recommendedDurationMinutes: 120
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
                            id: "eiffel",
                            name: "Eiffel Tower",
                            address: "Champ de Mars",
                            city: "Paris",
                            country: "FR",
                            categories: ["architecture"],
                            latitude: 48.8584,
                            longitude: 2.2945,
                            recommendedDurationMinutes: 90
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
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
