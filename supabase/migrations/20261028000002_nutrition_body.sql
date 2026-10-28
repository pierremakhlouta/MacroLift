-- Phase 4: nutrition diary, meal templates, food provenance.

-- Where a food came from. 'usda' rows were copied from USDA FoodData Central (public domain);
-- the copy is the user's own row, so the diary never depends on the external API.
alter table public.foods
  add column source text not null default 'user' check (source in ('user', 'builtin', 'usda')),
  add column source_ref text check (char_length(source_ref) <= 64);

create unique index foods_owner_usda_key on public.foods (owner_id, source_ref)
  where source = 'usda' and archived_at is null;

-- ---------------------------------------------------------------------------
-- add_diary_entries: log foods (or a meal template's items) to a day and meal.
--   * The nutrition_days row is created on demand.
--   * For items with food_id, the snapshot (name, serving, nutrients) is copied from the food
--     row the caller can see (built-in or their own) - so later food edits never change the log.
--   * Items without food_id are "quick adds" and carry their own snapshot fields.
--   * Idempotent: client-generated entry ids; retries insert nothing new.
--   * SECURITY INVOKER: RLS applies to every read and write.
-- p_items: [{ id, quantity, food_id?, meal_template_id?, food_name?, brand?, serving_size?,
--             serving_unit?, calories_kcal?, protein_g?, carbs_g?, fat_g?, fiber_g?, sugar_g?, sodium_mg? }]
-- ---------------------------------------------------------------------------
create function public.add_diary_entries(p_day date, p_meal public.meal_category, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  day_id uuid;
  item jsonb;
  f public.foods;
  base_pos integer;
  ord integer := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'too many items' using errcode = '22023';
  end if;

  insert into public.nutrition_days (user_id, day) values (uid, p_day)
  on conflict (user_id, day) do update set updated_at = public.nutrition_days.updated_at
  returning id into day_id;

  select coalesce(max(position) + 1, 0) into base_pos
  from public.diary_entries where nutrition_day_id = day_id and meal = p_meal;

  for item in select value from jsonb_array_elements(p_items) loop
    if (item->>'id') is null or (item->>'quantity') is null then
      raise exception 'each item needs id and quantity' using errcode = '22023';
    end if;

    if (item->>'food_id') is not null then
      select * into f from public.foods where id = (item->>'food_id')::uuid;
      if not found then
        raise exception 'food not found' using errcode = '42501';
      end if;
      insert into public.diary_entries
        (id, nutrition_day_id, user_id, meal, position, food_id, meal_template_id, food_name, brand,
         serving_size, serving_unit, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, quantity)
      values
        ((item->>'id')::uuid, day_id, uid, p_meal, base_pos + ord, f.id, (item->>'meal_template_id')::uuid,
         f.name, f.brand, f.serving_size, f.serving_unit, f.calories_kcal, f.protein_g, f.carbs_g, f.fat_g,
         f.fiber_g, f.sugar_g, f.sodium_mg, (item->>'quantity')::numeric)
      on conflict (id) do nothing;
    else
      insert into public.diary_entries
        (id, nutrition_day_id, user_id, meal, position, food_id, meal_template_id, food_name, brand,
         serving_size, serving_unit, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, quantity)
      select (item->>'id')::uuid, day_id, uid, p_meal, base_pos + ord, null, r.meal_template_id, btrim(r.food_name),
             nullif(btrim(r.brand), ''), coalesce(r.serving_size, 1), coalesce(nullif(btrim(r.serving_unit), ''), 'serving'),
             r.calories_kcal, r.protein_g, r.carbs_g, r.fat_g, r.fiber_g, r.sugar_g, r.sodium_mg, r.quantity
      from jsonb_populate_record(null::public.diary_entries, item) r
      on conflict (id) do nothing;
    end if;
    ord := ord + 1;
  end loop;

  return day_id;
end;
$$;

revoke all on function public.add_diary_entries(date, public.meal_category, jsonb) from public, anon;
grant execute on function public.add_diary_entries(date, public.meal_category, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- save_meal_template: atomic, idempotent save of a reusable meal and its items (same pattern
-- as save_routine). p_items: [{ id, food_id, quantity }]; array order = position.
-- ---------------------------------------------------------------------------
create function public.save_meal_template(p_id uuid, p_name text, p_notes text, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'p_items must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'a meal can have at most 100 items' using errcode = '22023';
  end if;

  insert into public.meal_templates (id, user_id, name, notes)
  values (p_id, uid, btrim(p_name), nullif(btrim(p_notes), ''))
  on conflict (id) do update set name = excluded.name, notes = excluded.notes;

  delete from public.meal_template_items mi
  where mi.template_id = p_id
    and mi.id not in (select (item->>'id')::uuid from jsonb_array_elements(p_items) item);

  insert into public.meal_template_items (id, template_id, user_id, food_id, position, quantity)
  select (item->>'id')::uuid, p_id, uid, (item->>'food_id')::uuid, (ord - 1)::int, (item->>'quantity')::numeric
  from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  on conflict (id) do update set
    template_id = excluded.template_id,
    food_id = excluded.food_id,
    position = excluded.position,
    quantity = excluded.quantity;

  return p_id;
end;
$$;

revoke all on function public.save_meal_template(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_meal_template(uuid, text, text, jsonb) to authenticated;
