"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Meal } from "@/lib/meals/types";
import { CameraIcon, MEAL_TYPE_META, PencilIcon, TrashIcon } from "./icons";

type Mode = "idle" | "editing" | "confirmingDelete";

export default function MealCard({ meal }: { meal: Meal }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState(meal.description ?? "");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeMeta = meal.mealType ? MEAL_TYPE_META[meal.mealType] : null;

  function startEditing() {
    setName(meal.description ?? "");
    setError(null);
    setMode("editing");
  }

  function cancelEditing() {
    setMode("idle");
    setError(null);
    setName(meal.description ?? "");
  }

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    if (trimmed === meal.description) {
      setMode("idle");
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meals/${meal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update meal.");
      }
      setMode("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update meal.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meals/${meal.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete meal.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete meal.");
      setIsBusy(false);
      setMode("idle");
    }
  }

  return (
    <div className="relative rounded-2xl border-2 border-ink bg-paper p-3">
      <div className="flex gap-3">
        {meal.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meal.photoUrl}
            alt={meal.description ?? "Meal photo"}
            className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-paper-dark text-ink/50">
            <CameraIcon width={20} height={20} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
          {mode === "editing" ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") cancelEditing();
              }}
              autoFocus
              disabled={isBusy}
              placeholder="Meal name"
              className="w-full rounded-md border-2 border-ink bg-paper-soft px-2 py-1 text-sm font-bold outline-none disabled:opacity-50"
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="truncate text-left text-sm font-bold"
            >
              {meal.description || "Untitled meal"}
            </button>
          )}
          <p className="text-xs text-ink/60">
            {meal.calories ?? 0} kcal · P {meal.protein ?? 0}g · C {meal.carbs ?? 0}g · F {meal.fat ?? 0}g
          </p>
          {typeMeta && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-paper">
              <typeMeta.Icon width={10} height={10} /> {typeMeta.label}
            </span>
          )}
        </div>
      </div>

      {mode === "idle" && (
        <>
          <button
            type="button"
            onClick={startEditing}
            aria-label="Edit meal name"
            className="absolute right-3 top-3 rounded-full p-1 text-ink/50 transition-colors hover:bg-paper-dark hover:text-ink"
          >
            <PencilIcon width={16} height={16} />
          </button>
          <button
            type="button"
            onClick={() => setMode("confirmingDelete")}
            aria-label="Delete meal"
            className="absolute right-3 bottom-3 rounded-full p-1 text-ink/50 transition-colors hover:bg-paper-dark hover:text-ink"
          >
            <TrashIcon width={16} height={16} />
          </button>
        </>
      )}

      {mode === "editing" && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t-2 border-dashed border-ink/30 pt-3">
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isBusy}
            className="rounded-full px-3 py-1 text-xs font-semibold text-ink/60 hover:bg-paper-dark disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveName}
            disabled={isBusy}
            className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper disabled:opacity-50"
          >
            {isBusy ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {mode === "confirmingDelete" && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t-2 border-dashed border-ink/30 pt-3">
          <span className="mr-auto text-xs text-ink/60">Delete this entry?</span>
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={isBusy}
            className="rounded-full px-3 py-1 text-xs font-semibold text-ink/60 hover:bg-paper-dark disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isBusy}
            className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper disabled:opacity-50"
          >
            {isBusy ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-ink/70">{error}</p>}
    </div>
  );
}
