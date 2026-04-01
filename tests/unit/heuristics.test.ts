import { buildHeuristicItinerary, getDailyCapacity, scoreCandidates } from "@/lib/planning/heuristics";
import type { Poi, TripRequest } from "@/lib/schemas/trip";

const request: TripRequest = {
  destination: "苏州",
  startDate: "2026-05-01",
  days: 2,
  travelers: 2,
  interests: ["园林", "历史", "美食"],
  pace: "balanced",
  budget: "balanced",
  mustVisit: ["拙政园"],
  hotelArea: "观前街",
  notes: ""
};

const pois: Poi[] = [
  {
    id: "1",
    name: "拙政园",
    address: "苏州园林路",
    city: "苏州",
    country: "CN",
    categories: ["园林", "历史"],
    latitude: 31.326,
    longitude: 120.625,
    recommendedDurationMinutes: 120,
    openingHoursText: "08:30-17:00"
  },
  {
    id: "2",
    name: "平江路",
    address: "平江路",
    city: "苏州",
    country: "CN",
    categories: ["历史", "美食"],
    latitude: 31.319,
    longitude: 120.632,
    recommendedDurationMinutes: 90,
    openingHoursText: "10:00-22:00"
  },
  {
    id: "3",
    name: "山塘街",
    address: "山塘街",
    city: "苏州",
    country: "CN",
    categories: ["历史", "夜景"],
    latitude: 31.335,
    longitude: 120.607,
    recommendedDurationMinutes: 90,
    openingHoursText: "09:00-21:00"
  },
  {
    id: "4",
    name: "苏州博物馆",
    address: "东北街",
    city: "苏州",
    country: "CN",
    categories: ["博物馆", "历史"],
    latitude: 31.327,
    longitude: 120.626,
    recommendedDurationMinutes: 100,
    openingHoursText: "09:00-17:00"
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
    expect(ranked[0].poi.name).toBe("拙政园");
  });

  it("builds a draft itinerary with the requested number of days", () => {
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

    expect(itinerary.days).toHaveLength(2);
    expect(itinerary.days[0].items.length).toBeGreaterThan(0);
  });
});
