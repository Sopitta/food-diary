import { NutritionInputError } from "./errors";

/** Match the upload route's 10MB cap so estimate can't be used to pull larger blobs. */
export const MAX_ESTIMATE_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * photoUrl is client-supplied (via POST /api/estimate). Providers must only fetch
 * signed URLs from this app's Supabase Storage - otherwise the server is an SSRF
 * proxy (internal hosts, cloud metadata) and can OOM on unbounded responses.
 */
export function assertAllowedPhotoUrl(photoUrl: string): URL {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new NutritionInputError(
      "Missing NEXT_PUBLIC_SUPABASE_URL; cannot verify photo URL.",
    );
  }

  let target: URL;
  let allowed: URL;
  try {
    target = new URL(photoUrl);
    allowed = new URL(base);
  } catch {
    throw new NutritionInputError("Invalid photo URL.");
  }

  if (target.origin !== allowed.origin) {
    throw new NutritionInputError(
      "Photo URL must be a signed URL from this app's storage.",
    );
  }

  if (!target.pathname.startsWith("/storage/v1/object/sign/")) {
    throw new NutritionInputError(
      "Photo URL must be a signed URL from this app's storage.",
    );
  }

  return target;
}

async function readBodyWithLimit(res: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(res.headers.get("content-length") ?? NaN);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new NutritionInputError("Photo is too large to estimate (max 10MB).");
  }

  if (!res.body) {
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new NutritionInputError("Photo is too large to estimate (max 10MB).");
    }
    return new Uint8Array(buffer);
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new NutritionInputError("Photo is too large to estimate (max 10MB).");
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Downloads an allowlisted meal photo for estimation (base64 payload, no data-URL prefix). */
export async function fetchPhotoAsBase64(photoUrl: string): Promise<{
  base64: string;
  contentType: string;
}> {
  assertAllowedPhotoUrl(photoUrl);

  const res = await fetch(photoUrl);
  if (!res.ok) {
    throw new NutritionInputError(`Could not load the photo for estimation (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = await readBodyWithLimit(res, MAX_ESTIMATE_PHOTO_BYTES);
  return {
    base64: Buffer.from(bytes).toString("base64"),
    contentType,
  };
}

/** Same as fetchPhotoAsBase64, inlined as a data URL for OpenAI-compatible vision APIs. */
export async function fetchPhotoAsDataUrl(photoUrl: string): Promise<string> {
  const { base64, contentType } = await fetchPhotoAsBase64(photoUrl);
  return `data:${contentType};base64,${base64}`;
}
