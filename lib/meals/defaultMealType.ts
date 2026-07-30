import type { MealType } from "./types";

/**
 * Pick a meal type from the local clock hour.
 *
 * Boundaries (hour in [0, 23]):
 * - [0, 11) breakfast
 * - [11, 15) lunch
 * - [15, 21) dinner
 * - [21, 24) snack
 *
 * `hour` is injectable so tests can lock the boundaries without freezing Date.
 */
export function defaultMealType(hour: number = new Date().getHours()): MealType {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
