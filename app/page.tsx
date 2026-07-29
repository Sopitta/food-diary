import Link from "next/link";
import { listMeals } from "@/lib/meals/repository";
import { formatDateLabel, formatShortDate, groupMealsByDay } from "@/lib/meals/grouping";
import DayOverviewCard from "@/components/DayOverviewCard";
import MealCard from "@/components/MealCard";
import { PlusIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  let dayGroups: ReturnType<typeof groupMealsByDay> = [];
  let loadError: string | null = null;

  try {
    const meals = await listMeals();
    dayGroups = groupMealsByDay(meals);
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

        {!loadError && dayGroups.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-4xl">🥗</p>
            <p className="text-sm text-ink/60">No meals logged yet. Add your first meal to see it here.</p>
            <Link
              href="/add"
              className="mt-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper"
            >
              Add Meal
            </Link>
          </div>
        )}

        {!loadError &&
          dayGroups.map((group) => (
            <section key={group.dateKey} className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h1 className="text-3xl font-extrabold tracking-tight">{formatDateLabel(group.dateKey)}</h1>
                <span className="text-sm font-medium text-ink/50">{formatShortDate(group.dateKey)}</span>
              </div>
              <DayOverviewCard totals={group.totals} />
              <div className="flex flex-col gap-3">
                {group.meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
              </div>
            </section>
          ))}

        {!loadError && dayGroups.length > 0 && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/30" />
            <Link
              href="/add"
              className="flex items-center gap-1.5 rounded-full border-2 border-ink px-5 py-2.5 text-sm font-bold"
            >
              <PlusIcon width={14} height={14} /> Log another meal
            </Link>
            <div className="h-px flex-1 bg-ink/30" />
          </div>
        )}
      </main>
    </>
  );
}
