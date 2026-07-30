import Link from "next/link";
import { listMeals } from "@/lib/meals/repository";
import type { Meal } from "@/lib/meals/types";
import MealLog from "@/components/MealLog";
import { PlusIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  let meals: Meal[] = [];
  let loadError: string | null = null;

  try {
    meals = await listMeals();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load meals.";
  }

  return (
    <>
      <header className="border-b-2 border-dashed border-ink px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight">Food Diary</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink/60">Log</span>
            <Link
              href="/add"
              className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper transition-opacity hover:opacity-85"
            >
              <PlusIcon width={14} height={14} /> Add Meal
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 py-6">
        {loadError && (
          <div className="rounded-2xl border-2 border-ink bg-paper-soft p-4 text-sm">
            <p className="font-bold">Couldn&apos;t load your log.</p>
            <p className="mt-1 text-ink/70">{loadError}</p>
            <p className="mt-2 text-xs text-ink/60">
              Make sure the local Supabase stack is running (<code>npx supabase start</code>) and
              your <code>.env.local</code> is set up.
            </p>
          </div>
        )}

        {!loadError && <MealLog meals={meals} />}
      </main>
    </>
  );
}
