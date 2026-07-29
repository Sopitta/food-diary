import { afterEach, describe, expect, it, vi } from "vitest";

const ollamaEstimate = vi.fn();
const huggingfaceEstimate = vi.fn();

vi.mock("./providers/ollamaProvider", () => ({
  ollamaProvider: {
    estimate: (...args: unknown[]) => ollamaEstimate(...args),
  },
}));

vi.mock("./providers/huggingfaceProvider", () => ({
  huggingfaceProvider: {
    estimate: (...args: unknown[]) => huggingfaceEstimate(...args),
  },
  DEFAULT_HUGGINGFACE_MODEL: "Qwen/Qwen2.5-VL-72B-Instruct",
}));

describe("estimateNutrition", () => {
  afterEach(() => {
    delete process.env.NUTRITION_PROVIDER;
    ollamaEstimate.mockReset();
    huggingfaceEstimate.mockReset();
  });

  it("defaults to the ollama provider", async () => {
    const { estimateNutrition } = await import("./estimateNutrition");
    ollamaEstimate.mockResolvedValueOnce({ calories: 1, protein: 1, carbs: 1, fat: 1 });

    await estimateNutrition({ description: "eggs" });

    expect(ollamaEstimate).toHaveBeenCalledWith({ description: "eggs" });
    expect(huggingfaceEstimate).not.toHaveBeenCalled();
  });

  it("routes to huggingface when NUTRITION_PROVIDER=huggingface", async () => {
    process.env.NUTRITION_PROVIDER = "huggingface";
    const { estimateNutrition } = await import("./estimateNutrition");
    huggingfaceEstimate.mockResolvedValueOnce({ calories: 2, protein: 2, carbs: 2, fat: 2 });

    await estimateNutrition({ description: "rice" });

    expect(huggingfaceEstimate).toHaveBeenCalledWith({ description: "rice" });
    expect(ollamaEstimate).not.toHaveBeenCalled();
  });

  it("rejects unknown provider names", async () => {
    process.env.NUTRITION_PROVIDER = "not-a-real-provider";
    const { estimateNutrition } = await import("./estimateNutrition");

    await expect(estimateNutrition({ description: "soup" })).rejects.toThrow(
      /Unknown NUTRITION_PROVIDER/,
    );
  });
});
