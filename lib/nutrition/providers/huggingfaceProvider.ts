import { z } from "zod";
import {
  NutritionInputError,
  NutritionParseError,
  NutritionTimeoutError,
  NutritionUnavailableError,
} from "../errors";
import { fetchPhotoAsDataUrl } from "../fetchPhoto";
import type { NutritionEstimate, NutritionInput, NutritionProvider } from "../types";

// Hugging Face Inference Providers: a hosted, OpenAI-compatible chat completions
// API in front of many open vision-language models. Unlike Ollama this needs no
// server of your own, so it's the option to use once this app is deployed
// (e.g. on Vercel) rather than run against a local machine.
//
// Smaller VLMs (e.g. the 3B variant) aren't routable through any Inference
// Provider on a typical pay-as-you-go HF account - only larger checkpoints
// like this one are, so that's the safe fallback if the env var is unset.
export const DEFAULT_HUGGINGFACE_MODEL = "Qwen/Qwen2.5-VL-72B-Instruct";
const HF_BASE_URL = "https://router.huggingface.co/v1";

function resolveHfApiKey(): string | undefined {
  return process.env.HUGGINGFACE_API_KEY;
}

function resolveHfModel(): string {
  return process.env.HUGGINGFACE_MODEL ?? DEFAULT_HUGGINGFACE_MODEL;
}

function resolveTimeoutMs(): number {
  return Number(process.env.ESTIMATE_TIMEOUT_MS ?? 30_000);
}

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

export const huggingfaceProvider: NutritionProvider = {
  async estimate(input: NutritionInput): Promise<NutritionEstimate> {
    const { photoUrl, description } = input;
    if (!photoUrl && !description?.trim()) {
      throw new NutritionInputError();
    }
    const apiKey = resolveHfApiKey();
    if (!apiKey) {
      throw new NutritionUnavailableError(
        'Missing HUGGINGFACE_API_KEY. Create one at https://huggingface.co/settings/tokens with ' +
          '"Make calls to Inference Providers" permission.',
      );
    }

    const content: Array<Record<string, unknown>> = [{ type: "text", text: buildPrompt(description) }];
    if (photoUrl) {
      // Allowlisted + size-capped: photoUrl is client-supplied and must not become an SSRF proxy.
      const dataUrl = await fetchPhotoAsDataUrl(photoUrl);
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), resolveTimeoutMs());

    let response: Response;
    try {
      response = await fetch(`${HF_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: resolveHfModel(),
          messages: [{ role: "user", content }],
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
        `Hugging Face returned an error (HTTP ${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      throw new NutritionParseError();
    }

    const parsedJson = extractJsonObject(text);
    const result = estimateSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new NutritionParseError();
    }

    return result.data;
  },
};
