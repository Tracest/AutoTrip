import { buildFallbackMatrix, haversineMinutes } from "@/lib/geo/shared";
import type { Poi } from "@/lib/schemas/trip";

const poiA: Poi = {
  id: "a",
  name: "A",
  address: "A road",
  city: "Shanghai",
  country: "CN",
  categories: ["历史"],
  latitude: 31.2304,
  longitude: 121.4737,
  recommendedDurationMinutes: 90
};

const poiB: Poi = {
  id: "b",
  name: "B",
  address: "B road",
  city: "Shanghai",
  country: "CN",
  categories: ["美食"],
  latitude: 31.2404,
  longitude: 121.4837,
  recommendedDurationMinutes: 90
};

describe("geo shared helpers", () => {
  it("estimates travel time using haversine distance", () => {
    expect(haversineMinutes(poiA, poiB)).toBeGreaterThan(0);
  });

  it("builds a fallback matrix across poi pairs", () => {
    const matrix = buildFallbackMatrix([poiA, poiB]);
    expect(matrix).toHaveLength(2);
    expect(matrix[0]).toMatchObject({
      fromPoiId: expect.any(String),
      toPoiId: expect.any(String),
      minutes: expect.any(Number)
    });
  });
});
