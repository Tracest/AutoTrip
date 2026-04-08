import type { LlmProviderConfig } from "@prisma/client";
import { encryptString } from "@/lib/security/crypto";
import { planTrip } from "@/lib/planning/engine";
import type { TripRequest } from "@/lib/schemas/trip";

const guiyang = "\u8d35\u9633";
const jiaxiuLou = "\u7532\u79c0\u697c";
const qingyunMarket = "\u9752\u4e91\u5e02\u96c6";
const qianlingshanPark = "\u9ed4\u7075\u5c71\u516c\u56ed";
const guizhouMuseum = "\u8d35\u5dde\u7701\u535a\u7269\u9986";
const shanghai = "\u4e0a\u6d77";
const bund = "\u5916\u6ee9";
const shanghaiMuseum = "\u4e0a\u6d77\u535a\u7269\u9986";
const yuyuan = "\u8c6b\u56ed";
const shenDaCheng = "\u6c88\u5927\u6210";

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
    process.env.AUTO_TRIP_FORCE_MOCK = "1";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AUTO_TRIP_FORCE_MOCK;
    vi.restoreAllMocks();
  });

  it("fails fast instead of generating placeholder pois when no real provider is available", async () => {
    await expect(
      planTrip({
        request
      })
    ).rejects.toThrow(/No map provider is configured/);
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
                      },
                      {
                        name: "Le Comptoir du Relais",
                        city: "Paris",
                        country: "FR",
                        categories: ["food"]
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
                        title: "Left Bank Museums",
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
                        title: "Landmarks Walk",
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

  it("accepts looser local-model payload shapes and keeps domestic aliases grounded", async () => {
    const llmConfig = {
      id: "cfg_2",
      ownerId: "admin_1",
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKeyEncrypted: encryptString("ollama"),
      model: "qwen2.5:3b",
      apiStyle: "openai",
      temperature: 0.3,
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
                    items: [
                      "Food",
                      "City Hotel",
                      {
                        name: "Eiffel Tower",
                        city: "Paris",
                        country: "FR",
                        categories: ["architecture"]
                      },
                      {
                        name: jiaxiuLou,
                        city: guiyang,
                        categories: ["\u5386\u53f2", "\u591c\u666f"]
                      },
                      {
                        name: qingyunMarket,
                        city: guiyang,
                        categories: ["\u7f8e\u98df", "\u591c\u666f"]
                      },
                      {
                        name: qianlingshanPark,
                        city: guiyang,
                        categories: ["\u81ea\u7136", "\u57ce\u5e02\u6f2b\u6b65"]
                      },
                      {
                        name: guizhouMuseum,
                        city: guiyang,
                        categories: ["\u5386\u53f2", "\u535a\u7269\u9986"]
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
                    itinerary: {
                      days: [
                        {
                          title: "Day 1",
                          items: [
                            {
                              poi: {
                                name: jiaxiuLou,
                                city: guiyang,
                                country: "CN"
                              }
                            }
                          ]
                        },
                        {
                          title: "Day 2",
                          items: [
                            {
                              poi: {
                                name: qingyunMarket,
                                city: guiyang,
                                country: "CN"
                              }
                            }
                          ]
                        }
                      ]
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
      request: {
        ...request,
        destination: "Guiyang",
        startDate: "2026-04-10",
        interests: ["\u5386\u53f2", "\u7f8e\u98df", "\u591c\u666f"]
      },
      llmConfig
    });

    expect(result.itinerary.metadata.candidateSource).toBe("llm-fallback");
    expect(result.itinerary.metadata.candidateCount).toBe(4);
    expect(result.itinerary.issues.some((issue) => issue.code === "intl-beta")).toBe(false);
    expect(result.itinerary.days[0].title).toContain("\u521d\u5370\u8c61");
    expect(result.itinerary.days[0].items[0].poi.name).toBe(jiaxiuLou);
    expect(result.itinerary.days[0].items[0].poi.country).toBe("CN");
    expect(/[\u4e00-\u9fff]/u.test(result.itinerary.days[1].title)).toBe(true);
    expect(result.itinerary.days[1].items[0].poi.name).toBe(qingyunMarket);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("localizes domestic fallback pois and removes area-like english candidates", async () => {
    const llmConfig = {
      id: "cfg_3",
      ownerId: "admin_1",
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKeyEncrypted: encryptString("ollama"),
      model: "deepseek-r1:8b",
      apiStyle: "openai",
      temperature: 0.3,
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
                    items: [
                      {
                        id: "poi-bund",
                        name: "The Bund",
                        city: "Shanghai",
                        country: "CN",
                        categories: ["nightview"]
                      },
                      {
                        id: "poi-museum",
                        name: "Shanghai Museum",
                        city: "Shanghai",
                        country: "CN",
                        categories: ["history"]
                      },
                      {
                        id: "poi-yuyuan",
                        name: "Yuyuan Garden",
                        city: "Shanghai",
                        country: "CN",
                        categories: ["history"]
                      },
                      {
                        id: "poi-dessert",
                        name: "Shen Dacheng",
                        city: "Shanghai",
                        country: "CN",
                        categories: ["food"]
                      },
                      {
                        id: "poi-road",
                        name: "Nanjing Road",
                        city: "Shanghai",
                        country: "CN",
                        categories: ["history"]
                      },
                      {
                        id: "poi-area",
                        name: "French Concession Area",
                        city: "Shanghai",
                        country: "CN",
                        categories: ["history"]
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
                    pois: [
                      {
                        id: "poi-bund",
                        name: bund,
                        address: "\u4e0a\u6d77\u5e02\u9ec4\u6d66\u533a\u4e2d\u5c71\u4e1c\u4e00\u8def",
                        city: shanghai,
                        country: "CN",
                        categories: ["\u591c\u666f"]
                      },
                      {
                        id: "poi-museum",
                        name: shanghaiMuseum,
                        address: "\u4e0a\u6d77\u5e02\u9ec4\u6d66\u533a\u4eba\u6c11\u5927\u9053201\u53f7",
                        city: shanghai,
                        country: "CN",
                        categories: ["\u5386\u53f2"]
                      },
                      {
                        id: "poi-yuyuan",
                        name: yuyuan,
                        address: "\u4e0a\u6d77\u5e02\u9ec4\u6d66\u533a\u798f\u4f51\u8def168\u53f7",
                        city: shanghai,
                        country: "CN",
                        categories: ["\u5386\u53f2"]
                      },
                      {
                        id: "poi-dessert",
                        name: shenDaCheng,
                        address: "\u4e0a\u6d77\u5e02\u9ec4\u6d66\u533a\u5357\u4eac\u4e1c\u8def636\u53f7",
                        city: shanghai,
                        country: "CN",
                        categories: ["\u7f8e\u98df"]
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
                    itinerary: {
                      days: [
                        {
                          title: "\u7b2c 1 \u5929",
                          items: [
                            {
                              poi: {
                                id: "poi-bund",
                                name: bund,
                                city: shanghai,
                                country: "CN"
                              }
                            }
                          ]
                        },
                        {
                          title: "\u7b2c 2 \u5929",
                          items: [
                            {
                              poi: {
                                id: "poi-museum",
                                name: shanghaiMuseum,
                                city: shanghai,
                                country: "CN"
                              }
                            }
                          ]
                        }
                      ]
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
      request: {
        ...request,
        destination: shanghai,
        startDate: "2026-04-08",
        interests: ["\u5386\u53f2", "\u7f8e\u98df", "\u591c\u666f"]
      },
      llmConfig
    });

    expect(result.itinerary.metadata.candidateSource).toBe("llm-fallback");
    expect(result.itinerary.metadata.candidateCount).toBe(4);
    expect(result.itinerary.days[0].items[0].poi.name).toBe(bund);
    expect(result.itinerary.days[0].items[0].poi.address).toContain("\u4e2d\u5c71\u4e1c\u4e00\u8def");
    expect(result.itinerary.days[1].items[0].poi.name).toBe(shanghaiMuseum);
    expect(
      result.itinerary.days.flatMap((day) => day.items).some((item) => item.poi.name.includes("Road"))
    ).toBe(false);
    expect(
      result.itinerary.days.flatMap((day) => day.items).some((item) => item.poi.name.includes("Area"))
    ).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
