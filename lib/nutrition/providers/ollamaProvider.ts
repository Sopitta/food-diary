import { z } from "zod";
import {
  NutritionInputError,
  NutritionParseError,
  NutritionTimeoutError,
  NutritionUnavailableError,
} from "../errors";
import type { NutritionEstimate, NutritionInput, NutritionProvider } from "../types";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llava";
const TIMEOUT_MS = Number(process.env.ESTIMATE_TIMEOUT_MS ?? 30_000);

const estimateSchema = z.object({
  calories: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
});

const PROMPT = `You are a nutrition estimation assistant. Look at the food (photo and/or description provided) and estimate its nutritional content as best you can.

Respond with ONLY a JSON object in exactly this shape, no other text:
{"calories": <number>, "protein": <number, grams>, "carbs": <number, grams>, "fat": <number, grams>}

If a description is given without a clear serving size, assume a typical single serving. Give your best numeric estimate even if uncertain - never respond with null or a range.`;

async function fetchImageAsBase64(photoUrl: string): Promise<string> {
  const res = await fetch(photoUrl);
  if (!res.ok) {
    throw new NutritionInputError(`Could not load the photo for estimation (HTTP ${res.status}).`);
  }
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

function buildPrompt(description?: string): string {
  if (!description) return PROMPT;
  return `${PROMPT}\n\nDescription provided by the user: "${description}"`;
}

/** Extracts the first top-level JSON object from a string, tolerating extra prose around it. */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new NutritionParseError();
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new NutritionParseError();
  }
}

export const ollamaProvider: NutritionProvider = {
  async estimate(input: NutritionInput): Promise<NutritionEstimate> {
    const { photoUrl, description } = input;
    if (!photoUrl && !description?.trim()) {
      throw new NutritionInputError();
    }

    const images = photoUrl ? [await fetchImageAsBase64(photoUrl)] : undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: buildPrompt(description),
          images,
          format: "json",
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new NutritionTimeoutError();
      }
      throw new NutritionUnavailableError();
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new NutritionUnavailableError(
        `Ollama returned an error (HTTP ${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as { response?: string };
    if (!payload.response) {
      throw new NutritionParseError();
    }

    const parsedJson = extractJsonObject(payload.response);
    const result = estimateSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new NutritionParseError();
    }

    return result.data;
  },
};
