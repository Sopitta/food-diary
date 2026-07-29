import { describe, expect, it } from "vitest";
import {
  formatDateLabel,
  formatShortDate,
  formatTime,
  groupMealsByDay,
} from "./grouping";
import type { Meal } from "./types";

function meal(overrides: Partial<Meal> & Pick<Meal, "id" | "createdAt">): Meal {
  return {
    photoUrl: null,
    description: null,
    mealType: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    ...overrides,
  };
}

describe("groupMealsByDay", () => {
  it("groups meals by local calendar day and sums macros, treating nulls as zero", () => {
    const morning = new Date(2026, 6, 29, 8, 0).toISOString();
    const evening = new Date(2026, 6, 29, 19, 30).toISOString();
    const priorDay = new Date(2026, 6, 28, 12, 0).toISOString();

    const groups = groupMealsByDay([
      meal({
        id: "1",
        createdAt: evening,
        calories: 600,
        protein: 40,
        carbs: 50,
        fat: 20,
      }),
      meal({
        id: "2",
        createdAt: morning,
        calories: 300,
        protein: null,
        carbs: 30,
        fat: 10,
      }),
      meal({
        id: "3",
        createdAt: priorDay,
        calories: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      dateKey: "2026-07-29",
      totals: { calories: 900, protein: 40, carbs: 80, fat: 30 },
    });
    expect(groups[0].meals.map((m) => m.id)).toEqual(["1", "2"]);
    expect(groups[1]).toMatchObject({
      dateKey: "2026-07-28",
      totals: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
  });

  it("returns an empty list for no meals", () => {
    expect(groupMealsByDay([])).toEqual([]);
  });
});

describe("formatDateLabel", () => {
  it("labels today and yesterday specially", () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    expect(formatDateLabel(todayKey)).toBe("Today");
    expect(formatDateLabel(yesterdayKey)).toBe("Yesterday");
  });

  it("formats older dates without locale-dependent APIs", () => {
    // 2026-07-22 is a Wednesday
    expect(formatDateLabel("2026-07-22")).toBe("Wed, Jul 22");
    expect(formatShortDate("2026-07-22")).toBe("Wed, Jul 22");
  });
});

describe("formatTime", () => {
  it("formats 12-hour times with a stable AM/PM suffix", () => {
    expect(formatTime(new Date(2026, 6, 29, 0, 5).toISOString())).toBe("12:05 AM");
    expect(formatTime(new Date(2026, 6, 29, 12, 0).toISOString())).toBe("12:00 PM");
    expect(formatTime(new Date(2026, 6, 29, 15, 9).toISOString())).toBe("3:09 PM");
  });
});
