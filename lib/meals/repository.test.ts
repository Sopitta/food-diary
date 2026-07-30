import { beforeEach, describe, expect, it, vi } from "vitest";

const remove = vi.fn();
const createSignedUrl = vi.fn();

type QueryResult = { data: unknown; error: { message: string } | null };

function createQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  // listMeals awaits the builder after .order(); Supabase builders are thenable.
  builder.then = (
    onfulfilled?: ((value: QueryResult) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(result).then(onfulfilled ?? undefined, onrejected ?? undefined);
  return builder;
}

const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  MEAL_PHOTOS_BUCKET: "meal-photos",
  getSupabaseServerClient: () => ({
    from: (...args: unknown[]) => from(...args),
    storage: {
      from: () => ({
        remove: (...args: unknown[]) => remove(...args),
        createSignedUrl: (...args: unknown[]) => createSignedUrl(...args),
      }),
    },
  }),
}));

import { deleteMeal, insertMeal, listMeals, updateMealDescription } from "./repository";

const mealRow = {
  id: "meal-1",
  photo_url: "photos/a.jpg",
  description: "Salad",
  meal_type: "lunch",
  calories: 400,
  protein: 20,
  carbs: 40,
  fat: 15,
  created_at: "2026-07-29T12:00:00.000Z",
};

describe("listMeals", () => {
  beforeEach(() => {
    from.mockReset();
    createSignedUrl.mockReset();
  });

  it("maps rows to meals and signs photo paths", async () => {
    from.mockReturnValueOnce(createQueryBuilder({ data: [mealRow], error: null }));
    createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://signed.example/a.jpg" },
      error: null,
    });

    await expect(listMeals()).resolves.toEqual([
      {
        id: "meal-1",
        photoUrl: "https://signed.example/a.jpg",
        description: "Salad",
        mealType: "lunch",
        calories: 400,
        protein: 20,
        carbs: 40,
        fat: 15,
        createdAt: "2026-07-29T12:00:00.000Z",
      },
    ]);
    expect(createSignedUrl).toHaveBeenCalledWith("photos/a.jpg", 60 * 60);
  });

  it("returns null photoUrl when signing fails instead of failing the list", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({
        data: [{ ...mealRow, photo_url: "photos/missing.jpg" }],
        error: null,
      }),
    );
    createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "Object not found" },
    });

    const meals = await listMeals();
    expect(meals[0]?.photoUrl).toBeNull();
  });

  it("maps supabase errors", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({ data: null, error: { message: "connection reset" } }),
    );
    await expect(listMeals()).rejects.toThrow("Failed to load meals: connection reset");
  });
});

describe("insertMeal", () => {
  beforeEach(() => {
    from.mockReset();
    createSignedUrl.mockReset();
  });

  it("inserts macros and returns the mapped meal", async () => {
    const builder = createQueryBuilder({ data: mealRow, error: null });
    from.mockReturnValueOnce(builder);
    createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://signed.example/a.jpg" },
      error: null,
    });

    await expect(
      insertMeal({
        photoPath: "photos/a.jpg",
        description: "Salad",
        mealType: "lunch",
        calories: 400,
        protein: 20,
        carbs: 40,
        fat: 15,
      }),
    ).resolves.toMatchObject({
      id: "meal-1",
      photoUrl: "https://signed.example/a.jpg",
      mealType: "lunch",
    });

    expect(builder.insert).toHaveBeenCalledWith({
      photo_url: "photos/a.jpg",
      description: "Salad",
      meal_type: "lunch",
      calories: 400,
      protein: 20,
      carbs: 40,
      fat: 15,
    });
  });

  it("maps supabase insert errors", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({ data: null, error: { message: "duplicate key" } }),
    );
    await expect(
      insertMeal({
        description: "Salad",
        calories: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
      }),
    ).rejects.toThrow("Failed to save meal: duplicate key");
  });
});

describe("updateMealDescription", () => {
  beforeEach(() => {
    from.mockReset();
    createSignedUrl.mockReset();
  });

  it("throws Meal not found when no row matches", async () => {
    from.mockReturnValueOnce(createQueryBuilder({ data: null, error: null }));
    await expect(updateMealDescription("missing", "Soup")).rejects.toThrow("Meal not found.");
  });

  it("maps supabase errors", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({ data: null, error: { message: "permission denied" } }),
    );
    await expect(updateMealDescription("m1", "Soup")).rejects.toThrow(
      "Failed to update meal: permission denied",
    );
  });

  it("returns the updated meal with a signed photo URL", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({
        data: { ...mealRow, description: "Soup" },
        error: null,
      }),
    );
    createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://signed.example/a.jpg" },
      error: null,
    });

    await expect(updateMealDescription("meal-1", "Soup")).resolves.toMatchObject({
      id: "meal-1",
      description: "Soup",
      photoUrl: "https://signed.example/a.jpg",
    });
  });
});

describe("deleteMeal", () => {
  beforeEach(() => {
    from.mockReset();
    remove.mockReset();
  });

  it("throws Meal not found when no row matches", async () => {
    from.mockReturnValueOnce(createQueryBuilder({ data: null, error: null }));
    await expect(deleteMeal("missing")).rejects.toThrow("Meal not found.");
    expect(remove).not.toHaveBeenCalled();
  });

  it("maps supabase delete errors", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({ data: null, error: { message: "row locked" } }),
    );
    await expect(deleteMeal("meal-1")).rejects.toThrow("Failed to delete meal: row locked");
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes the linked photo from storage after removing the row", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({ data: { photo_url: "photos/a.jpg" }, error: null }),
    );
    remove.mockResolvedValueOnce({ error: null });

    await deleteMeal("meal-1");

    expect(remove).toHaveBeenCalledWith(["photos/a.jpg"]);
  });

  it("still succeeds when storage cleanup fails after the row is gone", async () => {
    from.mockReturnValueOnce(
      createQueryBuilder({ data: { photo_url: "photos/a.jpg" }, error: null }),
    );
    remove.mockResolvedValueOnce({ error: { message: "not found in bucket" } });

    await expect(deleteMeal("meal-1")).resolves.toBeUndefined();
  });

  it("skips storage cleanup when the meal had no photo", async () => {
    from.mockReturnValueOnce(createQueryBuilder({ data: { photo_url: null }, error: null }));
    await deleteMeal("meal-1");
    expect(remove).not.toHaveBeenCalled();
  });
});
