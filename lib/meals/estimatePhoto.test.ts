import { describe, expect, it } from "vitest";
import { resolveEstimatePhoto } from "./estimatePhoto";

describe("resolveEstimatePhoto", () => {
  it("requires an upload on the first estimate when a photo file is present", () => {
    expect(
      resolveEstimatePhoto({
        hasPhotoFile: true,
        uploadedPath: null,
        uploadedUrl: null,
      }),
    ).toEqual({
      needsUpload: true,
      photoPath: null,
      photoUrl: undefined,
    });
  });

  it("reuses the cached signed URL on retry without re-uploading", () => {
    // Regression for the meal estimate retry bug: previously only the path was
    // cached, so the second /api/estimate call sent photoUrl: undefined.
    expect(
      resolveEstimatePhoto({
        hasPhotoFile: true,
        uploadedPath: "abc.jpg",
        uploadedUrl: "https://signed.example/abc.jpg",
      }),
    ).toEqual({
      needsUpload: false,
      photoPath: "abc.jpg",
      photoUrl: "https://signed.example/abc.jpg",
    });
  });

  it("skips upload when there is no local photo file", () => {
    expect(
      resolveEstimatePhoto({
        hasPhotoFile: false,
        uploadedPath: null,
        uploadedUrl: null,
      }),
    ).toEqual({
      needsUpload: false,
      photoPath: null,
      photoUrl: undefined,
    });
  });

  it("treats a null uploadedUrl as undefined so JSON omits an empty photo", () => {
    expect(
      resolveEstimatePhoto({
        hasPhotoFile: true,
        uploadedPath: "abc.jpg",
        uploadedUrl: null,
      }).photoUrl,
    ).toBeUndefined();
  });
});
