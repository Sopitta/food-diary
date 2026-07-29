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

function dateKeyFor(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
export function groupMealsByDay(meals: Meal[]): MealDayGroup[] {
  const groups = new Map<string, MealDayGroup>();

  for (const meal of meals) {
    const key = dateKeyFor(meal.createdAt);
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

export function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// Manually formatted (rather than toLocaleTimeString, whose default locale can
// differ between the server's Node process and the browser) so MealCard - a
// client component rendered on both - never hits a hydration mismatch here.
export function formatTime(iso: string): string {
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
  const date = new Date(year, month - 1, day);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
