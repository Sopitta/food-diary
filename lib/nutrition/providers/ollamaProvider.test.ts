import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NutritionInputError,
  NutritionParseError,
  NutritionTimeoutError,
  NutritionUnavailableError,
} from "../errors";
import { ollamaProvider } from "./ollamaProvider";

const ESTIMATE = { calories: 320, protein: 18, carbs: 35, fat: 10 };
const SUPABASE_URL = "http://127.0.0.1:54321";
const SIGNED_PHOTO_URL = `${SUPABASE_URL}/storage/v1/object/sign/meal-photos/abc.jpg?token=test`;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("ollamaProvider", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("rejects input with neither photo nor description", async () => {
    await expect(ollamaProvider.estimate({})).rejects.toBeInstanceOf(NutritionInputError);
    await expect(ollamaProvider.estimate({ description: "   " })).rejects.toBeInstanceOf(
      NutritionInputError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts description-only estimates to the generate endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ response: JSON.stringify(ESTIMATE) }));

    await expect(ollamaProvider.estimate({ description: "oatmeal" })).resolves.toEqual(ESTIMATE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/generate");
    const body = JSON.parse(String(init.body)) as {
      prompt: string;
      images?: string[];
      format: string;
      stream: boolean;
    };
    expect(body.format).toBe("json");
    expect(body.stream).toBe(false);
    expect(body.images).toBeUndefined();
    expect(body.prompt).toContain("oatmeal");
  });

  it("inlines allowlisted photo bytes as base64 before calling Ollama", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(new Uint8Array([9, 8, 7]), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ response: JSON.stringify(ESTIMATE) }));

    await ollamaProvider.estimate({
      photoUrl: SIGNED_PHOTO_URL,
      description: "bowl",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(SIGNED_PHOTO_URL);
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { images: string[] };
    expect(body.images).toEqual([Buffer.from([9, 8, 7]).toString("base64")]);
  });

  it("refuses to fetch photo URLs outside this app's Supabase storage (SSRF)", async () => {
    await expect(
      ollamaProvider.estimate({
        photoUrl: "http://169.254.169.254/latest/meta-data/",
        description: "probe",
      }),
    ).rejects.toBeInstanceOf(NutritionInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses JSON wrapped in prose", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ response: `Sure!\n${JSON.stringify(ESTIMATE)}\nDone.` }),
    );
    await expect(ollamaProvider.estimate({ description: "soup" })).resolves.toEqual(ESTIMATE);
  });

  it("throws NutritionParseError when the model returns invalid JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ response: "no macros here" }));
    await expect(ollamaProvider.estimate({ description: "x" })).rejects.toBeInstanceOf(
      NutritionParseError,
    );
  });

  it("throws NutritionParseError when required fields are missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ response: JSON.stringify({ calories: 1 }) }));
    await expect(ollamaProvider.estimate({ description: "x" })).rejects.toBeInstanceOf(
      NutritionParseError,
    );
  });

  it("throws NutritionParseError when the model returns null macros (not coerce to 0)", async () => {
    // Default provider must fail closed on the same abstention shape as Hugging Face.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        response: JSON.stringify({ calories: 500, protein: null, carbs: 40, fat: null }),
      }),
    );
    await expect(ollamaProvider.estimate({ description: "uncertain macros" })).rejects.toBeInstanceOf(
      NutritionParseError,
    );
  });

  it("throws NutritionParseError when macros are empty strings or booleans", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        response: JSON.stringify({ calories: "", protein: false, carbs: true, fat: 10 }),
      }),
    );
    await expect(ollamaProvider.estimate({ description: "coercion traps" })).rejects.toBeInstanceOf(
      NutritionParseError,
    );
  });

  it("maps AbortError to NutritionTimeoutError", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortError);
    await expect(ollamaProvider.estimate({ description: "x" })).rejects.toBeInstanceOf(
      NutritionTimeoutError,
    );
  });

  it("maps other network failures to NutritionUnavailableError", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(ollamaProvider.estimate({ description: "x" })).rejects.toBeInstanceOf(
      NutritionUnavailableError,
    );
  });

  it("maps non-OK Ollama responses to NutritionUnavailableError", async () => {
    fetchMock.mockResolvedValueOnce(new Response("model missing", { status: 404 }));
    await expect(ollamaProvider.estimate({ description: "x" })).rejects.toBeInstanceOf(
      NutritionUnavailableError,
    );
  });

  it("throws NutritionInputError when an allowlisted photo cannot be downloaded", async () => {
    fetchMock.mockResolvedValueOnce(new Response("gone", { status: 404 }));
    await expect(
      ollamaProvider.estimate({ photoUrl: SIGNED_PHOTO_URL }),
    ).rejects.toBeInstanceOf(NutritionInputError);
  });
});
