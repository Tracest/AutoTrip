import type { Itinerary, ItineraryDay, ItineraryItem, PlanningIssue } from "@/lib/schemas/trip";
import { itinerarySchema } from "@/lib/schemas/trip";
import { addMinutesToTime } from "@/lib/utils/time";

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function validateItinerary(itinerary: Itinerary) {
  const issues: PlanningIssue[] = [...itinerary.issues];
  const seenPoiIds = new Set<string>();

  itinerary.days.forEach((day, dayIndex) => {
    let previousEnd = 0;

    day.items.forEach((item, itemIndex) => {
      if (seenPoiIds.has(item.poi.id)) {
        issues.push({
          severity: "warning",
          code: "duplicate-poi",
          message: `${item.poi.name} appears more than once in the itinerary.`,
          source: `day-${dayIndex + 1}-item-${itemIndex + 1}`,
          suggestion: "Remove or replace the duplicate stop."
        });
      }
      seenPoiIds.add(item.poi.id);

      const start = toMinutes(item.startTime);
      const end = toMinutes(item.endTime);

      if (start < previousEnd) {
        issues.push({
          severity: "error",
          code: "time-overlap",
          message: `${item.poi.name} overlaps with the previous stop.`,
          source: `day-${dayIndex + 1}-item-${itemIndex + 1}`,
          suggestion: "Shift later stops forward to restore a valid sequence."
        });
      }

      if (item.travelMinutesFromPrevious > 90) {
        issues.push({
          severity: "warning",
          code: "long-transfer",
          message: `${item.poi.name} has an unusually long transfer time.`,
          source: `day-${dayIndex + 1}-item-${itemIndex + 1}`,
          suggestion: "Consider regrouping the day by area."
        });
      }

      previousEnd = Math.max(previousEnd, end);
    });
  });

  return issues;
}

export function mergeIssues(...groups: PlanningIssue[][]) {
  const seen = new Set<string>();
  return groups
    .flat()
    .filter((issue) => {
      const key = `${issue.code}:${issue.source}:${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function repairItinerary(itinerary: Itinerary) {
  const seenPoiIds = new Set<string>();

  const days = itinerary.days.map((day): ItineraryDay => {
    let currentMinutes = 9 * 60;

    const items = day.items
      .filter((item) => {
        if (seenPoiIds.has(item.poi.id)) {
          return false;
        }
        seenPoiIds.add(item.poi.id);
        return true;
      })
      .map((item, index): ItineraryItem => {
        const startMinutes = Math.max(currentMinutes + item.travelMinutesFromPrevious, toMinutes(item.startTime));
        const endMinutes = startMinutes + item.durationMinutes;
        currentMinutes = endMinutes + (index === 1 ? 60 : 20);
        return {
          ...item,
          startTime: fromMinutes(startMinutes),
          endTime: addMinutesToTime(fromMinutes(startMinutes), item.durationMinutes)
        };
      });

    return {
      ...day,
      items,
      totalTravelMinutes: items.reduce((sum, item) => sum + item.travelMinutesFromPrevious, 0)
    };
  });

  const repaired = itinerarySchema.parse({
    ...itinerary,
    days,
    issues: []
  });

  return {
    itinerary: repaired,
    issues: validateItinerary(repaired)
  };
}
