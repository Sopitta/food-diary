import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const deleteMeal = vi.fn();
const updateMealDescription = vi.fn();

vi.mock("@/lib/meals/repository", () => ({
  deleteMeal: (...args: unknown[]) => deleteMeal(...args),
  updateMealDescription: (...args: unknown[]) => updateMealDescription(...args),
}));

import { DELETE, PATCH } from "./route";

function patchJson(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/meals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function deleteRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/meals/${id}`, { method: "DELETE" });
}

describe("DELETE /api/meals/[id]", () => {
  beforeEach(() => {
    deleteMeal.mockReset();
  });

  it("deletes an existing meal", async () => {
    deleteMeal.mockResolvedValueOnce(undefined);
    const response = await DELETE(deleteRequest("meal-1"), {
      params: Promise.resolve({ id: "meal-1" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteMeal).toHaveBeenCalledWith("meal-1");
  });

  it("maps a missing meal to 404", async () => {
    deleteMeal.mockRejectedValueOnce(new Error("Meal not found."));
    const response = await DELETE(deleteRequest("missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Meal not found." });
  });

  it("maps unexpected failures to 500", async () => {
    deleteMeal.mockRejectedValueOnce(new Error("db down"));
    const response = await DELETE(deleteRequest("meal-1"), {
      params: Promise.resolve({ id: "meal-1" }),
    });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "db down" });
  });
});

describe("PATCH /api/meals/[id]", () => {
  beforeEach(() => {
    updateMealDescription.mockReset();
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await PATCH(patchJson("meal-1", "{not-json"), {
      params: Promise.resolve({ id: "meal-1" }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body." });
  });

  it("rejects empty or whitespace-only descriptions", async () => {
    for (const description of ["", "   ", null, undefined, 42]) {
      updateMealDescription.mockReset();
      const response = await PATCH(patchJson("meal-1", { description }), {
        params: Promise.resolve({ id: "meal-1" }),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "Meal name can't be empty." });
      expect(updateMealDescription).not.toHaveBeenCalled();
    }
  });

  it("trims and persists a valid description", async () => {
    updateMealDescription.mockResolvedValueOnce({ id: "meal-1", description: "Chicken bowl" });
    const response = await PATCH(patchJson("meal-1", { description: "  Chicken bowl  " }), {
      params: Promise.resolve({ id: "meal-1" }),
    });
    expect(response.status).toBe(200);
    expect(updateMealDescription).toHaveBeenCalledWith("meal-1", "Chicken bowl");
    await expect(response.json()).resolves.toEqual({
      meal: { id: "meal-1", description: "Chicken bowl" },
    });
  });

  it("maps a missing meal to 404", async () => {
    updateMealDescription.mockRejectedValueOnce(new Error("Meal not found."));
    const response = await PATCH(patchJson("missing", { description: "Soup" }), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Meal not found." });
  });
});
