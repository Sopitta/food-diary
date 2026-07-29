import { getSupabaseServerClient, MEAL_PHOTOS_BUCKET } from "@/lib/supabase/server";
import type { Meal, MealType } from "./types";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, plenty for a single page view
const MEAL_COLUMNS = "id, photo_url, description, meal_type, calories, protein, carbs, fat, created_at";

interface MealRow {
  id: string;
  photo_url: string | null;
  description: string | null;
  meal_type: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  created_at: string;
}

async function resolvePhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(MEAL_PHOTOS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("Failed to sign photo URL:", error.message);
    return null;
  }
  return data.signedUrl;
}

async function rowToMeal(row: MealRow): Promise<Meal> {
  return {
    id: row.id,
    photoUrl: await resolvePhotoUrl(row.photo_url),
    description: row.description,
    mealType: (row.meal_type as MealType | null) ?? null,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    createdAt: row.created_at,
  };
}

export async function listMeals(): Promise<Meal[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("meals")
    .select(MEAL_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load meals: ${error.message}`);
  }

  return Promise.all((data as MealRow[]).map(rowToMeal));
}

export interface InsertMealInput {
  photoPath?: string | null;
  description?: string | null;
  mealType?: MealType | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function insertMeal(input: InsertMealInput): Promise<Meal> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("meals")
    .insert({
      photo_url: input.photoPath ?? null,
      description: input.description ?? null,
      meal_type: input.mealType ?? null,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fat: input.fat,
    })
    .select(MEAL_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to save meal: ${error.message}`);
  }

  return rowToMeal(data as MealRow);
}

/** Updates a meal's name/description. */
export async function updateMealDescription(id: string, description: string): Promise<Meal> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("meals")
    .update({ description })
    .eq("id", id)
    .select(MEAL_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update meal: ${error.message}`);
  }
  if (!data) {
    throw new Error("Meal not found.");
  }

  return rowToMeal(data as MealRow);
}

/** Deletes a meal row and, if it had a photo, removes it from Storage too. */
export async function deleteMeal(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("meals")
    .delete()
    .eq("id", id)
    .select("photo_url")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete meal: ${error.message}`);
  }
  if (!data) {
    throw new Error("Meal not found.");
  }

  const photoPath = (data as { photo_url: string | null }).photo_url;
  if (photoPath) {
    const { error: storageError } = await supabase.storage.from(MEAL_PHOTOS_BUCKET).remove([photoPath]);
    if (storageError) {
      // The row is already gone; log but don't fail the request over an orphaned file.
      console.error("Failed to delete meal photo from storage:", storageError.message);
    }
  }
}
