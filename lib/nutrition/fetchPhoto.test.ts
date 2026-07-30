import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NutritionInputError } from "./errors";
import {
  assertAllowedPhotoUrl,
  fetchPhotoAsBase64,
  fetchPhotoAsDataUrl,
  MAX_ESTIMATE_PHOTO_BYTES,
} from "./fetchPhoto";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SIGNED_PHOTO_URL = `${SUPABASE_URL}/storage/v1/object/sign/meal-photos/abc.jpg?token=test`;

describe("assertAllowedPhotoUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("accepts signed URLs from this project's Supabase origin", () => {
    expect(assertAllowedPhotoUrl(SIGNED_PHOTO_URL).href).toBe(SIGNED_PHOTO_URL);
  });

  it("rejects URLs on other hosts (SSRF)", () => {
    expect(() => assertAllowedPhotoUrl("http://169.254.169.254/latest/meta-data/")).toThrow(
      NutritionInputError,
    );
    expect(() => assertAllowedPhotoUrl("https://evil.example/meal.png")).toThrow(
      NutritionInputError,
    );
  });

  it("rejects same-origin URLs that are not storage signed-object paths", () => {
    expect(() =>
      assertAllowedPhotoUrl(`${SUPABASE_URL}/storage/v1/object/public/meal-photos/abc.jpg`),
    ).toThrow(NutritionInputError);
    expect(() => assertAllowedPhotoUrl(`${SUPABASE_URL}/auth/v1/user`)).toThrow(
      NutritionInputError,
    );
  });

  it("fails closed when NEXT_PUBLIC_SUPABASE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => assertAllowedPhotoUrl(SIGNED_PHOTO_URL)).toThrow(NutritionInputError);
  });

  it("rejects malformed photo URLs and an invalid Supabase base URL", () => {
    expect(() => assertAllowedPhotoUrl("not a url")).toThrow(NutritionInputError);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "also not a url";
    expect(() => assertAllowedPhotoUrl(SIGNED_PHOTO_URL)).toThrow(NutritionInputError);
  });

  it("rejects lookalike hosts and userinfo tricks that change the origin", () => {
    expect(() =>
      assertAllowedPhotoUrl(
        "http://127.0.0.1:54321.evil.example/storage/v1/object/sign/meal-photos/x.jpg",
      ),
    ).toThrow(NutritionInputError);
    expect(() =>
      assertAllowedPhotoUrl(
        "http://127.0.0.1:54321@evil.example/storage/v1/object/sign/meal-photos/x.jpg",
      ),
    ).toThrow(NutritionInputError);
  });

  it("rejects signed-path lookalikes that omit the required prefix boundary", () => {
    expect(() =>
      assertAllowedPhotoUrl(`${SUPABASE_URL}/storage/v1/object/sign`),
    ).toThrow(NutritionInputError);
    expect(() =>
      assertAllowedPhotoUrl(`${SUPABASE_URL}/storage/v1/object/signed/meal-photos/x.jpg`),
    ).toThrow(NutritionInputError);
  });
});

describe("fetchPhotoAsBase64 / fetchPhotoAsDataUrl", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("does not fetch when the URL is not allowlisted", async () => {
    await expect(fetchPhotoAsBase64("https://evil.example/x.png")).rejects.toBeInstanceOf(
      NutritionInputError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns base64 and a data URL for an allowlisted photo", async () => {
    const imageResponse = () =>
      new Response(Buffer.from("fake-image"), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    fetchMock.mockResolvedValueOnce(imageResponse()).mockResolvedValueOnce(imageResponse());

    const { base64, contentType } = await fetchPhotoAsBase64(SIGNED_PHOTO_URL);
    expect(contentType).toBe("image/png");
    expect(base64).toBe(Buffer.from("fake-image").toString("base64"));
    await expect(fetchPhotoAsDataUrl(SIGNED_PHOTO_URL)).resolves.toBe(
      `data:image/png;base64,${base64}`,
    );
  });

  it("rejects oversized bodies even without Content-Length", async () => {
    const big = new Uint8Array(MAX_ESTIMATE_PHOTO_BYTES + 1);
    fetchMock.mockResolvedValueOnce(
      new Response(big, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );

    await expect(fetchPhotoAsBase64(SIGNED_PHOTO_URL)).rejects.toBeInstanceOf(NutritionInputError);
  });

  it("rejects when Content-Length exceeds the cap before reading the body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(MAX_ESTIMATE_PHOTO_BYTES + 1),
        },
      }),
    );

    await expect(fetchPhotoAsBase64(SIGNED_PHOTO_URL)).rejects.toBeInstanceOf(NutritionInputError);
  });

  it("maps non-OK photo downloads to NutritionInputError", async () => {
    fetchMock.mockResolvedValueOnce(new Response("gone", { status: 403 }));
    await expect(fetchPhotoAsBase64(SIGNED_PHOTO_URL)).rejects.toBeInstanceOf(NutritionInputError);
  });

  it("defaults content-type to image/jpeg when the response omits it", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(Buffer.from("img"), {
        status: 200,
      }),
    );

    const { contentType, base64 } = await fetchPhotoAsBase64(SIGNED_PHOTO_URL);
    expect(contentType).toBe("image/jpeg");
    expect(base64).toBe(Buffer.from("img").toString("base64"));
  });
});
