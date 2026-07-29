import { NextRequest, NextResponse } from "next/server";
import {
  estimateNutrition,
  NutritionInputError,
  NutritionParseError,
  NutritionTimeoutError,
  NutritionUnavailableError,
} from "@/lib/nutrition/estimateNutrition";

export async function POST(request: NextRequest) {
  let body: { photoUrl?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const estimate = await estimateNutrition({
      photoUrl: body.photoUrl,
      description: body.description,
    });
    return NextResponse.json(estimate, { status: 200 });
  } catch (err) {
    if (err instanceof NutritionInputError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof NutritionTimeoutError) {
      return NextResponse.json({ error: err.message }, { status: 504 });
    }
    if (err instanceof NutritionUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof NutritionParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }

    console.error("Unexpected error in /api/estimate:", err);
    return NextResponse.json(
      { error: "Something went wrong while estimating nutrition." },
      { status: 500 },
    );
  }
}
