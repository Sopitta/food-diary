import { describe, expect, it } from "vitest";
import { defaultMealType } from "./defaultMealType";

describe("defaultMealType", () => {
  it("maps hour boundaries to breakfast / lunch / dinner / snack", () => {
    expect(defaultMealType(0)).toBe("breakfast");
    expect(defaultMealType(10)).toBe("breakfast");
    expect(defaultMealType(11)).toBe("lunch");
    expect(defaultMealType(14)).toBe("lunch");
    expect(defaultMealType(15)).toBe("dinner");
    expect(defaultMealType(20)).toBe("dinner");
    expect(defaultMealType(21)).toBe("snack");
    expect(defaultMealType(23)).toBe("snack");
  });
});
