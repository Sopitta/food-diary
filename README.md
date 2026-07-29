# Food Diary

A local-first food diary. Log a meal by photo and/or short description and get an instant
calorie/protein/carb/fat estimate from a local vision-language model, running via [Ollama](https://ollama.com/).

No auth, single user, local-first: the goal of this pass is to get everything working on your
machine before pushing to GitHub or deploying to Vercel.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend/storage:** Supabase (Postgres + Storage), run locally via the Supabase CLI + Docker
- **Nutrition estimation:** a local Ollama vision-language model by default, called through a
  single `estimateNutrition()` seam (see [lib/nutrition](lib/nutrition)) so it can be swapped for
  a hosted inference API - a Hugging Face provider is already included - with no other code
  changes. Ollama can't run inside a Vercel deployment (no persistent server, multi-GB model
  weights), so switch to `NUTRITION_PROVIDER=huggingface` before deploying.

## Prerequisites

- [Node.js](https://nodejs.org/) 18.18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local Supabase stack)
- [Ollama](https://ollama.com/download) with at least one vision-capable model pulled, e.g.:

  ```bash
  ollama pull gemma3:4b
  # or: ollama pull llava
  ```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local Supabase stack (Postgres + Storage), which also applies the migrations in
   [supabase/migrations](supabase/migrations) (creates the `meals` table and the private
   `meal-photos` Storage bucket):

   ```bash
   npx supabase start
   ```

   This prints an `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY`. You can also get these anytime via
   `npx supabase status`.

3. Copy the example env file and fill in your local Supabase URL/keys and Ollama model:

   ```bash
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` -> the `API_URL` from step 2 (typically `http://127.0.0.1:54321`)
   - `SUPABASE_SECRET_KEY` -> the `SECRET_KEY` from step 2 (`sb_secret_...`, server-only, never
     exposed to the browser - this is the new key that replaces the legacy `service_role` JWT,
     which Supabase is sunsetting)
   - `OLLAMA_MODEL` -> whichever vision-capable model you've pulled (check with `ollama list`)

4. Make sure Ollama is running (`ollama serve`, or just have the desktop app open) and start the
   dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000). Use "Add Meal" to log something, then
   check the Log view for the entry and the day's running totals.

## Switching nutrition providers (e.g. for deployment)

Ollama needs a persistent local process and multi-GB model weights, so it can't run inside a
serverless deployment like Vercel. For local development, keep `NUTRITION_PROVIDER=ollama`. Before
deploying (or any time you want a hosted model instead), switch to Hugging Face:

1. Create a fine-grained token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   with "Make calls to Inference Providers" permission (this API has a free tier).
2. Set in your env (`.env.local` locally, or your deployment's environment variables):
   ```bash
   NUTRITION_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=hf_...
   HUGGINGFACE_MODEL=Qwen/Qwen2.5-VL-3B-Instruct   # optional, this is the default
   ```

No other code changes are needed - `lib/nutrition/estimateNutrition.ts` picks the provider based
on `NUTRITION_PROVIDER` alone. See `lib/nutrition/providers/huggingfaceProvider.ts` to add other
providers (OpenAI, Anthropic, etc.) the same way.

## Project structure

- `app/` - routes: `/` (Log view), `/add` (meal entry form), `/api/estimate`, `/api/upload`,
  `/api/meals`
- `lib/nutrition/` - the `estimateNutrition()` seam and its providers (Ollama, Hugging Face) -
  swap between them via the `NUTRITION_PROVIDER` env var
- `lib/meals/` - Supabase data access (repository) and day-grouping/formatting helpers
- `lib/supabase/server.ts` - server-only Supabase client (secret key)
- `supabase/migrations/` - the `meals` table and `meal-photos` Storage bucket, both with RLS
  enabled and no anon/authenticated policies (access only via the secret key, server-side)

## Notes on data access

The `meals` table and `meal-photos` bucket have row-level security enabled with no policies for
`anon`/`authenticated`, so the browser never talks to Supabase directly - every read/write goes
through a Next.js API route using the secret key. When multi-user auth is added later, this
table can grow user-scoped RLS policies without changing today's server-side access pattern.

## Useful commands

```bash
npx supabase status   # print local API URL / keys again
npx supabase stop     # stop the local stack
npx supabase db reset # recreate the local DB and reapply migrations
ollama list            # see which local models are available
```
