import type { LlmProviderConfig } from "@prisma/client";
import * as geo from "@/lib/geo";
import { buildFallbackMatrix } from "@/lib/geo/shared";
import { encryptString } from "@/lib/security/crypto";
import { planTrip } from "@/lib/planning/engine";
import type { TripRequest } from "@/lib/schemas/trip";

const guiyang = "\u8d35\u9633";
const guizhou = "\u8d35\u5dde";
const jiaxiuLou = "\u7532\u79c0\u697c";
const qingyunMarket = "\u9752\u4e91\u5e02\u96c6";
const qianlingshanPark = "\u9ed4\u7075\u5c71\u516c\u56ed";
const guizhouMuseum = "\u8d35\u5dde\u7701\u535a\u7269\u9986";
const huaguoyuanTwinTowers = "\u82b1\u679c\u56ed\u53cc\u5b50\u5854";
const guizhouProvincePoi = "\u8d35\u5dde\u7701";
const guiyangMetroLine1 = "\u8d35\u9633\u8f68\u9053\u4ea4\u901a1\u53f7\u7ebf";
const guiyangBroadcastStation = "\u8d35\u9633\u5e7f\u64ad\u7535\u89c6\u53f0";
const shanghai = "\u4e0a\u6d77";
const bund = "\u5916\u6ee9";
const shanghaiMuseum = "\u4e0a\u6d77\u535a\u7269\u9986";
const yuyuan = "\u8c6b\u56ed";
const shenDaCheng = "\u6c88\u5927\u6210";
const luoyang = "\u6d1b\u9633";
const longmenGrottoes = "\u9f99\u95e8\u77f3\u7a9f";
const luoyangMuseum = "\u6d1b\u9633\u535a\u7269\u9986";
const luoyiAncientCity = "\u6d1b\u9091\u53e4\u57ce";
const yingtianmen = "\u5e94\u5929\u95e8";
const zhenBuTong = "\u771f\u4e0d\u540c\u6d1b\u9633\u6c34\u5e2d";
const zhengzhou = "\u90d1\u5dde";
const erqiTower = "\u4e8c\u4e03\u7eaa\u5ff5\u5854";
const henanMuseum = "\u6cb3\u5357\u535a\u7269\u9662";
const dejiBraisedNoodles = "\u5fb7\u8bb0\u70e9\u9762";

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
    ).rejects.toThrow(/No usable candidate places|No map provider is configured/);
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
    expect(result.itinerary.metadata.candidateSource).toBe("llm-web-research");
    expect(result.itinerary.issues.some((issue) => issue.code === "llm-web-research-source")).toBe(true);
    expect(result.itinerary.days[0].items[0].poi.id).toContain("paris");
    expect(result.itinerary.days[0].items[0].poi.address).toBe("");
    expect(result.itinerary.days[0].items[0].poi.latitude).toEqual(expect.any(Number));
    expect(result.itinerary.days[0].items[0].poi.longitude).toEqual(expect.any(Number));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("merges core city seed pois after fallback web research still misses food coverage", async () => {
    const llmConfig = {
      id: "cfg_1b",
      ownerId: "admin_1",
      baseUrl: "https://example.com/v1",
      apiKeyEncrypted: encryptString("test-key"),
      model: "demo-model",
      apiStyle: "openai",
      temperature: 0.3,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LlmProviderConfig;

    const fetchMock = vi
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
                        id: "poi-jiaxiu",
                        name: jiaxiuLou,
                        city: guiyang,
                        country: "CN",
                        categories: ["\u5386\u53f2", "\u591c\u666f"]
                      },
                      {
                        id: "poi-museum",
                        name: guizhouMuseum,
                        city: guiyang,
                        country: "CN",
                        categories: ["\u7f8e\u98df"]
                      },
                      {
                        id: "poi-wenchang",
                        name: "\u6587\u660c\u9601",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u5386\u53f2", "\u591c\u666f"]
                      },
                      {
                        id: "poi-dongshan",
                        name: "\u4e1c\u5c71\u516c\u56ed\u89c2\u666f\u53f0",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u591c\u666f"]
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
                        id: "poi-twin-towers",
                        name: huaguoyuanTwinTowers,
                        city: guiyang,
                        country: "CN",
                        categories: ["\u591c\u666f"]
                      },
                      {
                        id: "poi-qianling",
                        name: qianlingshanPark,
                        city: guiyang,
                        country: "CN",
                        categories: ["\u81ea\u7136"]
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
                                id: "seed-guiyang-qingyun",
                                name: qingyunMarket,
                                city: guiyang,
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
                                id: "poi-jiaxiu",
                                name: jiaxiuLou,
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
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await planTrip({
      request: {
        ...request,
        destination: guiyang,
        startDate: "2026-04-10",
        days: 2,
        interests: ["\u5386\u53f2", "\u7f8e\u98df", "\u591c\u666f"],
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      },
      llmConfig,
      skipPoiImageEnrichment: true
    });

    const plannerCallBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ content?: string }>;
    };
    const serializedPlannerPrompt = JSON.stringify(plannerCallBody.messages ?? []);

    expect(result.itinerary.metadata.candidateSource).toBe("hybrid-supplement");
    expect(result.itinerary.issues.some((issue) => issue.code === "core-city-seed-supplement")).toBe(true);
    expect(serializedPlannerPrompt).toContain(qingyunMarket);
    expect(result.itinerary.days.flatMap((day) => day.items).some((item) => item.poi.name === qingyunMarket)).toBe(
      true
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

    expect(result.itinerary.metadata.candidateSource).toBe("llm-web-research");
    expect(result.itinerary.metadata.candidateCount).toBe(4);
    expect(result.itinerary.issues.some((issue) => issue.code === "intl-beta")).toBe(false);
    expect(result.itinerary.days[0].title).toContain("\u521d\u5370\u8c61");
    expect(result.itinerary.days[0].items[0].poi.name).toBe(jiaxiuLou);
    expect(result.itinerary.days[0].items[0].poi.country).toBe("CN");
    expect(/[\u4e00-\u9fff]/u.test(result.itinerary.days[1].title)).toBe(true);
    expect(result.itinerary.days[1].items[0].poi.name).toBe(qingyunMarket);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("narrows province-level destinations to the provincial capital before candidate generation", async () => {
    const llmConfig = {
      id: "cfg_2b",
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

    const fetchMock = vi
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
                          title: "\u7b2c 1 \u5929",
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
                          title: "\u7b2c 2 \u5929",
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
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await planTrip({
      request: {
        ...request,
        destination: guizhou,
        startDate: "2026-04-08",
        interests: ["\u5386\u53f2", "\u7f8e\u98df", "\u591c\u666f"],
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      },
      llmConfig
    });

    const firstCallBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ content?: string }>;
    };
    const serializedPrompt = JSON.stringify(firstCallBody.messages ?? []);

    expect(serializedPrompt).toContain(guiyang);
    expect(result.itinerary.request.destination).toBe(guizhou);
    expect(result.itinerary.metadata.candidateSource).toBe("llm-web-research");
    expect(result.itinerary.issues.some((issue) => issue.code === "broad-destination-fallback")).toBe(true);
    expect(result.itinerary.days[0].items[0].poi.city).toBe(guiyang);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    expect(result.itinerary.metadata.candidateSource).toBe("llm-web-research");
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

  it("filters generic region and infrastructure names while keeping destination-aligned landmarks with bad coordinates", async () => {
    const llmConfig = {
      id: "cfg_guiyang_cleanup",
      ownerId: "admin_1",
      baseUrl: "https://example.com/v1",
      apiKeyEncrypted: encryptString("test-key"),
      model: "demo-model",
      apiStyle: "openai",
      temperature: 0.3,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LlmProviderConfig;

    const fetchMock = vi
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
                        id: "poi-twin-towers",
                        name: huaguoyuanTwinTowers,
                        address: "\u8d35\u9633\u5e02\u5357\u660e\u533a\u82b1\u679c\u56ed\u5927\u88571\u53f7",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u591c\u666f"],
                        latitude: 31.2304,
                        longitude: 121.4737
                      },
                      {
                        id: "poi-jiaxiu",
                        name: jiaxiuLou,
                        address: "\u8d35\u9633\u5e02\u5357\u660e\u533a\u7fe0\u5fae\u5df78\u53f7",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u5386\u53f2", "\u591c\u666f"]
                      },
                      {
                        id: "poi-qingyun",
                        name: qingyunMarket,
                        address: "\u8d35\u9633\u5e02\u5357\u660e\u533a\u9752\u4e91\u8def\u4e1c\u6bb5",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u7f8e\u98df"]
                      },
                      {
                        id: "poi-qianling",
                        name: qianlingshanPark,
                        address: "\u8d35\u9633\u5e02\u4e91\u5ca9\u533a\u67a3\u5c71\u8def187\u53f7",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u81ea\u7136"]
                      },
                      {
                        id: "poi-province",
                        name: guizhouProvincePoi,
                        city: guiyang,
                        country: "CN",
                        categories: ["\u5386\u53f2"]
                      },
                      {
                        id: "poi-metro-line",
                        name: guiyangMetroLine1,
                        city: guiyang,
                        country: "CN",
                        categories: ["\u5386\u53f2"]
                      },
                      {
                        id: "poi-broadcast",
                        name: guiyangBroadcastStation,
                        city: guiyang,
                        country: "CN",
                        categories: ["\u591c\u666f"]
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
                                id: "poi-twin-towers",
                                name: huaguoyuanTwinTowers,
                                city: guiyang,
                                country: "CN"
                              }
                            },
                            {
                              poi: {
                                id: "poi-qingyun",
                                name: qingyunMarket,
                                city: guiyang,
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
                                id: "poi-jiaxiu",
                                name: jiaxiuLou,
                                city: guiyang,
                                country: "CN"
                              }
                            },
                            {
                              poi: {
                                id: "poi-qianling",
                                name: qianlingshanPark,
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
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await planTrip({
      request: {
        ...request,
        destination: guiyang,
        startDate: "2026-04-10",
        days: 2,
        interests: ["\u7f8e\u98df", "\u591c\u666f", "\u81ea\u7136"],
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      },
      llmConfig,
      skipPoiImageEnrichment: true
    });

    const plannerCallBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ content?: string }>;
    };
    const serializedPlannerPrompt = JSON.stringify(plannerCallBody.messages ?? []);

    expect(result.itinerary.metadata.candidateSource).toBe("llm-web-research");
    expect(result.itinerary.metadata.candidateCount).toBe(4);
    expect(serializedPlannerPrompt).toContain(huaguoyuanTwinTowers);
    expect(serializedPlannerPrompt).not.toContain(guizhouProvincePoi);
    expect(serializedPlannerPrompt).not.toContain(guiyangMetroLine1);
    expect(serializedPlannerPrompt).not.toContain(guiyangBroadcastStation);
    expect(result.itinerary.days.flatMap((day) => day.items).some((item) => item.poi.name === huaguoyuanTwinTowers)).toBe(true);
    expect(result.itinerary.issues.some((issue) => issue.code === "geo-outlier-filter")).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("deduplicates semantic poi variants before itinerary refinement", async () => {
    const llmConfig = {
      id: "cfg_guiyang_dedup",
      ownerId: "admin_1",
      baseUrl: "https://example.com/v1",
      apiKeyEncrypted: encryptString("test-key"),
      model: "demo-model",
      apiStyle: "openai",
      temperature: 0.3,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } satisfies LlmProviderConfig;

    const fetchMock = vi
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
                        id: "poi-jiaxiu",
                        name: jiaxiuLou,
                        address: "\u8d35\u9633\u5e02\u5357\u660e\u533a\u7fe0\u5fae\u5df78\u53f7",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u5386\u53f2", "\u591c\u666f"],
                        sourcePageUrl: "https://example.com/jiaxiu"
                      },
                      {
                        id: "poi-jiaxiu-night",
                        name: `${jiaxiuLou}\u591c\u666f`,
                        address: "\u8d35\u9633\u5e02\u5357\u660e\u533a\u7fe0\u5fae\u5df78\u53f7",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u591c\u666f"],
                        sourcePageUrl: "https://example.com/jiaxiu"
                      },
                      {
                        id: "poi-qingyun",
                        name: qingyunMarket,
                        address: "\u8d35\u9633\u5e02\u5357\u660e\u533a\u9752\u4e91\u8def\u4e1c\u6bb5",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u7f8e\u98df"]
                      },
                      {
                        id: "poi-qianling",
                        name: qianlingshanPark,
                        address: "\u8d35\u9633\u5e02\u4e91\u5ca9\u533a\u67a3\u5c71\u8def187\u53f7",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u81ea\u7136"]
                      },
                      {
                        id: "poi-dongshan",
                        name: "\u4e1c\u5c71\u516c\u56ed\u89c2\u666f\u53f0",
                        address: "\u8d35\u9633\u5e02\u4e91\u5ca9\u533a\u4e1c\u5c71\u8def",
                        city: guiyang,
                        country: "CN",
                        categories: ["\u591c\u666f"]
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
                                id: "poi-jiaxiu",
                                name: jiaxiuLou,
                                city: guiyang,
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
                                id: "poi-qingyun",
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
      );

    global.fetch = fetchMock as typeof fetch;

    const result = await planTrip({
      request: {
        ...request,
        destination: guiyang,
        startDate: "2026-04-10",
        days: 2,
        interests: ["\u7f8e\u98df", "\u591c\u666f", "\u81ea\u7136"],
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      },
      llmConfig
    });

    const plannerCallBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ content?: string }>;
    };
    const serializedPlannerPrompt = JSON.stringify(plannerCallBody.messages ?? []);

    expect(result.itinerary.metadata.candidateSource).toBe("llm-web-research");
    expect(result.itinerary.metadata.candidateCount).toBe(4);
    expect(serializedPlannerPrompt).toContain(jiaxiuLou);
    expect(serializedPlannerPrompt).not.toContain(`${jiaxiuLou}\u591c\u666f`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("supplements missing interest coverage with the LLM when an unsupported city misses food", async () => {
    delete process.env.AUTO_TRIP_FORCE_MOCK;

    vi.spyOn(geo, "createGeoProvider").mockReturnValue({
      name: "wikimedia",
      capabilities: {
        supportsCountryFallback: true,
        supportsOpeningHours: true,
        accurateInternational: false
      },
      async searchPois() {
        return [
          {
            id: "poi-history-1",
            name: longmenGrottoes,
            address: "洛阳市洛龙区龙门中街13号",
            city: luoyang,
            country: "CN",
            categories: ["历史", "夜景"],
            latitude: 34.559944,
            longitude: 112.47794,
            recommendedDurationMinutes: 90
          },
          {
            id: "poi-history-2",
            name: luoyangMuseum,
            address: "洛阳市洛龙区聂泰路",
            city: luoyang,
            country: "CN",
            categories: ["博物馆", "历史"],
            latitude: 34.619733,
            longitude: 112.454758,
            recommendedDurationMinutes: 120
          },
          {
            id: "poi-night-1",
            name: luoyiAncientCity,
            address: "洛阳市老城区九都东路",
            city: luoyang,
            country: "CN",
            categories: ["观景", "夜景"],
            latitude: 34.679981,
            longitude: 112.477187,
            recommendedDurationMinutes: 60
          },
          {
            id: "poi-night-2",
            name: yingtianmen,
            address: "洛阳市西工区定鼎南路",
            city: luoyang,
            country: "CN",
            categories: ["观景", "夜景"],
            latitude: 34.667269,
            longitude: 112.441077,
            recommendedDurationMinutes: 60
          }
        ];
      },
      async getPoiDetail() {
        return null;
      },
      async getTravelMatrix(points) {
        return buildFallbackMatrix(points);
      },
      async getOpeningHours() {
        return undefined;
      }
    });

    const llmConfig = {
      id: "cfg_4",
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
                    pois: [
                      {
                        id: "poi-food-1",
                        name: zhenBuTong,
                        city: luoyang,
                        country: "CN",
                        categories: ["小吃", "美食"]
                      },
                      {
                        id: "poi-food-2",
                        name: "小街锅贴",
                        city: luoyang,
                        country: "CN",
                        categories: ["餐饮", "美食"]
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
                          title: "第 1 天",
                          items: [
                            {
                              poi: {
                                id: "poi-history-1",
                                name: longmenGrottoes,
                                city: luoyang,
                                country: "CN"
                              }
                            }
                          ]
                        },
                        {
                          title: "第 2 天",
                          items: [
                            {
                              poi: {
                                id: "poi-food-1",
                                name: zhenBuTong,
                                city: luoyang,
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
        destination: luoyang,
        startDate: "2026-04-11",
        days: 2,
        interests: ["历史", "美食", "夜景"],
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      },
      llmConfig
    });

    expect(result.itinerary.metadata.candidateSource).toBe("hybrid-supplement");
    expect(result.itinerary.issues.some((issue) => issue.code === "interest-coverage-supplement")).toBe(true);
    expect(result.itinerary.days.flatMap((day) => day.items).some((item) => item.poi.name === zhenBuTong)).toBe(
      true
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("merges core city seed pois when a seeded city's live candidates miss food", async () => {
    delete process.env.AUTO_TRIP_FORCE_MOCK;

    vi.spyOn(geo, "createGeoProvider").mockReturnValue({
      name: "wikimedia",
      capabilities: {
        supportsCountryFallback: true,
        supportsOpeningHours: true,
        accurateInternational: false
      },
      async searchPois() {
        return [
          {
            id: "poi-history-1",
            name: jiaxiuLou,
            address: "贵阳市南明区翠微巷8号",
            city: guiyang,
            country: "CN",
            categories: ["历史", "夜景"],
            latitude: 26.578343,
            longitude: 106.714219,
            recommendedDurationMinutes: 90
          },
          {
            id: "poi-history-2",
            name: guizhouMuseum,
            address: "贵阳市观山湖区林城东路107号",
            city: guiyang,
            country: "CN",
            categories: ["博物馆", "历史"],
            latitude: 26.647661,
            longitude: 106.624805,
            recommendedDurationMinutes: 120
          },
          {
            id: "poi-night-1",
            name: "文昌阁",
            address: "贵阳市云岩区文昌北路",
            city: guiyang,
            country: "CN",
            categories: ["观景", "夜景"],
            latitude: 26.58741,
            longitude: 106.71941,
            recommendedDurationMinutes: 60
          },
          {
            id: "poi-night-2",
            name: "东山公园观景台",
            address: "贵阳市云岩区东山路",
            city: guiyang,
            country: "CN",
            categories: ["观景", "夜景"],
            latitude: 26.59421,
            longitude: 106.73101,
            recommendedDurationMinutes: 60
          }
        ];
      },
      async getPoiDetail() {
        return null;
      },
      async getTravelMatrix(points) {
        return buildFallbackMatrix(points);
      },
      async getOpeningHours() {
        return undefined;
      }
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: []
          }
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await planTrip({
      request: {
        ...request,
        destination: guiyang,
        startDate: "2026-04-11",
        days: 2,
        interests: ["历史", "美食", "夜景"],
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      }
    });

    expect(result.itinerary.metadata.candidateSource).toBe("wikimedia");
    expect(result.itinerary.issues.some((issue) => issue.code === "core-city-seed-supplement")).toBe(true);
    expect(
      result.itinerary.days.flatMap((day) => day.items).some((item) =>
        [qingyunMarket, "丝恋丝娃娃", "民生路美食街"].includes(item.poi.name)
      )
    ).toBe(true);
  });

  it("falls back to core city seed pois when live wikimedia lookup fails for a seeded city", async () => {
    delete process.env.AUTO_TRIP_FORCE_MOCK;

    vi.spyOn(geo, "createGeoProvider").mockReturnValue({
      name: "wikimedia",
      capabilities: {
        supportsCountryFallback: true,
        supportsOpeningHours: true,
        accurateInternational: false
      },
      async searchPois() {
        throw new Error("Upstream timeout");
      },
      async getPoiDetail() {
        return null;
      },
      async getTravelMatrix(points) {
        return buildFallbackMatrix(points);
      },
      async getOpeningHours() {
        return undefined;
      }
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: []
          }
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await planTrip({
      request: {
        ...request,
        destination: guiyang,
        startDate: "2026-04-12",
        days: 2,
        interests: ["历史", "美食", "夜景"],
        mustVisit: [],
        hotelArea: undefined,
        notes: undefined
      }
    });

    expect(result.itinerary.metadata.candidateSource).toBe("core-city-seeds");
    expect(result.itinerary.issues.some((issue) => issue.code === "core-city-seed-fallback")).toBe(true);
    expect(
      result.itinerary.days.flatMap((day) => day.items).some((item) =>
        item.poi.categories.some((category) => ["美食", "小吃", "餐饮"].includes(category))
      )
    ).toBe(true);
  });
});
