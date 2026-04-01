import { addMinutes, formatISO, parse, parseISO } from "date-fns";

export function addMinutesToTime(time: string, minutes: number) {
  const base = parse(time, "HH:mm", new Date());
  return formatISO(addMinutes(base, minutes), { representation: "time" }).slice(0, 5);
}

export function clamp<T>(value: T, min: T, max: T) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function normalizeDateInput(value: string) {
  return parseISO(value);
}
