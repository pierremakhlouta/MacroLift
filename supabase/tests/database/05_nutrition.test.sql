-- Phase 4: diary entries (server-side snapshots), meal templates, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'na@test.local'),
  ('bbbbbbbb-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nb@test.local');

insert into public.foods (id, owner_id, name, serving_size, serving_unit, calories_kcal, protein_g, carbs_g, fat_g) values
  ('f0000000-0000-0000-0000-0000000000a5', 'aaaaaaaa-0000-0000-0000-0000000000a5', 'A Greek Yogurt', 170, 'g', 100, 17, 6, null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

create temp table req as select '[
  {"id":"51000000-0000-0000-0000-0000000000a1","food_id":"f0000000-0000-0000-0000-0000000000a5","quantity":1.5},
  {"id":"51000000-0000-0000-0000-0000000000a2","food_name":"Coffee w/ milk","serving_size":1,"serving_unit":"cup","calories_kcal":40,"quantity":1}
]'::jsonb as items;
grant select on req to authenticated;

select lives_ok($$ select public.add_diary_entries('2026-10-28', 'breakfast', (select items from req)) $$, 'logs a saved food and a quick add');
select lives_ok($$ select public.add_diary_entries('2026-10-28', 'breakfast', (select items from req)) $$, 'retry succeeds');
select is((select count(*)::int from public.diary_entries), 2, 'retry does not duplicate entries');
select is((select count(*)::int from public.nutrition_days where day = '2026-10-28'), 1, 'one day row');
select results_eq($$ select food_name, serving_size, serving_unit, calories_kcal, protein_g, fat_g, quantity, position from public.diary_entries order by position $$,
  $$ values ('A Greek Yogurt', 170::numeric, 'g', 100::numeric, 17::numeric, null::numeric, 1.5::numeric, 0),
            ('Coffee w/ milk', 1::numeric, 'cup', 40::numeric, null::numeric, null::numeric, 1::numeric, 1) $$,
  'snapshot copied from the food; unknown nutrients stay null');

-- Editing the food later does not rewrite the diary.
update public.foods set calories_kcal = 999, name = 'Renamed' where id = 'f0000000-0000-0000-0000-0000000000a5';
select is((select calories_kcal from public.diary_entries where id = '51000000-0000-0000-0000-0000000000a1'), 100::numeric, 'diary keeps logged calories');

-- New entries in the same meal go after existing ones.
select lives_ok($$ select public.add_diary_entries('2026-10-28', 'breakfast', '[{"id":"51000000-0000-0000-0000-0000000000a3","food_name":"Toast","calories_kcal":80,"quantity":2}]') $$, 'append');
select is((select position from public.diary_entries where id = '51000000-0000-0000-0000-0000000000a3'), 2, 'appended at the end');

-- Validation
select throws_ok($$ select public.add_diary_entries('2026-10-28', 'breakfast', '[]') $$, '22023', null, 'empty items rejected');
select throws_ok($$ select public.add_diary_entries('2026-10-28', 'brunch', '[{"id":"51000000-0000-0000-0000-0000000000b1","food_name":"x","quantity":1}]') $$, '22P02', null, 'invalid meal rejected');
select throws_ok($$ select public.add_diary_entries('2026-10-28', 'lunch', '[{"id":"51000000-0000-0000-0000-0000000000b2","food_name":"x","quantity":0}]') $$, '23514', null, 'zero quantity rejected');
select throws_ok($$ select public.add_diary_entries('2026-10-28', 'lunch', '[{"id":"51000000-0000-0000-0000-0000000000b3","food_name":"x","quantity":1,"protein_g":-1}]') $$, '23514', null, 'negative nutrient rejected');
select throws_ok($$ select public.add_diary_entries('2026-10-28', 'lunch', '[{"id":"51000000-0000-0000-0000-0000000000b4","food_name":"x","quantity":"NaN"}]') $$, '23514', null, 'NaN quantity rejected');

-- Meal templates
select lives_ok($$ select public.save_meal_template('40000000-0000-0000-0000-0000000000a5', ' Breakfast bowl ', '', '[{"id":"41000000-0000-0000-0000-0000000000a1","food_id":"f0000000-0000-0000-0000-0000000000a5","quantity":2}]') $$, 'save template');
select lives_ok($$ select public.save_meal_template('40000000-0000-0000-0000-0000000000a5', 'Breakfast bowl', '', '[{"id":"41000000-0000-0000-0000-0000000000a1","food_id":"f0000000-0000-0000-0000-0000000000a5","quantity":2}]') $$, 'retry save template');
select is((select count(*)::int from public.meal_template_items), 1, 'no duplicate template items');
select is((select name from public.meal_templates), 'Breakfast bowl', 'template name trimmed');

-- ---------------------------------------------------------------- user B
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b5","role":"authenticated"}', true);
select throws_ok($$ select public.add_diary_entries('2026-10-28', 'lunch', '[{"id":"51000000-0000-0000-0000-0000000000c1","food_id":"f0000000-0000-0000-0000-0000000000a5","quantity":1}]') $$,
  '42501', null, 'B cannot log A private food');
select lives_ok($$ select public.add_diary_entries('2026-10-28', 'breakfast', '[{"id":"51000000-0000-0000-0000-0000000000a1","food_name":"hijack","quantity":1}]') $$,
  'B reusing A entry id is a silent no-op (does not reveal it exists)');
select throws_ok($$ select public.save_meal_template('40000000-0000-0000-0000-0000000000a5', 'hijack', null, '[]') $$, '42501', null, 'B cannot overwrite A template');
select throws_ok($$ select public.save_meal_template('40000000-0000-0000-0000-0000000000b5', 'B', null, '[{"id":"41000000-0000-0000-0000-0000000000c1","food_id":"f0000000-0000-0000-0000-0000000000a5","quantity":1}]') $$,
  '42501', null, 'B cannot use A food in a template');
select is_empty($$ select 1 from public.diary_entries $$, 'B sees no diary entries (and the hijack inserted nothing)');
select lives_ok($$ select public.add_diary_entries('2026-10-28', 'lunch', '[{"id":"51000000-0000-0000-0000-0000000000c2","food_name":"B lunch","calories_kcal":500,"quantity":1}]') $$, 'B logs own entry on the same date');
select is((select count(*)::int from public.nutrition_days), 1, 'B has a separate day row');

reset role;
select is((select food_name from public.diary_entries where id = '51000000-0000-0000-0000-0000000000a1'), 'A Greek Yogurt', 'A entry untouched');
select is((select name from public.meal_templates where id = '40000000-0000-0000-0000-0000000000a5'), 'Breakfast bowl', 'A template untouched');

set local role anon;
select throws_ok($$ select public.add_diary_entries('2026-10-28', 'lunch', '[]') $$, '42501', null, 'anon cannot log');

select * from finish();
rollback;
