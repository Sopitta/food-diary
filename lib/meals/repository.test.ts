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

import { deleteMeal, updateMealDescription } from "./repository";

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
