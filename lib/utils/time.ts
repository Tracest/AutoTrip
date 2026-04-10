import { isValid, parseISO } from "date-fns";

const MINUTES_PER_DAY = 24 * 60;
const defaultFallbackMinutes = 9 * 60;

type TimeParseOptions = {
  fallback?: number | string;
  prefer?: "first" | "last";
};

const clockTimePattern =
  /(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})(?:[:：.点时](\d{1,2}))?(?:[:：](\d{1,2}))?\s*(am|pm)?/gi;

function normalizeMinutes(value: number) {
  return ((Math.trunc(value) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function resolveFallbackMinutes(fallback?: number | string) {
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return Math.trunc(fallback);
  }

  if (typeof fallback === "string") {
    const parsed = tryParseTimeToMinutes(fallback, { prefer: "first" });
    if (parsed !== null) {
      return parsed;
    }
  }

  return defaultFallbackMinutes;
}

function to24HourMinutes(
  rawHours: number,
  rawMinutes: number,
  suffix?: string,
  meridiem?: string
) {
  if (!Number.isFinite(rawHours) || !Number.isFinite(rawMinutes)) {
    return null;
  }

  if (rawMinutes < 0 || rawMinutes >= 60 || rawHours < 0 || rawHours > 24) {
    return null;
  }

  let hours = rawHours;
  const normalizedSuffix = suffix?.toLowerCase();

  if (normalizedSuffix === "am") {
    hours = hours === 12 ? 0 : hours;
  } else if (normalizedSuffix === "pm") {
    hours = hours < 12 ? hours + 12 : hours;
  } else if (meridiem) {
    if (/下午|晚上|中午/.test(meridiem)) {
      hours = hours < 12 ? hours + 12 : hours;
    } else if (/凌晨|早上|上午/.test(meridiem)) {
      hours = hours === 12 ? 0 : hours;
    }
  }

  if (hours === 24 && rawMinutes > 0) {
    return null;
  }

  return normalizeMinutes(hours * 60 + rawMinutes);
}

export function formatMinutesAsTime(value: number) {
  const normalized = normalizeMinutes(value);
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function tryParseTimeToMinutes(value: string, options: Omit<TimeParseOptions, "fallback"> = {}) {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (/\d{4}-\d{1,2}-\d{1,2}/.test(raw) || raw.includes("T")) {
    const parsedDate = parseISO(raw);
    if (isValid(parsedDate)) {
      return parsedDate.getHours() * 60 + parsedDate.getMinutes();
    }
  }

  const matches = [...raw.matchAll(clockTimePattern)];
  if (matches.length === 0) {
    return null;
  }

  const match = options.prefer === "last" ? matches[matches.length - 1] : matches[0];
  const hours = Number(match[2]);
  const minutes = match[3] ? Number(match[3]) : 0;
  const seconds = match[4] ? Number(match[4]) : 0;

  if (seconds >= 60) {
    return null;
  }

  return to24HourMinutes(hours, minutes, match[5], match[1]);
}

export function parseTimeToMinutes(value: string, options: TimeParseOptions = {}) {
  return tryParseTimeToMinutes(value, { prefer: options.prefer }) ?? resolveFallbackMinutes(options.fallback);
}

export function normalizeTimeValue(value: string, fallback = "09:00", options: Omit<TimeParseOptions, "fallback"> = {}) {
  return formatMinutesAsTime(parseTimeToMinutes(value, { fallback, prefer: options.prefer }));
}

export function addMinutesToTime(time: string, minutes: number) {
  const baseMinutes = parseTimeToMinutes(time, { fallback: defaultFallbackMinutes, prefer: "first" });
  const safeMinutes = Number.isFinite(minutes) ? Math.trunc(minutes) : 0;
  return formatMinutesAsTime(baseMinutes + safeMinutes);
}

export function clamp<T>(value: T, min: T, max: T) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function normalizeDateInput(value: string) {
  return parseISO(value);
}
