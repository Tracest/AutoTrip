import {
  isSupportedPlanningDestination,
  resolveSupportedPlanningDestination,
  supportedDestinationGroups,
  SUPPORTED_DESTINATION_COUNT
} from "@/lib/planning/supported-destinations";
import { planningTripRequestSchema } from "@/lib/schemas/trip";

const baseRequest = {
  destination: "上海",
  startDate: "2026-04-10",
  days: 3,
  travelers: 2,
  interests: ["历史", "美食"],
  pace: "balanced" as const,
  budget: "balanced" as const,
  mustVisit: [],
  hotelArea: "",
  notes: ""
};

describe("supported planning destinations", () => {
  it("normalizes destination aliases to the canonical city label", () => {
    expect(resolveSupportedPlanningDestination("Shanghai")).toBe("上海");
    expect(resolveSupportedPlanningDestination("Xi'an")).toBe("西安");

    const parsed = planningTripRequestSchema.parse({
      ...baseRequest,
      destination: "shenzhen"
    });

    expect(parsed.destination).toBe("深圳");
  });

  it("rejects unsupported destinations for new planning requests", () => {
    expect(isSupportedPlanningDestination("贵州")).toBe(false);
    expect(() =>
      planningTripRequestSchema.parse({
        ...baseRequest,
        destination: "贵州"
      })
    ).toThrow(/Destination is not supported yet/);
  });

  it("exposes grouped A-Z city options for the destination selector", () => {
    expect(SUPPORTED_DESTINATION_COUNT).toBeGreaterThan(30);
    expect(
      supportedDestinationGroups.some(
        (group) => group.letter === "S" && group.options.some((option) => option.value === "上海")
      )
    ).toBe(true);
    expect(
      supportedDestinationGroups.some(
        (group) => group.letter === "B" && group.options.some((option) => option.value === "北京")
      )
    ).toBe(true);
  });
});
