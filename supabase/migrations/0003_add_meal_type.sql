-- Optional categorization shown in the UI (breakfast/lunch/dinner/snack/drink).
-- Nullable so existing rows and any future API caller that omits it stay valid.
alter table public.meals
  add column meal_type text
  constraint meals_meal_type_check
  check (meal_type is null or meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'drink'));
