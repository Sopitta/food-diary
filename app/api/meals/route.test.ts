import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const insertMeal = vi.fn();
const listMeals = vi.fn();

vi.mock("@/lib/meals/repository", () => ({
  insertMeal: (...args: unknown[]) => insertMeal(...args),
  listMeals: (...args: unknown[]) => listMeals(...args),
}));

import { POST } from "./route";

function postJson(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/meals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validMacros = { calories: 400, protein: 20, carbs: 40, fat: 15 };

describe("POST /api/meals", () => {
  beforeEach(() => {
    insertMeal.mockReset();
  });

  it("requires a photo or non-empty description", async () => {
    const response = await POST(postJson({ ...validMacros, description: "  " }));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Provide a photo, a description, or both.",
    });
    expect(insertMeal).not.toHaveBeenCalled();
  });

  it("rejects invalid mealType values", async () => {
    const response = await POST(
      postJson({ ...validMacros, description: "salad", mealType: "brunch" }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "Invalid mealType." });
  });

  it("rejects missing or non-finite nutrition numbers", async () => {
    const response = await POST(
      postJson({ description: "salad", calories: 1, protein: NaN, carbs: 1, fat: 1 }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "calories, protein, carbs, and fat must all be numbers.",
    });
  });

  it("persists a valid meal", async () => {
    insertMeal.mockResolvedValueOnce({ id: "m1" });
    const response = await POST(
      postJson({
        ...validMacros,
        description: "salad",
        mealType: "lunch",
        photoPath: "photos/a.jpg",
      }),
    );
    expect(response.status).toBe(201);
    expect(insertMeal).toHaveBeenCalledWith({
      photoPath: "photos/a.jpg",
      description: "salad",
      mealType: "lunch",
      ...validMacros,
    });
  });
});
