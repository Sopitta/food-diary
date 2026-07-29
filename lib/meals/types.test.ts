import { describe, expect, it } from "vitest";
import { isMealType, MEAL_TYPES } from "./types";

describe("isMealType", () => {
  it("accepts every declared meal type", () => {
    for (const type of MEAL_TYPES) {
      expect(isMealType(type)).toBe(true);
    }
  });

  it("rejects unknown or non-string values", () => {
    expect(isMealType("brunch")).toBe(false);
    expect(isMealType("")).toBe(false);
    expect(isMealType(null)).toBe(false);
    expect(isMealType(undefined)).toBe(false);
    expect(isMealType(1)).toBe(false);
  });
});
