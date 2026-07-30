import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const insertMeal = vi.fn();
const listMeals = vi.fn();

vi.mock("@/lib/meals/repository", () => ({
  insertMeal: (...args: unknown[]) => insertMeal(...args),
  listMeals: (...args: unknown[]) => listMeals(...args),
}));

import { GET, POST } from "./route";

function postJson(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/meals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validMacros = { calories: 400, protein: 20, carbs: 40, fat: 15 };

describe("GET /api/meals", () => {
  beforeEach(() => {
    listMeals.mockReset();
  });

  it("returns the meal list", async () => {
    const meals = [{ id: "m1", description: "salad" }];
    listMeals.mockResolvedValueOnce(meals);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ meals });
  });

  it("maps repository failures to 500", async () => {
    listMeals.mockRejectedValueOnce(new Error("db down"));
    const response = await GET();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to load meals." });
  });
});

describe("POST /api/meals", () => {
  beforeEach(() => {
    insertMeal.mockReset();
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body." });
    expect(insertMeal).not.toHaveBeenCalled();
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

  it("maps repository failures to 500 with the error message", async () => {
    insertMeal.mockRejectedValueOnce(new Error("Failed to save meal: duplicate"));
    const response = await POST(postJson({ ...validMacros, description: "salad" }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to save meal: duplicate",
    });
  });

  it("rejects non-finite nutrition numbers such as Infinity", async () => {
    const response = await POST(
      postJson({ description: "salad", calories: Infinity, protein: 1, carbs: 1, fat: 1 }),
    );
    expect(response.status).toBe(422);
    expect(insertMeal).not.toHaveBeenCalled();
  });
});
