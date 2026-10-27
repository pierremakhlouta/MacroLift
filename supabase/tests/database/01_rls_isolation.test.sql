-- Cross-account isolation: user B (and anon) must not read, insert, update or delete
-- anything belonging to user A, through any table, including child tables.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

select is((select count(*)::int from public.profiles where id in
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')), 2,
  'profiles are created automatically for new auth users');

-- Built-in catalog rows
insert into public.exercises (id, owner_id, name, muscles, equipment, load_type) values
  ('e0000000-0000-0000-0000-00000000b001', null, 'Test Builtin Squat', '{quads,glutes}', 'barbell', 'external');
insert into public.foods (id, owner_id, name, serving_size, serving_unit, calories_kcal) values
  ('f0000000-0000-0000-0000-00000000b001', null, 'Test Builtin Oats', 40, 'g', 150);

-- User A's data, one row per table
insert into public.exercises (id, owner_id, name, muscles) values
  ('e0000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Custom Curl', '{biceps}');
insert into public.routines (id, user_id, name) values
  ('10000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Push Day');
insert into public.routine_exercises (id, routine_id, user_id, exercise_id, position, target_sets) values
  ('11000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000a001', 0, 3);
insert into public.workout_sessions (id, user_id, routine_id, routine_name_snapshot) values
  ('20000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000a001', 'A Push Day');
insert into public.session_exercises (id, session_id, user_id, exercise_id, exercise_name_snapshot, position) values
  ('21000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000a001', 'A Custom Curl', 0);
insert into public.workout_sets (id, session_exercise_id, user_id, position, reps, weight_kg) values
  ('22000000-0000-0000-0000-00000000a001', '21000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 0, 10, 20);
insert into public.weight_entries (id, user_id, measured_on, weight_kg) values
  ('30000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-01', 80.5);
insert into public.body_measurements (id, user_id, measured_on, site, value_cm) values
  ('31000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-01', 'waist', 85);
insert into public.foods (id, owner_id, name, serving_size, serving_unit, calories_kcal) values
  ('f0000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Secret Shake', 1, 'scoop', 120);
insert into public.meal_templates (id, user_id, name) values
  ('40000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Breakfast');
insert into public.meal_template_items (id, template_id, user_id, food_id, position, quantity) values
  ('41000000-0000-0000-0000-00000000a001', '40000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000a001', 0, 1);
insert into public.nutrition_days (id, user_id, day) values
  ('50000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-01');
insert into public.diary_entries (id, nutrition_day_id, user_id, meal, food_id, food_name, serving_size, serving_unit, calories_kcal, quantity) values
  ('51000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', 'breakfast', 'f0000000-0000-0000-0000-00000000a001', 'A Secret Shake', 1, 'scoop', 120, 1);
insert into public.nutrition_targets (id, user_id, effective_from, calories_kcal) values
  ('60000000-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-01', 2500);

-- User B's own day/session/template, used for cross-parent insert attempts.
insert into public.workout_sessions (id, user_id) values
  ('20000000-0000-0000-0000-00000000b002', 'bbbbbbbb-0000-0000-0000-000000000002');
insert into public.nutrition_days (id, user_id, day) values
  ('50000000-0000-0000-0000-00000000b002', 'bbbbbbbb-0000-0000-0000-000000000002', '2026-10-01');
insert into public.meal_templates (id, user_id, name) values
  ('40000000-0000-0000-0000-00000000b002', 'bbbbbbbb-0000-0000-0000-000000000002', 'B Lunch');

-- ---------------------------------------------------------------------------
-- Act as user B
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'impersonating user B');

-- Reads: B sees nothing of A's
select is_empty($$ select 1 from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'B cannot read A profile');
select is((select count(*)::int from public.profiles), 1, 'B sees exactly one profile (their own)');
select is_empty($$ select 1 from public.exercises where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'B cannot read A exercises');
select is_empty($$ select 1 from public.routines $$, 'B cannot read A routines');
select is_empty($$ select 1 from public.routine_exercises $$, 'B cannot read A routine exercises');
select is_empty($$ select 1 from public.workout_sessions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'B cannot read A sessions');
select is_empty($$ select 1 from public.session_exercises $$, 'B cannot read A session exercises');
select is_empty($$ select 1 from public.workout_sets $$, 'B cannot read A sets');
select is_empty($$ select 1 from public.weight_entries $$, 'B cannot read A weight entries');
select is_empty($$ select 1 from public.body_measurements $$, 'B cannot read A measurements');
select is_empty($$ select 1 from public.foods where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'B cannot read A foods');
select is_empty($$ select 1 from public.meal_templates where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'B cannot read A meal templates');
select is_empty($$ select 1 from public.meal_template_items $$, 'B cannot read A meal template items');
select is_empty($$ select 1 from public.nutrition_days where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'B cannot read A nutrition days');
select is_empty($$ select 1 from public.diary_entries $$, 'B cannot read A diary entries');
select is_empty($$ select 1 from public.nutrition_targets $$, 'B cannot read A targets');

-- Built-in catalogs are readable
select isnt_empty($$ select 1 from public.exercises where id = 'e0000000-0000-0000-0000-00000000b001' $$, 'B can read built-in exercises');
select isnt_empty($$ select 1 from public.foods where id = 'f0000000-0000-0000-0000-00000000b001' $$, 'B can read built-in foods');

-- Updates: silently affect zero rows
select is_empty($$ update public.profiles set display_name = 'pwned' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1 $$, 'B cannot update A profile');
select is_empty($$ update public.exercises set name = 'pwned' where id = 'e0000000-0000-0000-0000-00000000a001' returning 1 $$, 'B cannot update A exercise');
select is_empty($$ update public.routines set name = 'pwned' returning 1 $$, 'B cannot update A routine');
select is_empty($$ update public.routine_exercises set target_sets = 9 returning 1 $$, 'B cannot update A routine exercise');
select is_empty($$ update public.workout_sessions set notes = 'pwned' where id = '20000000-0000-0000-0000-00000000a001' returning 1 $$, 'B cannot update A session');
select is_empty($$ update public.session_exercises set notes = 'pwned' returning 1 $$, 'B cannot update A session exercise');
select is_empty($$ update public.workout_sets set reps = 99 returning 1 $$, 'B cannot update A set');
select is_empty($$ update public.weight_entries set weight_kg = 1 returning 1 $$, 'B cannot update A weight');
select is_empty($$ update public.body_measurements set value_cm = 1 returning 1 $$, 'B cannot update A measurement');
select is_empty($$ update public.foods set name = 'pwned' where id = 'f0000000-0000-0000-0000-00000000a001' returning 1 $$, 'B cannot update A food');
select is_empty($$ update public.meal_templates set name = 'pwned' where id = '40000000-0000-0000-0000-00000000a001' returning 1 $$, 'B cannot update A template');
select is_empty($$ update public.meal_template_items set quantity = 9 returning 1 $$, 'B cannot update A template item');
select is_empty($$ update public.nutrition_days set notes = 'pwned' where id = '50000000-0000-0000-0000-00000000a001' returning 1 $$, 'B cannot update A day');
select is_empty($$ update public.diary_entries set quantity = 9 returning 1 $$, 'B cannot update A diary entry');
select is_empty($$ update public.nutrition_targets set calories_kcal = 1 returning 1 $$, 'B cannot update A target');

-- Built-in catalog rows are not editable
select is_empty($$ update public.exercises set name = 'pwned' where id = 'e0000000-0000-0000-0000-00000000b001' returning 1 $$, 'B cannot update built-in exercise');
select is_empty($$ update public.foods set name = 'pwned' where id = 'f0000000-0000-0000-0000-00000000b001' returning 1 $$, 'B cannot update built-in food');
select is_empty($$ delete from public.exercises where id = 'e0000000-0000-0000-0000-00000000b001' returning 1 $$, 'B cannot delete built-in exercise');
select is_empty($$ delete from public.foods where id = 'f0000000-0000-0000-0000-00000000b001' returning 1 $$, 'B cannot delete built-in food');
select throws_ok($$ insert into public.exercises (owner_id, name) values (null, 'Fake builtin') $$, '42501', null, 'B cannot create built-in exercises');
select throws_ok($$ insert into public.foods (owner_id, name, serving_size, serving_unit) values (null, 'Fake builtin', 1, 'g') $$, '42501', null, 'B cannot create built-in foods');

-- Deletes: silently affect zero rows
select is_empty($$ delete from public.routines returning 1 $$, 'B cannot delete A routine');
select is_empty($$ delete from public.workout_sessions where id = '20000000-0000-0000-0000-00000000a001' returning 1 $$, 'B cannot delete A session');
select is_empty($$ delete from public.workout_sets returning 1 $$, 'B cannot delete A sets');
select is_empty($$ delete from public.weight_entries returning 1 $$, 'B cannot delete A weights');
select is_empty($$ delete from public.diary_entries returning 1 $$, 'B cannot delete A diary entries');
select is_empty($$ delete from public.foods where id = 'f0000000-0000-0000-0000-00000000a001' returning 1 $$, 'B cannot delete A food');
select is_empty($$ delete from public.nutrition_targets returning 1 $$, 'B cannot delete A targets');

-- Inserts claiming A's identity are rejected
select throws_ok($$ insert into public.routines (user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x') $$, '42501', null, 'B cannot insert a routine as A');
select throws_ok($$ insert into public.weight_entries (user_id, measured_on, weight_kg) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-02', 70) $$, '42501', null, 'B cannot insert weight as A');
select throws_ok($$ insert into public.nutrition_targets (user_id, effective_from, calories_kcal) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-02', 1000) $$, '42501', null, 'B cannot insert target as A');
select throws_ok($$ insert into public.foods (owner_id, name, serving_size, serving_unit) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', 1, 'g') $$, '42501', null, 'B cannot insert food as A');

-- Child rows under A's parents are rejected even with B's own user_id
select throws_ok($$ insert into public.routine_exercises (routine_id, user_id, exercise_id, position) values ('10000000-0000-0000-0000-00000000a001', auth.uid(), 'e0000000-0000-0000-0000-00000000b001', 1) $$, '42501', null, 'B cannot add exercises to A routine');
select throws_ok($$ insert into public.session_exercises (id, session_id, user_id, exercise_name_snapshot, position) values (gen_random_uuid(), '20000000-0000-0000-0000-00000000a001', auth.uid(), 'x', 1) $$, '42501', null, 'B cannot add exercises to A session');
select throws_ok($$ insert into public.workout_sets (id, session_exercise_id, user_id, position) values (gen_random_uuid(), '21000000-0000-0000-0000-00000000a001', auth.uid(), 1) $$, '42501', null, 'B cannot add sets to A session exercise');
select throws_ok($$ insert into public.meal_template_items (template_id, user_id, food_id, position, quantity) values ('40000000-0000-0000-0000-00000000a001', auth.uid(), 'f0000000-0000-0000-0000-00000000b001', 1, 1) $$, '42501', null, 'B cannot add items to A template');
select throws_ok($$ insert into public.diary_entries (id, nutrition_day_id, user_id, meal, food_name, serving_size, serving_unit, quantity) values (gen_random_uuid(), '50000000-0000-0000-0000-00000000a001', auth.uid(), 'lunch', 'x', 1, 'g', 1) $$, '42501', null, 'B cannot add entries to A day');

-- B's own parents cannot reference A's private catalog rows or routines
select throws_ok($$ insert into public.session_exercises (id, session_id, user_id, exercise_id, exercise_name_snapshot, position) values (gen_random_uuid(), '20000000-0000-0000-0000-00000000b002', auth.uid(), 'e0000000-0000-0000-0000-00000000a001', 'x', 0) $$, '42501', null, 'B cannot reference A custom exercise');
select throws_ok($$ insert into public.meal_template_items (template_id, user_id, food_id, position, quantity) values ('40000000-0000-0000-0000-00000000b002', auth.uid(), 'f0000000-0000-0000-0000-00000000a001', 0, 1) $$, '42501', null, 'B cannot reference A custom food in a template');
select throws_ok($$ insert into public.diary_entries (id, nutrition_day_id, user_id, meal, food_id, food_name, serving_size, serving_unit, quantity) values (gen_random_uuid(), '50000000-0000-0000-0000-00000000b002', auth.uid(), 'lunch', 'f0000000-0000-0000-0000-00000000a001', 'x', 1, 'g', 1) $$, '42501', null, 'B cannot reference A custom food in diary');
select throws_ok($$ insert into public.diary_entries (id, nutrition_day_id, user_id, meal, meal_template_id, food_name, serving_size, serving_unit, quantity) values (gen_random_uuid(), '50000000-0000-0000-0000-00000000b002', auth.uid(), 'lunch', '40000000-0000-0000-0000-00000000a001', 'x', 1, 'g', 1) $$, '42501', null, 'B cannot reference A meal template in diary');
select throws_ok($$ update public.workout_sessions set routine_id = '10000000-0000-0000-0000-00000000a001' where id = '20000000-0000-0000-0000-00000000b002' $$, '42501', null, 'B cannot link own session to A routine');

-- Moving own row to A is rejected
select throws_ok($$ update public.workout_sessions set user_id = 'aaaaaaaa-0000-0000-0000-000000000001' where id = '20000000-0000-0000-0000-00000000b002' $$, '42501', null, 'B cannot hand a row to A');

-- B can still use built-ins and own data
select lives_ok($$ insert into public.exercises (id, owner_id, name) values ('e0000000-0000-0000-0000-00000000b002', auth.uid(), 'B Custom Row') $$, 'B can create own exercise');
select throws_ok($$ update public.exercises set owner_id = null where id = 'e0000000-0000-0000-0000-00000000b002' $$, '42501', null, 'B cannot turn own exercise into a built-in');
select lives_ok($$ insert into public.session_exercises (id, session_id, user_id, exercise_id, exercise_name_snapshot, position) values (gen_random_uuid(), '20000000-0000-0000-0000-00000000b002', auth.uid(), 'e0000000-0000-0000-0000-00000000b001', 'Test Builtin Squat', 0) $$, 'B can log a built-in exercise');

-- ---------------------------------------------------------------------------
-- Anonymous callers get nothing
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select 1 from public.exercises $$, '42501', null, 'anon cannot read exercises');
select throws_ok($$ select 1 from public.diary_entries $$, '42501', null, 'anon cannot read diary entries');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot call delete_my_account');

-- ---------------------------------------------------------------------------
-- A's data is intact after B's attempts
-- ---------------------------------------------------------------------------
reset role;
select is((select name from public.routines where id = '10000000-0000-0000-0000-00000000a001'), 'A Push Day', 'A routine unchanged');
select is((select reps from public.workout_sets where id = '22000000-0000-0000-0000-00000000a001'), 10, 'A set unchanged');
select is((select weight_kg from public.weight_entries where id = '30000000-0000-0000-0000-00000000a001'), 80.5, 'A weight unchanged');
select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), null, 'A profile unchanged');
select is((select name from public.exercises where id = 'e0000000-0000-0000-0000-00000000b001'), 'Test Builtin Squat', 'built-in exercise unchanged');

-- ---------------------------------------------------------------------------
-- Account deletion removes all of A's personal data and nothing else
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_account() $$, 'A can delete their own account');
reset role;

select is_empty($$ select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'A auth user removed');
select is_empty($$
  select 1 from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.exercises where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.routines where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.routine_exercises where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.workout_sessions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.session_exercises where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.workout_sets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.weight_entries where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.body_measurements where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.foods where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.meal_templates where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.meal_template_items where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.nutrition_days where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.diary_entries where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  union all select 1 from public.nutrition_targets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
$$, 'all of A personal rows are removed');
select isnt_empty($$ select 1 from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$, 'B profile survives A deletion');
select isnt_empty($$ select 1 from public.exercises where id = 'e0000000-0000-0000-0000-00000000b001' $$, 'built-in exercise survives A deletion');
select isnt_empty($$ select 1 from public.foods where id = 'f0000000-0000-0000-0000-00000000b001' $$, 'built-in food survives A deletion');

select * from finish();
rollback;
