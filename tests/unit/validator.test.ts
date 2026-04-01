import { repairItinerary, validateItinerary } from "@/lib/planning/validator";
import type { Itinerary } from "@/lib/schemas/trip";

const itinerary: Itinerary = {
  request: {
    destination: "杭州",
    startDate: "2026-06-01",
    days: 1,
    travelers: 2,
    interests: ["自然", "美食"],
    pace: "balanced",
    budget: "balanced",
    mustVisit: [],
    hotelArea: "西湖",
    notes: ""
  },
  days: [
    {
      date: "2026-06-01",
      title: "西湖经典线",
      totalTravelMinutes: 100,
      intensityScore: 7,
      items: [
        {
          id: "1",
          category: "自然",
          startTime: "09:00",
          endTime: "11:00",
          durationMinutes: 120,
          travelMinutesFromPrevious: 0,
          locked: false,
          poi: {
            id: "poi-west-lake",
            name: "西湖",
            address: "西湖景区",
            city: "杭州",
            country: "CN",
            categories: ["自然"],
            latitude: 30.243,
            longitude: 120.15,
            recommendedDurationMinutes: 120
          }
        },
        {
          id: "2",
          category: "美食",
          startTime: "10:30",
          endTime: "12:00",
          durationMinutes: 90,
          travelMinutesFromPrevious: 95,
          locked: false,
          poi: {
            id: "poi-west-lake",
            name: "西湖",
            address: "西湖景区",
            city: "杭州",
            country: "CN",
            categories: ["自然"],
            latitude: 30.243,
            longitude: 120.15,
            recommendedDurationMinutes: 120
          }
        }
      ]
    }
  ],
  issues: [],
  metadata: {
    geoProvider: "mock",
    createdAt: new Date().toISOString()
  }
};

describe("itinerary validator", () => {
  it("detects duplicates, overlaps, and long transfers", () => {
    const issues = validateItinerary(itinerary);
    expect(issues.some((issue) => issue.code === "duplicate-poi")).toBe(true);
    expect(issues.some((issue) => issue.code === "time-overlap")).toBe(true);
    expect(issues.some((issue) => issue.code === "long-transfer")).toBe(true);
  });

  it("repairs sequence timing and removes duplicate pois", () => {
    const repaired = repairItinerary(itinerary);
    expect(repaired.itinerary.days[0].items).toHaveLength(1);
    expect(repaired.issues.length).toBe(0);
  });
});
