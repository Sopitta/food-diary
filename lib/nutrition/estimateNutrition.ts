import { ollamaProvider } from "./providers/ollamaProvider";
import { huggingfaceProvider } from "./providers/huggingfaceProvider";
import type { NutritionEstimate, NutritionInput, NutritionProvider } from "./types";

/**
 * Single seam between the app and whatever model actually produces estimates.
 * Swapping the local Ollama call for a hosted inference API later means adding
 * a new provider here and flipping NUTRITION_PROVIDER - nothing else changes.
 */
function getProvider(): NutritionProvider {
  const providerName = process.env.NUTRITION_PROVIDER ?? "ollama";
  switch (providerName) {
    case "ollama":
      return ollamaProvider;
    case "huggingface":
      return huggingfaceProvider;
    default:
      throw new Error(`Unknown NUTRITION_PROVIDER: "${providerName}"`);
  }
}

export async function estimateNutrition(input: NutritionInput): Promise<NutritionEstimate> {
  const provider = getProvider();
  return provider.estimate(input);
}

export type { NutritionEstimate, NutritionInput } from "./types";
export * from "./errors";
