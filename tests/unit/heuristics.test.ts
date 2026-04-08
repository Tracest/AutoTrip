import { buildHeuristicItinerary, getDailyCapacity, scoreCandidates } from "@/lib/planning/heuristics";
import type { Poi, TripRequest } from "@/lib/schemas/trip";

const request: TripRequest = {
  destination: "\u82cf\u5dde",
  startDate: "2026-05-01",
  days: 1,
  travelers: 2,
  interests: ["\u5386\u53f2", "\u7f8e\u98df", "\u591c\u666f"],
  pace: "balanced",
  budget: "balanced",
  mustVisit: ["\u62d9\u653f\u56ed"],
  hotelArea: "\u89c2\u524d\u8857",
  notes: ""
};

const pois: Poi[] = [
  {
    id: "garden",
    name: "\u62d9\u653f\u56ed",
    address: "\u82cf\u5dde\u5e02\u4e1c\u5317\u8857178\u53f7",
    city: "\u82cf\u5dde",
    country: "CN",
    categories: ["\u5386\u53f2", "\u56ed\u6797"],
    latitude: 31.326,
    longitude: 120.625,
    recommendedDurationMinutes: 120,
    openingHoursText: "07:30-17:30"
  },
  {
    id: "museum",
    name: "\u82cf\u5dde\u535a\u7269\u9986",
    address: "\u82cf\u5dde\u5e02\u4e1c\u5317\u8857204\u53f7",
    city: "\u82cf\u5dde",
    country: "CN",
    categories: ["\u535a\u7269\u9986", "\u5386\u53f2"],
    latitude: 31.327,
    longitude: 120.626,
    recommendedDurationMinutes: 100,
    openingHoursText: "09:00-17:00"
  },
  {
    id: "food",
    name: "\u677e\u9e64\u697c",
    address: "\u82cf\u5dde\u5e02\u89c2\u524d\u8857141\u53f7",
    city: "\u82cf\u5dde",
    country: "CN",
    categories: ["\u7f8e\u98df"],
    latitude: 31.312,
    longitude: 120.618,
    recommendedDurationMinutes: 90,
    openingHoursText: "10:30-20:30"
  },
  {
    id: "night",
    name: "\u5c71\u5858\u8857",
    address: "\u82cf\u5dde\u5e02\u59d1\u82cf\u533a\u5c71\u5858\u8857",
    city: "\u82cf\u5dde",
    country: "CN",
    categories: ["\u5386\u53f2", "\u591c\u666f"],
    latitude: 31.335,
    longitude: 120.607,
    recommendedDurationMinutes: 90,
    openingHoursText: "09:00-21:00"
  }
];

describe("planning heuristics", () => {
  it("uses pace to control daily capacity", () => {
    expect(getDailyCapacity("easy")).toBe(3);
    expect(getDailyCapacity("balanced")).toBe(4);
    expect(getDailyCapacity("packed")).toBe(5);
  });

  it("scores must-visit pois above other candidates", () => {
    const ranked = scoreCandidates(request, pois);
    expect(ranked[0].poi.name).toBe("\u62d9\u653f\u56ed");
  });

  it("places food around midday and night views near the end of the day", () => {
    const ranked = scoreCandidates(request, pois);
    const itinerary = buildHeuristicItinerary(
      request,
      ranked,
      [],
      {
        geoProvider: "mock",
        createdAt: new Date().toISOString()
      },
      []
    );

    expect(itinerary.days).toHaveLength(1);
    expect(itinerary.days[0].title).toContain("\u521d\u5370\u8c61");
    expect(itinerary.days[0].items[1].notes).toContain("\u5348\u9910");
    expect(
      itinerary.days[0].items
        .slice(1, -1)
        .some((item) => item.category === "\u7f8e\u98df")
    ).toBe(true);
    expect(itinerary.days[0].items.at(-1)?.category).toBe("\u591c\u666f");
  });
});
