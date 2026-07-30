"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resolveEstimatePhoto } from "@/lib/meals/estimatePhoto";
import { MEAL_TYPES, type MealType } from "@/lib/meals/types";
import { ArrowLeftIcon, CameraIcon, ImageIcon, MEAL_TYPE_META, SparklesIcon } from "./icons";

interface Estimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type Stage = "input" | "estimating" | "review" | "saving";

function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export default function MealForm() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  // Fixed initial value so server- and client-rendered markup match; the
  // time-of-day default is applied right after mount (client-only), since
  // "the current hour" would otherwise differ between the SSR pass and
  // hydration and trigger a hydration mismatch.
  const [mealType, setMealType] = useState<MealType>("breakfast");
  useEffect(() => {
    // Intentional: this is the standard fix for a value that must be
    // identical between the SSR pass and hydration (the current hour), not
    // state synced with an external system - so it's fine to set it here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMealType(defaultMealType());
  }, []);

  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  // Keep the signed URL from upload so a retry / re-estimate can still send the
  // photo to /api/estimate without re-uploading. Previously only the path was
  // cached, so the second estimate call omitted photoUrl entirely.
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("input");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasContent = Boolean(photoFile) || description.trim().length > 0;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setUploadedPath(null);
    setUploadedUrl(null);
    setEstimate(null);
    setStage("input");
    setError(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploadedPath(null);
    setUploadedUrl(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (libraryInputRef.current) libraryInputRef.current.value = "";
  }

  async function handleEstimate() {
    setError(null);
    if (!hasContent) {
      setError("Add a photo, a description, or both.");
      return;
    }

    setStage("estimating");
    try {
      const resolved = resolveEstimatePhoto({
        hasPhotoFile: Boolean(photoFile),
        uploadedPath,
        uploadedUrl,
      });
      let photoPath = resolved.photoPath;
      let photoUrl = resolved.photoUrl;

      if (resolved.needsUpload && photoFile) {
        const formData = new FormData();
        formData.append("photo", photoFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          throw new Error(await parseErrorMessage(uploadRes, "Failed to upload photo."));
        }
        const uploadData = (await uploadRes.json()) as { path: string; url: string };
        photoPath = uploadData.path;
        photoUrl = uploadData.url;
        setUploadedPath(uploadData.path);
        setUploadedUrl(uploadData.url);
      }

      const estimateRes = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl, description: description.trim() || undefined }),
      });

      if (!estimateRes.ok) {
        throw new Error(await parseErrorMessage(estimateRes, "Estimation failed."));
      }

      const result = (await estimateRes.json()) as Estimate;
      setEstimate(result);
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("input");
    }
  }

  async function handleSave() {
    if (!estimate) return;
    setError(null);
    setStage("saving");
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoPath: uploadedPath,
          description: description.trim() || undefined,
          mealType,
          ...estimate,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to save meal."));
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save meal.");
      setStage("review");
    }
  }

  function updateEstimateField(field: keyof Estimate, value: string) {
    if (!estimate) return;
    const num = value === "" ? 0 : Number(value);
    setEstimate({ ...estimate, [field]: Number.isFinite(num) ? num : 0 });
  }

  function skipToManualEntry() {
    setEstimate({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    setStage("review");
    setError(null);
  }

  const isBusy = stage === "estimating" || stage === "saving";

  return (
    <>
      <header className="border-b-2 border-dashed border-ink px-4 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-ink/70">
            <ArrowLeftIcon width={16} height={16} /> Back
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight">Add a meal</h1>
          <span />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <p className="text-sm text-ink/60">
          Add a photo and/or description to get an instant nutrition estimate.
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Meal type</span>
          <div className="grid grid-cols-5 gap-2">
            {MEAL_TYPES.map((type) => {
              const meta = MEAL_TYPE_META[type];
              const selected = mealType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  disabled={isBusy}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 border-ink py-2.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    selected ? "bg-ink text-paper" : "bg-paper text-ink"
                  }`}
                >
                  <meta.Icon width={18} height={18} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Photo</span>
          {photoPreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Selected meal"
                className="h-56 w-full rounded-2xl border-2 border-ink object-cover"
              />
              <button
                type="button"
                onClick={clearPhoto}
                disabled={isBusy}
                className="absolute right-2 top-2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink px-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-paper-dark text-ink">
                <CameraIcon width={22} height={22} />
              </div>
              <div>
                <p className="text-sm font-bold">Tap to add a photo</p>
                <p className="mt-0.5 text-xs text-ink/50">Take a photo or choose from library</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper-dark px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                >
                  <CameraIcon width={14} height={14} /> Camera
                </button>
                <button
                  type="button"
                  onClick={() => libraryInputRef.current?.click()}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper-dark px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                >
                  <ImageIcon width={14} height={14} /> Library
                </button>
              </div>
            </div>
          )}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            disabled={isBusy}
            className="hidden"
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            disabled={isBusy}
            className="hidden"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="text-sm font-bold">
            Description {photoFile ? <span className="font-normal text-ink/50">(optional)</span> : null}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setStage("input");
              setEstimate(null);
            }}
            disabled={isBusy}
            rows={3}
            placeholder="e.g. Grilled chicken breast with rice and broccoli"
            className="w-full resize-none rounded-2xl border-2 border-ink bg-paper px-3 py-2.5 text-sm outline-none placeholder:text-ink/40 disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="rounded-2xl border-2 border-ink bg-paper-soft px-3 py-2 text-sm">{error}</div>
        )}

        {stage !== "review" && stage !== "saving" && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleEstimate}
              disabled={isBusy || !hasContent}
              className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-4 text-base font-bold text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {stage === "estimating" ? (
                <>
                  <Spinner /> Estimating...
                </>
              ) : (
                <>
                  <SparklesIcon width={18} height={18} /> Estimate nutrition
                </>
              )}
            </button>
            {stage === "estimating" && (
              <p className="text-center text-xs text-ink/50">
                Running the local model - this can take up to 30 seconds.
              </p>
            )}
            {error && (
              <button
                type="button"
                onClick={skipToManualEntry}
                className="text-center text-xs font-semibold text-ink/60 underline underline-offset-2"
              >
                Skip estimation and enter macros manually
              </button>
            )}
          </div>
        )}

        {(stage === "review" || stage === "saving") && estimate && (
          <div className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-paper-soft p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Estimated nutrition</h2>
              <button
                type="button"
                onClick={() => {
                  setStage("input");
                  setEstimate(null);
                }}
                disabled={stage === "saving"}
                className="text-xs font-semibold text-ink/60 underline underline-offset-2 disabled:opacity-50"
              >
                Re-estimate
              </button>
            </div>
            <p className="text-xs text-ink/60">
              Double-check these against what you actually ate - edit any field before saving.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MacroField
                label="Calories"
                value={estimate.calories}
                onChange={(v) => updateEstimateField("calories", v)}
                disabled={stage === "saving"}
              />
              <MacroField
                label="Protein (g)"
                value={estimate.protein}
                onChange={(v) => updateEstimateField("protein", v)}
                disabled={stage === "saving"}
              />
              <MacroField
                label="Carbs (g)"
                value={estimate.carbs}
                onChange={(v) => updateEstimateField("carbs", v)}
                disabled={stage === "saving"}
              />
              <MacroField
                label="Fat (g)"
                value={estimate.fat}
                onChange={(v) => updateEstimateField("fat", v)}
                disabled={stage === "saving"}
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={stage === "saving"}
              className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-4 text-base font-bold text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stage === "saving" ? (
                <>
                  <Spinner /> Saving...
                </>
              ) : (
                "Save meal"
              )}
            </button>
          </div>
        )}
      </main>
    </>
  );
}

function MacroField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-ink/70">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-lg border-2 border-ink bg-paper px-2 py-1.5 text-sm font-semibold text-ink outline-none disabled:opacity-50"
      />
    </label>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
