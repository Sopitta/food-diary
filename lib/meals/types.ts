export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "drink"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
}

export interface Meal {
  id: string;
  photoUrl: string | null;
  description: string | null;
  mealType: MealType | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  createdAt: string;
}

export interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
