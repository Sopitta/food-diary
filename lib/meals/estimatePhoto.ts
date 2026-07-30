/**
 * Resolve which photo path/URL to send to /api/estimate.
 *
 * After the first successful upload we cache both the storage path and the
 * signed URL. Re-estimate / retry must reuse that signed URL without uploading
 * again — otherwise photoUrl is omitted and photo-only retries fail (or
 * photo+description retries silently drop the image).
 */
export function resolveEstimatePhoto(input: {
  hasPhotoFile: boolean;
  uploadedPath: string | null;
  uploadedUrl: string | null;
}): {
  needsUpload: boolean;
  photoPath: string | null;
  photoUrl: string | undefined;
} {
  const needsUpload = input.hasPhotoFile && !input.uploadedPath;
  return {
    needsUpload,
    photoPath: input.uploadedPath,
    // Always prefer the cached signed URL on retry; a fresh upload overwrites
    // this after the /api/upload response lands.
    photoUrl: input.uploadedUrl ?? undefined,
  };
}
