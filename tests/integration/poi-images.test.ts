import { enrichItineraryPoiImages } from "@/lib/planning/poi-images";
import type { Itinerary } from "@/lib/schemas/trip";

const wikimediaItinerary: Itinerary = {
  request: {
    destination: "上海",
    startDate: "2026-04-12",
    days: 1,
    travelers: 2,
    interests: ["历史", "夜景"],
    pace: "balanced",
    budget: "balanced",
    mustVisit: [],
    hotelArea: "",
    notes: ""
  },
  days: [
    {
      date: "2026-04-12",
      title: "城市初印象",
      totalTravelMinutes: 20,
      intensityScore: 5.5,
      items: [
        {
          id: "day-1-bund",
          category: "夜景",
          startTime: "09:00",
          endTime: "10:30",
          durationMinutes: 90,
          travelMinutesFromPrevious: 0,
          locked: false,
          poi: {
            id: "wikimedia-shanghai-bund",
            name: "外滩",
            address: "上海市黄浦区中山东一路",
            city: "上海",
            country: "CN",
            categories: ["夜景"],
            latitude: 31.2402,
            longitude: 121.4903,
            recommendedDurationMinutes: 90,
            sourcePageUrl: "https://zh.wikipedia.org/wiki/%E5%A4%96%E6%BB%A9"
          }
        }
      ]
    }
  ],
  issues: [],
  metadata: {
    geoProvider: "wikimedia",
    candidateSource: "wikimedia",
    createdAt: new Date().toISOString()
  }
};

describe("itinerary poi image enrichment", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("enriches wikimedia itineraries without changing their structure", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: [
              {
                title: "外滩",
                thumbnail: {
                  source: "https://upload.wikimedia.org/example-bund.jpg",
                  width: 400,
                  height: 260
                }
              }
            ]
          }
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await enrichItineraryPoiImages(wikimediaItinerary);

    expect(result.metadata.geoProvider).toBe("wikimedia");
    expect(result.days[0].items[0].poi.name).toBe("外滩");
    expect(result.days[0].items[0].poi.image?.provider).toBe("wikimedia");
    expect(result.days[0].items[0].poi.image?.url).toContain("upload.wikimedia.org/example-bund.jpg");
  });

  it("leaves the poi untouched when a non-wikimedia itinerary cannot match the wikimedia lookup response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: [
              {
                title: "澶栨哗",
                thumbnail: {
                  source: "https://upload.wikimedia.org/example-bund.jpg",
                  width: 400,
                  height: 260
                }
              }
            ]
          }
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await enrichItineraryPoiImages({
      ...wikimediaItinerary,
      metadata: {
        ...wikimediaItinerary.metadata,
        geoProvider: "amap"
      }
    });

    expect(result.days[0].items[0].poi.image).toBeUndefined();
    expect(global.fetch).not.toBe(originalFetch);
  });
});
