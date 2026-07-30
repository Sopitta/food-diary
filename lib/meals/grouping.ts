import type { Meal, MealTotals } from "./types";

// Single-user app with no settings yet, so this is a fixed constant for now.
// Would become a per-user preference once auth/settings exist.
export const DAILY_CALORIE_GOAL = 1800;

// Spelled out explicitly (rather than relying on toLocaleDateString's locale-
// dependent word order) so the date label renders the same everywhere.
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface MealDayGroup {
  dateKey: string;
  meals: Meal[];
  totals: MealTotals;
}

/** Calendar Y/M/D in the given IANA time zone (or the runtime local zone if omitted). */
function calendarParts(isoOrDate: string | Date, timeZone?: string): {
  year: number;
  month: number;
  day: number;
} {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

/**
 * YYYY-MM-DD for the calendar day of `iso` in `timeZone`.
 *
 * Callers that care about the user's day (the meal log) must pass the user's
 * IANA zone. Using the default (runtime local) on a UTC serverless host mis-buckets
 * evening meals for everyone west of UTC.
 */
export function dateKeyFor(iso: string, timeZone?: string): string {
  const { year, month, day } = calendarParts(iso, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function emptyTotals(): MealTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function addToTotals(totals: MealTotals, meal: Meal): MealTotals {
  return {
    calories: totals.calories + (meal.calories ?? 0),
    protein: totals.protein + (meal.protein ?? 0),
    carbs: totals.carbs + (meal.carbs ?? 0),
    fat: totals.fat + (meal.fat ?? 0),
  };
}

/** Groups meals (already sorted newest first) into per-day buckets with running totals. */
export function groupMealsByDay(meals: Meal[], timeZone?: string): MealDayGroup[] {
  const groups = new Map<string, MealDayGroup>();

  for (const meal of meals) {
    const key = dateKeyFor(meal.createdAt, timeZone);
    const existing = groups.get(key);
    if (existing) {
      existing.meals.push(meal);
      existing.totals = addToTotals(existing.totals, meal);
    } else {
      groups.set(key, { dateKey: key, meals: [meal], totals: addToTotals(emptyTotals(), meal) });
    }
  }

  return Array.from(groups.values());
}

export function formatDateLabel(dateKey: string, timeZone?: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const todayKey = dateKeyFor(new Date().toISOString(), timeZone);

  const [ty, tm, td] = todayKey.split("-").map(Number);
  const yesterdayUtc = new Date(Date.UTC(ty, tm - 1, td));
  yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
  const yesterdayKey = `${yesterdayUtc.getUTCFullYear()}-${String(yesterdayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayUtc.getUTCDate()).padStart(2, "0")}`;

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";

  // Noon UTC on the calendar Y-M-D avoids DST edge cases when reading weekday.
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[month - 1]} ${day}`;
}

// Manually formatted (rather than toLocaleTimeString, whose default locale can
// differ between the server's Node process and the browser) so MealCard - a
// client component rendered on both - never hits a hydration mismatch here.
export function formatTime(iso: string, timeZone?: string): string {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(new Date(iso));
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    const period = parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase();
    return `${hour}:${minute} ${period}`;
  }

  const date = new Date(iso);
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
}

/** e.g. "Wed, Jul 29" - shown alongside the "Today"/"Yesterday" label. */
export function formatShortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[month - 1]} ${day}`;
}
