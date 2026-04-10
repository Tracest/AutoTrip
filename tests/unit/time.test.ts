import {
  addMinutesToTime,
  formatMinutesAsTime,
  normalizeTimeValue,
  tryParseTimeToMinutes
} from "@/lib/utils/time";

describe("time utils", () => {
  it("adds minutes to loosely formatted clock times", () => {
    expect(addMinutesToTime("9:00", 95)).toBe("10:35");
    expect(addMinutesToTime("09：00", 30)).toBe("09:30");
  });

  it("extracts time from ISO timestamps and ranges", () => {
    expect(normalizeTimeValue("2026-04-09T09:15:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
    expect(normalizeTimeValue("09:00 - 10:30", "09:00", { prefer: "last" })).toBe("10:30");
  });

  it("returns null for unparseable values and formats minute counts safely", () => {
    expect(tryParseTimeToMinutes("not-a-time")).toBeNull();
    expect(formatMinutesAsTime(24 * 60 + 5)).toBe("00:05");
  });
});
