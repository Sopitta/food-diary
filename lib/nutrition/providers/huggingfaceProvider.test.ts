import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NutritionInputError,
  NutritionParseError,
  NutritionTimeoutError,
  NutritionUnavailableError,
} from "../errors";
import {
  DEFAULT_HUGGINGFACE_MODEL,
  huggingfaceProvider,
} from "./huggingfaceProvider";

const ESTIMATE = { calories: 450, protein: 30, carbs: 40, fat: 15 };

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function hfCompletion(content: string): Response {
  return jsonResponse({
    choices: [{ message: { content } }],
  });
}

describe("huggingfaceProvider", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  const SUPABASE_URL = "http://127.0.0.1:54321";
  const SIGNED_PHOTO_URL = `${SUPABASE_URL}/storage/v1/object/sign/meal-photos/abc.jpg?token=test`;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    process.env.HUGGINGFACE_API_KEY = "test-hf-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    delete process.env.HUGGINGFACE_MODEL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.HUGGINGFACE_MODEL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("exports the routable 72B default (not the unroutable 3B checkpoint)", () => {
    expect(DEFAULT_HUGGINGFACE_MODEL).toBe("Qwen/Qwen2.5-VL-72B-Instruct");
    expect(DEFAULT_HUGGINGFACE_MODEL).not.toContain("3B");
  });

  it("sends the default model when HUGGINGFACE_MODEL is unset", async () => {
    fetchMock.mockResolvedValueOnce(hfCompletion(JSON.stringify(ESTIMATE)));

    await huggingfaceProvider.estimate({ description: "grilled chicken salad" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe(DEFAULT_HUGGINGFACE_MODEL);
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-hf-key",
    });
  });

  it("honors an explicit HUGGINGFACE_MODEL override", async () => {
    process.env.HUGGINGFACE_MODEL = "org/custom-vlm";
    fetchMock.mockResolvedValueOnce(hfCompletion(JSON.stringify(ESTIMATE)));

    await huggingfaceProvider.estimate({ description: "oatmeal" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe("org/custom-vlm");
  });

  it("rejects input with neither photo nor description", async () => {
    await expect(huggingfaceProvider.estimate({})).rejects.toBeInstanceOf(NutritionInputError);
    await expect(huggingfaceProvider.estimate({ description: "   " })).rejects.toBeInstanceOf(
      NutritionInputError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails clearly when the API key is missing", async () => {
    delete process.env.HUGGINGFACE_API_KEY;
    await expect(
      huggingfaceProvider.estimate({ description: "pasta" }),
    ).rejects.toBeInstanceOf(NutritionUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses estimates wrapped in prose", async () => {
    fetchMock.mockResolvedValueOnce(
      hfCompletion(`Sure!\n{"calories":"450","protein":30,"carbs":40,"fat":15}\nHope that helps.`),
    );

    await expect(
      huggingfaceProvider.estimate({ description: "burger" }),
    ).resolves.toEqual(ESTIMATE);
  });

  it("throws NutritionParseError for non-JSON model output", async () => {
    fetchMock.mockResolvedValueOnce(hfCompletion("I cannot estimate that."));
    await expect(
      huggingfaceProvider.estimate({ description: "mystery food" }),
    ).rejects.toBeInstanceOf(NutritionParseError);
  });

  it("throws NutritionParseError when nutrition fields are invalid", async () => {
    fetchMock.mockResolvedValueOnce(
      hfCompletion(JSON.stringify({ calories: -1, protein: 1, carbs: 1, fat: 1 })),
    );
    await expect(
      huggingfaceProvider.estimate({ description: "bad macros" }),
    ).rejects.toBeInstanceOf(NutritionParseError);
  });

  it("maps HTTP errors to NutritionUnavailableError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("model not supported", { status: 400 }),
    );
    await expect(
      huggingfaceProvider.estimate({ description: "toast" }),
    ).rejects.toBeInstanceOf(NutritionUnavailableError);
  });

  it("maps aborted requests to NutritionTimeoutError", async () => {
    fetchMock.mockImplementationOnce(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    await expect(
      huggingfaceProvider.estimate({ description: "slow meal" }),
    ).rejects.toBeInstanceOf(NutritionTimeoutError);
  });

  it("inlines photo bytes as a data URL for the chat completion", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(Buffer.from("fake-image"), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      )
      .mockResolvedValueOnce(hfCompletion(JSON.stringify(ESTIMATE)));

    await huggingfaceProvider.estimate({
      photoUrl: SIGNED_PHOTO_URL,
      description: "sushi",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(SIGNED_PHOTO_URL);

    const [, completionInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(String(completionInit.body)) as {
      messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
    };
    const imagePart = body.messages[0].content.find((part) => part.type === "image_url");
    expect(imagePart?.image_url?.url).toMatch(/^data:image\/png;base64,/);
  });

  it("refuses to fetch photo URLs outside this app's Supabase storage (SSRF)", async () => {
    await expect(
      huggingfaceProvider.estimate({
        photoUrl: "http://169.254.169.254/latest/meta-data/",
        description: "probe",
      }),
    ).rejects.toBeInstanceOf(NutritionInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
