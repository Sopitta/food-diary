import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  NutritionInputError,
  NutritionParseError,
  NutritionTimeoutError,
  NutritionUnavailableError,
} from "@/lib/nutrition/errors";

const estimateNutrition = vi.fn();

vi.mock("@/lib/nutrition/estimateNutrition", async () => {
  const actual = await vi.importActual<typeof import("@/lib/nutrition/estimateNutrition")>(
    "@/lib/nutrition/estimateNutrition",
  );
  return {
    ...actual,
    estimateNutrition: (...args: unknown[]) => estimateNutrition(...args),
  };
});

import { POST } from "./route";

function postJson(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/estimate", () => {
  beforeEach(() => {
    estimateNutrition.mockReset();
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(postJson("{not-json"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body." });
  });

  it("returns the estimate on success", async () => {
    estimateNutrition.mockResolvedValueOnce({
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
    });

    const response = await POST(postJson({ description: "yogurt" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
    });
  });

  it("maps nutrition domain errors to the expected HTTP statuses", async () => {
    const cases = [
      { error: new NutritionInputError("need input"), status: 422 },
      { error: new NutritionParseError("bad json"), status: 422 },
      { error: new NutritionTimeoutError("too slow"), status: 504 },
      { error: new NutritionUnavailableError("down"), status: 503 },
    ] as const;

    for (const { error, status } of cases) {
      estimateNutrition.mockRejectedValueOnce(error);
      const response = await POST(postJson({ description: "x" }));
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: error.message });
    }
  });

  it("returns 500 for unexpected failures", async () => {
    estimateNutrition.mockRejectedValueOnce(new Error("boom"));
    const response = await POST(postJson({ description: "x" }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Something went wrong while estimating nutrition.",
    });
  });
});
