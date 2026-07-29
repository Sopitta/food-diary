-- Private bucket for meal photos. storage.objects already has RLS enabled by
-- default in Supabase; we add no policies for anon/authenticated, so only the
-- service_role key (used server-side) can upload or read objects. The app
-- generates short-lived signed URLs server-side whenever a photo needs to be
-- displayed in the browser.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;
