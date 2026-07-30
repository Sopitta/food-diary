import { z } from "zod";
import type { NutritionEstimate } from "./types";

/**
 * Parse a single macro field from model JSON.
 *
 * Models often return numeric strings ("450") which we accept, but z.coerce.number()
 * also turns null/"" /false into 0 and true into 1 - which would silently invent
 * macros when the model abstains. Reject those explicitly.
 */
const macroField = z.union([
  z.number().finite().min(0),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Expected a non-negative number")
    .transform((s) => Number(s)),
]);

export const estimateSchema = z.object({
  calories: macroField,
  protein: macroField,
  carbs: macroField,
  fat: macroField,
});

/** Validates model JSON into a NutritionEstimate, or returns null on failure. */
export function parseEstimate(value: unknown): NutritionEstimate | null {
  const result = estimateSchema.safeParse(value);
  return result.success ? result.data : null;
}
