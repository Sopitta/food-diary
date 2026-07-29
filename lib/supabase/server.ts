import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

export const MEAL_PHOTOS_BUCKET = "meal-photos";

let client: SupabaseClient | undefined;

/**
 * Server-only Supabase client authenticated with the secret key (the
 * successor to the legacy service_role JWT, which Supabase is sunsetting),
 * which bypasses RLS. The `meals` table and `meal-photos` bucket have RLS
 * enabled with no policies, so this client (never imported into client
 * components) is the only way in or out of the database and storage.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (client) return client;

  if (!SUPABASE_URL || !SECRET_KEY) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local " +
        "(see .env.local.example, values come from `npx supabase status` after `npx supabase start`).",
    );
  }

  client = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false },
  });
  return client;
}
