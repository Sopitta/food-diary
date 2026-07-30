import { describe, expect, it } from "vitest";
import { parseEstimate } from "./parseEstimate";

describe("parseEstimate", () => {
  it("accepts numeric macros", () => {
    expect(
      parseEstimate({ calories: 450, protein: 30, carbs: 40, fat: 15 }),
    ).toEqual({ calories: 450, protein: 30, carbs: 40, fat: 15 });
  });

  it("accepts numeric strings (common model quirk)", () => {
    expect(
      parseEstimate({ calories: "450", protein: "30.5", carbs: "40", fat: "15" }),
    ).toEqual({ calories: 450, protein: 30.5, carbs: 40, fat: 15 });
  });

  it("accepts trimmed numeric strings and zero macros", () => {
    expect(
      parseEstimate({ calories: " 120 ", protein: "0", carbs: 0, fat: "0.0" }),
    ).toEqual({ calories: 120, protein: 0, carbs: 0, fat: 0 });
  });

  it("rejects null macros instead of coercing them to 0", () => {
    expect(
      parseEstimate({ calories: null, protein: null, carbs: null, fat: null }),
    ).toBeNull();
    // Partial nulls are the dangerous case: plausible calories + invented zero protein.
    expect(
      parseEstimate({ calories: 500, protein: null, carbs: 40, fat: 10 }),
    ).toBeNull();
  });

  it("rejects empty strings and booleans instead of coercing to 0/1", () => {
    expect(
      parseEstimate({ calories: "", protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      parseEstimate({ calories: "   ", protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      parseEstimate({ calories: true, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      parseEstimate({ calories: false, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
  });

  it("rejects negatives, non-numeric strings, and non-finite numbers", () => {
    expect(
      parseEstimate({ calories: -1, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      parseEstimate({ calories: "450kcal", protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      parseEstimate({ calories: Number.NaN, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      parseEstimate({ calories: Number.POSITIVE_INFINITY, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
  });

  it("rejects missing fields and non-object payloads", () => {
    expect(parseEstimate({ calories: 1, protein: 1, carbs: 1 })).toBeNull();
    expect(parseEstimate(null)).toBeNull();
    expect(parseEstimate("not-an-object")).toBeNull();
    expect(parseEstimate([450, 30, 40, 15])).toBeNull();
  });
});
