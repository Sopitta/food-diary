import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, MEAL_PHOTOS_BUCKET } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = file.type.split("/").pop();
  return fromType || "jpg";
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo file provided under the 'photo' field." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded photo is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Photo is too large (max 10MB)." }, { status: 413 });
  }

  const path = `${randomUUID()}.${extensionFor(file)}`;

  try {
    const supabase = getSupabaseServerClient();
    const { error: uploadError } = await supabase.storage
      .from(MEAL_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(MEAL_PHOTOS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      throw signError;
    }

    return NextResponse.json({ path, url: signedData.signedUrl }, { status: 200 });
  } catch (err) {
    console.error("Photo upload failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to upload photo: ${message}` }, { status: 502 });
  }
}
