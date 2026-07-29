import { NextRequest, NextResponse } from "next/server";
import { insertMeal, listMeals } from "@/lib/meals/repository";
import { isMealType, type MealType } from "@/lib/meals/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const meals = await listMeals();
    return NextResponse.json({ meals }, { status: 200 });
  } catch (err) {
    console.error("Failed to list meals:", err);
    return NextResponse.json({ error: "Failed to load meals." }, { status: 500 });
  }
}

interface CreateMealBody {
  photoPath?: string | null;
  description?: string | null;
  mealType?: MealType | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: NextRequest) {
  let body: CreateMealBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.photoPath && !body.description?.trim()) {
    return NextResponse.json({ error: "Provide a photo, a description, or both." }, { status: 422 });
  }

  if (body.mealType != null && !isMealType(body.mealType)) {
    return NextResponse.json({ error: "Invalid mealType." }, { status: 422 });
  }

  if (
    !isFiniteNumber(body.calories) ||
    !isFiniteNumber(body.protein) ||
    !isFiniteNumber(body.carbs) ||
    !isFiniteNumber(body.fat)
  ) {
    return NextResponse.json(
      { error: "calories, protein, carbs, and fat must all be numbers." },
      { status: 422 },
    );
  }

  try {
    const meal = await insertMeal({
      photoPath: body.photoPath,
      description: body.description,
      mealType: body.mealType,
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
    });
    return NextResponse.json({ meal }, { status: 201 });
  } catch (err) {
    console.error("Failed to save meal:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
