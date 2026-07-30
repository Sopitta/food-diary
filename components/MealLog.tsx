"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { formatDateLabel, formatShortDate, groupMealsByDay } from "@/lib/meals/grouping";
import type { Meal } from "@/lib/meals/types";
import DayOverviewCard from "./DayOverviewCard";
import MealCard from "./MealCard";
import { PlusIcon } from "./icons";

/**
 * groupMealsByDay / formatDateLabel use the runtime's local calendar day.
 * The log page used to group on the server, which on Vercel is UTC — so a
 * dinner logged at 8pm in US timezones landed on the next UTC day and split
 * that day's calorie totals. Group (and label "Today") only after hydration
 * so the browser timezone is used; useSyncExternalStore keeps SSR and the
 * hydration pass identical (both show the loading placeholder).
 */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function MealLog({ meals }: { meals: Meal[] }) {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-ink/60">Loading your log…</p>
      </div>
    );
  }

  // Explicit browser zone so day buckets match the user even if this code
  // ever runs under a non-local default (and so tests can pin IANA zones).
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dayGroups = groupMealsByDay(meals, timeZone);

  if (dayGroups.length === 0) {
    return (
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
    );
  }

  return (
    <>
      {dayGroups.map((group) => (
        <section key={group.dateKey} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {formatDateLabel(group.dateKey, timeZone)}
            </h1>
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
    </>
  );
}
