import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const upload = vi.fn();
const createSignedUrl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  MEAL_PHOTOS_BUCKET: "meal-photos",
  getSupabaseServerClient: () => ({
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => upload(...args),
        createSignedUrl: (...args: unknown[]) => createSignedUrl(...args),
      }),
    },
  }),
}));

import { POST } from "./route";

function postPhoto(file: File | null): NextRequest {
  const formData = new FormData();
  if (file) formData.append("photo", file);
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    upload.mockReset();
    createSignedUrl.mockReset();
  });

  it("requires a photo file field", async () => {
    const response = await POST(postPhoto(null));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No photo file provided under the 'photo' field.",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects empty files", async () => {
    const response = await POST(postPhoto(new File([], "empty.jpg", { type: "image/jpeg" })));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "The uploaded photo is empty." });
  });

  it("rejects files larger than 10MB", async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    const response = await POST(postPhoto(big));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Photo is too large (max 10MB)." });
  });

  it("uploads and returns a signed URL on success", async () => {
    upload.mockResolvedValueOnce({ error: null });
    createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://signed.example/photo.jpg" },
      error: null,
    });

    const file = new File([new Uint8Array([1, 2, 3])], "lunch.JPEG", { type: "image/jpeg" });
    const response = await POST(postPhoto(file));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { path: string; url: string };
    expect(body.url).toBe("https://signed.example/photo.jpg");
    expect(body.path).toMatch(/\.jpeg$/);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledWith(body.path, 60 * 60);
  });

  it("returns 502 when storage upload fails", async () => {
    upload.mockResolvedValueOnce({ error: new Error("bucket missing") });
    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });
    const response = await POST(postPhoto(file));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Failed to upload photo");
  });

  it("returns 502 when signing the uploaded object fails", async () => {
    upload.mockResolvedValueOnce({ error: null });
    createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: new Error("sign failed"),
    });

    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });
    const response = await POST(postPhoto(file));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Failed to upload photo");
  });
});
