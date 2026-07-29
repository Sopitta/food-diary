import { NextRequest, NextResponse } from "next/server";
import { deleteMeal, updateMealDescription } from "@/lib/meals/repository";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing meal id." }, { status: 400 });
  }

  try {
    await deleteMeal(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Failed to delete meal:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Meal not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing meal id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawDescription = (body as { description?: unknown } | null)?.description;
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (!description) {
    return NextResponse.json({ error: "Meal name can't be empty." }, { status: 400 });
  }

  try {
    const meal = await updateMealDescription(id, description);
    return NextResponse.json({ meal }, { status: 200 });
  } catch (err) {
    console.error("Failed to update meal:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Meal not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
