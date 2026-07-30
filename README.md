# Food Diary

A local-first food diary. Log a meal by photo and/or short description and get an instant
calorie/protein/carb/fat estimate from a vision-language model.

No auth, single user: this is a personal project, not a multi-tenant product. Develop against a
local Ollama model, then switch to Hugging Face Inference Providers for deployment (see
[Switching nutrition providers](#switching-nutrition-providers-eg-for-deployment) below).

## Screenshots

| Log | Add a meal |
| --- | --- |
| ![Log view showing today's calorie ring, macro totals, and logged meals](docs/screenshots/log-view.png) | ![Add a meal form with meal type, photo, and estimated nutrition](docs/screenshots/add-meal.png) |

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
   # Optional. Default is Qwen/Qwen2.5-VL-72B-Instruct — a checkpoint that is
   # actually routable via Inference Providers on a typical HF account.
   # Smaller VLMs (e.g. Qwen2.5-VL-3B-Instruct) often aren't; confirm on
   # https://huggingface.co/settings/inference-providers before changing this.
   HUGGINGFACE_MODEL=Qwen/Qwen2.5-VL-72B-Instruct
   ```

No other code changes are needed - `lib/nutrition/estimateNutrition.ts` picks the provider based
on `NUTRITION_PROVIDER` alone. Both providers call Hugging Face / Ollama through the same
`NutritionProvider` interface in `lib/nutrition/types.ts`. The Hugging Face fallback model is
exported as `DEFAULT_HUGGINGFACE_MODEL` from `huggingfaceProvider.ts` (tests assert this stays
routable). To add another backend (OpenAI, Anthropic, etc.), copy the pattern in
`lib/nutrition/providers/huggingfaceProvider.ts` and register it in `getProvider()`.

### Provider constraints

| Concern | Ollama | Hugging Face |
| --- | --- | --- |
| Where it runs | Local process (`OLLAMA_BASE_URL`, default `http://localhost:11434`) | Hosted OpenAI-compatible API at `https://router.huggingface.co/v1` |
| Model env | `OLLAMA_MODEL` (default `llava`) — must be vision-capable and already pulled | `HUGGINGFACE_MODEL` (default `Qwen/Qwen2.5-VL-72B-Instruct`) — must be routable on your account |
| Auth | None | `HUGGINGFACE_API_KEY` required |
| Photos | Fetched server-side via `lib/nutrition/fetchPhoto.ts` (allowlisted signed Supabase URLs only), sent as base64 | Same allowlisted fetch, then inlined as a data URL (HF can't reach private/local signed URLs itself) |
| Timeout | `ESTIMATE_TIMEOUT_MS` (code default 30s; `.env.local.example` uses 60s for cold local models) | Same env var |

## Deployment (Vercel)

There is currently **no advertised live URL** — production sharing is paused. The repo can still
be deployed to Vercel (git-connected projects auto-deploy on push to `main`). To stand up your
own deployment:

1. Create a hosted Supabase project (`npx supabase projects create`, or via the dashboard) and
   push the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
2. Import this repo in [Vercel](https://vercel.com/new) (or `vercel link` + `vercel git connect`).
3. Set these environment variables in the Vercel project (Production and Preview) - see
   [Setup](#setup) and [Switching nutrition providers](#switching-nutrition-providers-eg-for-deployment)
   above for where each value comes from:
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` - from the hosted Supabase project
   - `NUTRITION_PROVIDER=huggingface`, `HUGGINGFACE_API_KEY`, `HUGGINGFACE_MODEL` - Ollama can't
     run on Vercel (no persistent server, multi-GB model weights)
   - `ESTIMATE_TIMEOUT_MS` (e.g. `60000`) - optional, Vercel's Fluid Compute default (300s) is
     comfortably above this either way
4. Deploy (`vercel --prod`, or just push to `main`).

Since this repo is public, double check before deploying: no `.env*` file except
`.env.local.example` is tracked (see `.gitignore`), and all real secrets live only in Vercel's
encrypted environment variables / your local `.env.local` - never in git history.

## Testing

Vitest covers the high-risk server paths (no browser/E2E suite yet):

```bash
npm test          # single run (CI-friendly)
npm run test:watch
```

| Area | Files | What it locks in |
| --- | --- | --- |
| Provider routing | `lib/nutrition/estimateNutrition.test.ts` | Default `ollama`, `NUTRITION_PROVIDER=huggingface`, unknown provider rejection |
| Hugging Face provider | `lib/nutrition/providers/huggingfaceProvider.test.ts` | `DEFAULT_HUGGINGFACE_MODEL` (`Qwen/Qwen2.5-VL-72B-Instruct`), env override, auth/timeout/parse errors, image inlining, null-macro rejection |
| Ollama provider | `lib/nutrition/providers/ollamaProvider.test.ts` | Auth-free call shape, timeout/unavailable mapping, parse failures, allowlisted photo base64 |
| Photo URL allowlist | `lib/nutrition/fetchPhoto.test.ts` | Origin/path allowlist, 10MB download cap, signed-URL-only fetches |
| Macro JSON parsing | `lib/nutrition/parseEstimate.test.ts` | Accepts numbers/numeric strings; rejects null, `""`, booleans, negatives |
| Estimate photo retry helper | `lib/meals/estimatePhoto.test.ts` | `resolveEstimatePhoto` reuses cached signed URL; only uploads when needed |
| Estimate API | `app/api/estimate/route.test.ts` | JSON body + error → HTTP status mapping |
| Upload API | `app/api/upload/route.test.ts` | Missing/empty file → 400, oversized → 413, storage failure → 502 |
| Meals APIs | `app/api/meals/route.test.ts`, `app/api/meals/[id]/route.test.ts` | Create validation (incl. invalid JSON / non-finite macros), list failures, PATCH/DELETE status mapping |
| Repository | `lib/meals/repository.test.ts` | Insert/list, delete Storage cleanup + not-found, update description |
| Log grouping | `lib/meals/grouping.test.ts`, `lib/meals/types.test.ts` | Day buckets, totals, date/time labels, `isMealType` |

Config: `vitest.config.ts` (Node environment, `**/*.test.ts`, `@/` alias). Tests mock providers and
Supabase; they do not require Ollama or a running database.

## Meal logging workflow

Adding a meal on `/add` runs this client → API chain (see `components/MealForm.tsx`):

1. **Upload (optional)** — `POST /api/upload` with multipart field `photo` (max 10MB). Stores the
   file in the private `meal-photos` bucket and returns `{ path, url }` where `url` is a
   short-lived signed URL (~1 hour). Status mapping: missing/non-file or empty body → **400**,
   oversized → **413**, Storage/sign failure → **502**.
2. **Estimate** — `POST /api/estimate` with `{ photoUrl?, description? }` (at least one required).
   Routes through `estimateNutrition()` → the active provider. Success body:
   `{ calories, protein, carbs, fat }`. Error mapping (`lib/nutrition/errors.ts`):
   `NutritionInputError` / `NutritionParseError` → 422, `NutritionUnavailableError` → 503,
   `NutritionTimeoutError` → 504, unknown → 500. See [Photo URL allowlist](#photo-url-allowlist-estimate)
   and [Estimate response parsing](#estimate-response-parsing).
3. **Save** — `POST /api/meals` with the estimate plus optional `photoPath`, `description`, and
   `mealType` (`breakfast` \| `lunch` \| `dinner` \| `snack` \| `drink`). Requires at least a
   photo path or non-empty description, a valid `mealType` when present, and finite numbers for
   all four macros (`Infinity` / non-numbers → 422). Persists via `lib/meals/repository.ts`
   (201 on success).

**Re-estimate / retry:** After a successful upload, `MealForm` keeps both the Storage `path` and
the signed `url` in component state. Photo reuse is decided by
[`resolveEstimatePhoto`](lib/meals/estimatePhoto.ts) (`needsUpload` only when there is a local
file and no cached path). A second estimate (error retry or the "Re-estimate" button) reuses the
cached signed URL and does **not** re-upload. Clearing or replacing the photo resets both. If the
signed URL has expired (~1 hour), upload again before estimating. Manual entry ("skip estimate")
jumps to the review stage with zeros so macros can be typed in by hand.

Other meal APIs: `GET /api/meals` (list, newest first; list failure → 500),
`PATCH /api/meals/[id]` (rename description; empty name → 400; unknown id → 404),
`DELETE /api/meals/[id]` (deletes the row, then best-effort removes the Storage object; unknown
id → 404; Storage cleanup errors are logged and do **not** fail the request once the row is gone).

The Log view (`/`, see [Screenshots](#screenshots)) groups meals by local calendar day via
`lib/meals/grouping.ts` (`groupMealsByDay`). Each day renders a `DayOverviewCard` calorie ring
and macro totals against a fixed `DAILY_CALORIE_GOAL` of 1800 kcal (not yet a user setting),
then a `MealCard` list for that day.

### Photo URL allowlist (estimate)

`photoUrl` on `POST /api/estimate` is client-supplied. Both providers download it through
[`lib/nutrition/fetchPhoto.ts`](lib/nutrition/fetchPhoto.ts) (`fetchPhotoAsBase64` /
`fetchPhotoAsDataUrl`) before calling the model — they do **not** fetch arbitrary URLs.

Constraints (enforced before any network read of the image):

- Origin must match `NEXT_PUBLIC_SUPABASE_URL` exactly (same host + scheme + port).
- Path must start with `/storage/v1/object/sign/` (signed object URLs only — public or other
  Storage paths are rejected).
- Download is capped at **10MB** (`MAX_ESTIMATE_PHOTO_BYTES`), matching the upload route, so
  estimate cannot pull larger blobs than upload accepts.
- Failures throw `NutritionInputError` → HTTP **422** (e.g. wrong host, non-signed path,
  missing `NEXT_PUBLIC_SUPABASE_URL`, photo too large, or HTTP error loading the signed URL).

Example of an accepted URL shape (token and object key vary):

```text
http://127.0.0.1:54321/storage/v1/object/sign/meal-photos/<object>?token=<jwt>
```

Callers should pass the `url` from `/api/upload` (or a freshly signed URL from meal list), not a
raw Storage path, not a public object URL, and not an external image link.

### Estimate response parsing

Both providers extract a JSON object from the model reply, then validate it with
[`lib/nutrition/parseEstimate.ts`](lib/nutrition/parseEstimate.ts) (`parseEstimate` /
`estimateSchema`). Invalid output becomes `NutritionParseError` → HTTP **422**.

Accepted macro fields (`calories`, `protein`, `carbs`, `fat`):

- Finite non-negative numbers (`450`, `30.5`)
- Numeric strings the model sometimes returns (`"450"`, `"30.5"`)

Rejected (fail closed — do **not** coerce):

- `null` / missing fields (including partial abstention, e.g. calories set but `protein: null`)
- Empty strings (`""`)
- Booleans (`true` / `false` — Zod's `z.coerce.number()` would turn these into `1` / `0`)
- Negatives and non-numeric strings (`"450kcal"`)

Intent: when the model abstains on a field, the API must not invent zeros that look like a
plausible estimate. The UI can retry or use manual entry (`skipToManualEntry` in `MealForm`).

## Project structure

- `app/` - routes: `/` (Log view), `/add` (meal entry form), `/api/estimate`, `/api/upload`,
  `/api/meals`, `/api/meals/[id]`
- `lib/nutrition/` - the `estimateNutrition()` seam, providers (Ollama, Hugging Face),
  `fetchPhoto.ts` (signed-URL allowlist + size cap), and `parseEstimate.ts` (macro JSON
  validation shared by every provider) - swap backends via the `NUTRITION_PROVIDER` env var
- `lib/meals/` - Supabase data access (`repository.ts`), estimate photo resolution
  (`estimatePhoto.ts` / `resolveEstimatePhoto`), and day-grouping/formatting helpers
  (`DAILY_CALORIE_GOAL`, `groupMealsByDay`, date/time formatters)
- `lib/supabase/server.ts` - server-only Supabase client (secret key)
- `supabase/migrations/` - the `meals` table and `meal-photos` Storage bucket, both with RLS
  enabled and no anon/authenticated policies (access only via the secret key, server-side)
- `docs/screenshots/` - UI screenshots embedded in this README (log view + add-meal form)
- `*.test.ts` + `vitest.config.ts` - unit/API regression tests (see [Testing](#testing))

## Notes on data access

The `meals` table and `meal-photos` bucket have row-level security enabled with no policies for
`anon`/`authenticated`, so the browser never talks to Supabase directly - every read/write goes
through a Next.js API route using the secret key. When multi-user auth is added later, this
table can grow user-scoped RLS policies without changing today's server-side access pattern.

`photo_url` in Postgres stores the **Storage object path**, not a public URL. Signed URLs are
minted on read (`listMeals` / upload response) and expire after about an hour.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Estimate returns 503 / "local model server is unavailable" | Ollama isn't running, or wrong `OLLAMA_BASE_URL` | Start Ollama (`ollama serve` / desktop app); confirm `ollama list` shows your model |
| Estimate times out (504) | Cold start or slow CPU inference | Raise `ESTIMATE_TIMEOUT_MS` (e.g. `60000`); first Ollama request after idle is often slow |
| HF estimate fails with HTTP 4xx mentioning the model | Model not routable via Inference Providers | Use the default `Qwen/Qwen2.5-VL-72B-Instruct`, or pick a VLM listed under [Inference Providers](https://huggingface.co/settings/inference-providers) for your account — smaller checkpoints often aren't available |
| HF estimate: missing API key | `HUGGINGFACE_API_KEY` unset while `NUTRITION_PROVIDER=huggingface` | Create a fine-grained token with "Make calls to Inference Providers" and set it in env |
| Supabase client errors on boot / upload | Missing or wrong `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Run `npx supabase status` and copy `API_URL` + `SECRET_KEY` (`sb_secret_...`) into `.env.local` |
| Photo preview works but estimate can't load the image | Signed URL expired or Storage unreachable from the server | Clear the photo and upload again (retry alone can't mint a fresh signed URL); ensure the Next.js server can reach local Supabase (`127.0.0.1:54321`) |
| Estimate 422: "Photo URL must be a signed URL from this app's storage" | `photoUrl` is not a signed object URL on this project's Supabase origin (SSRF allowlist) | Pass the `url` from `POST /api/upload` / meal list — must be `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/...`. External, public-bucket, or path-only values are rejected |
| Estimate 422: "Photo is too large to estimate (max 10MB)" | Signed object larger than the download cap | Re-upload a smaller image (upload also enforces 10MB) |
| Estimate 422 about missing `NEXT_PUBLIC_SUPABASE_URL` | Env unset while estimating with a photo | Set `NEXT_PUBLIC_SUPABASE_URL` to the same API URL used for upload (allowlist can't verify otherwise) |
| Estimate 422: "couldn't be understood as a nutrition estimate" | Model returned non-JSON, incomplete macros, or null/empty/boolean fields | Retry estimate; if the model keeps abstaining, use manual entry and edit macros on the review step |
| Upload 400: empty photo / no `photo` field | Multipart missing `photo` or zero-byte file | Send a real image under the `photo` field |
| Re-estimate after an error ignores the photo | Expired signed URL, or photo cleared from form state | Hard-refresh and re-upload; confirm `MealForm` still has `uploadedUrl` (via `resolveEstimatePhoto`) |

## Useful commands

```bash
npm test               # run unit/API regression tests
npx supabase status    # print local API URL / keys again
npx supabase stop      # stop the local stack
npx supabase db reset  # recreate the local DB and reapply migrations
ollama list            # see which local models are available
```
