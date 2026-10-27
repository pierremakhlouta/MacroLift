-- Database-boundary validation: bad values are rejected even if the client is bypassed.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);

-- Non-finite and out-of-range numbers
select throws_ok($$ insert into public.weight_entries (measured_on, weight_kg) values ('2026-10-01', 'NaN') $$, '23514', null, 'NaN weight rejected');
select throws_ok($$ insert into public.weight_entries (measured_on, weight_kg) values ('2026-10-01', 'Infinity') $$, '23514', null, 'Infinite weight rejected');
select throws_ok($$ insert into public.weight_entries (measured_on, weight_kg) values ('2026-10-01', -1) $$, '23514', null, 'Negative weight rejected');
select throws_ok($$ insert into public.weight_entries (measured_on, weight_kg) values ('2026-10-01', 0) $$, '23514', null, 'Zero weight rejected');
select throws_ok($$ insert into public.weight_entries (measured_on, weight_kg) values ('2026-13-45', 80) $$, '22008', null, 'Malformed date rejected');
select lives_ok($$ insert into public.weight_entries (measured_on, weight_kg) values ('2026-10-01', 80.123456789) $$, 'Unrounded weight stored as-is');
select is((select weight_kg from public.weight_entries where measured_on = '2026-10-01'), 80.123456789, 'Weight not rounded in storage');
select throws_ok($$ insert into public.weight_entries (measured_on, weight_kg) values ('2026-10-01', 81) $$, '23505', null, 'One weigh-in per day (upsert instead)');

-- Profile
select throws_ok($$ update public.profiles set height_cm = 'NaN' $$, '23514', null, 'NaN height rejected');
select throws_ok($$ update public.profiles set height_cm = 0 $$, '23514', null, 'Zero height rejected');
select throws_ok($$ update public.profiles set birth_date = current_date + 1 $$, '23514', null, 'Future birth date rejected');
select lives_ok($$ update public.profiles set birth_date = current_date - 365, height_cm = 75.5, estimate_sex = 'female', activity_level = 'sedentary' $$, 'Any past birth date allowed (no age limit)');
select throws_ok($$ update public.profiles set unit_system = 'furlongs' $$, '22P02', null, 'Invalid unit system rejected');

-- Nutrition: negative nutrients rejected; NULL (unknown) allowed
select throws_ok($$ insert into public.foods (owner_id, name, serving_size, serving_unit, protein_g) values (auth.uid(), 'x', 1, 'g', -1) $$, '23514', null, 'Negative nutrient rejected');
select throws_ok($$ insert into public.foods (owner_id, name, serving_size, serving_unit, calories_kcal) values (auth.uid(), 'x', 1, 'g', 'NaN') $$, '23514', null, 'NaN calories rejected');
select throws_ok($$ insert into public.foods (owner_id, name, serving_size, serving_unit) values (auth.uid(), 'x', 0, 'g') $$, '23514', null, 'Zero serving size rejected');
select lives_ok($$ insert into public.foods (owner_id, name, serving_size, serving_unit, calories_kcal) values (auth.uid(), 'Mystery bar', 1, 'bar', null) $$, 'Unknown nutrients stored as NULL');
select is((select calories_kcal from public.foods where name = 'Mystery bar'), null, 'Unknown calories remain NULL, not zero');
select throws_ok($$ insert into public.nutrition_targets (effective_from, calories_kcal) values ('2026-10-01', 0) $$, '23514', null, 'Zero calorie target rejected');
select throws_ok($$ insert into public.nutrition_targets (effective_from, protein_g) values ('2026-10-01', -5) $$, '23514', null, 'Negative macro target rejected');

-- Routines: optional targets, consistent rep ranges
insert into public.routines (id, name) values ('10000000-0000-0000-0000-0000000000c1', 'C Routine');
insert into public.exercises (id, owner_id, name) values ('e0000000-0000-0000-0000-0000000000c1', auth.uid(), 'C Row');
select throws_ok($$ insert into public.routine_exercises (routine_id, exercise_id, position, target_reps_min, target_reps_max) values ('10000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 0, 12, 8) $$, '23514', null, 'Inverted rep range rejected');
select throws_ok($$ insert into public.routine_exercises (routine_id, exercise_id, position, target_sets) values ('10000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 0, 0) $$, '23514', null, 'Zero target sets rejected (blank must be NULL)');
select lives_ok($$ insert into public.routine_exercises (routine_id, exercise_id, position) values ('10000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 0) $$, 'Targets are optional');
select is((select target_sets from public.routine_exercises where routine_id = '10000000-0000-0000-0000-0000000000c1'), null, 'Blank target stays NULL');

-- Workouts: one active session, valid timestamps, idempotent set writes
insert into public.workout_sessions (id, started_at) values ('20000000-0000-0000-0000-0000000000c1', '2026-10-01 10:00Z');
select throws_ok($$ insert into public.workout_sessions (id) values ('20000000-0000-0000-0000-0000000000c2') $$, '23505', null, 'Only one in-progress workout per user');
select throws_ok($$ update public.workout_sessions set status = 'completed', completed_at = '2026-10-01 09:00Z' where id = '20000000-0000-0000-0000-0000000000c1' $$, '23514', null, 'Completion before start rejected');
select throws_ok($$ update public.workout_sessions set status = 'completed' where id = '20000000-0000-0000-0000-0000000000c1' $$, '23514', null, 'Completed requires completed_at');
insert into public.session_exercises (id, session_id, exercise_name_snapshot, position) values ('21000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'C Row', 0);
select lives_ok($$ insert into public.workout_sets (id, session_exercise_id, position, reps, weight_kg) values ('22000000-0000-0000-0000-0000000000c1', '21000000-0000-0000-0000-0000000000c1', 0, 8, 60) on conflict (id) do update set reps = excluded.reps, weight_kg = excluded.weight_kg $$, 'Set upsert (first attempt)');
select lives_ok($$ insert into public.workout_sets (id, session_exercise_id, position, reps, weight_kg) values ('22000000-0000-0000-0000-0000000000c1', '21000000-0000-0000-0000-0000000000c1', 0, 8, 60) on conflict (id) do update set reps = excluded.reps, weight_kg = excluded.weight_kg $$, 'Set upsert (retry)');
select is((select count(*)::int from public.workout_sets where session_exercise_id = '21000000-0000-0000-0000-0000000000c1'), 1, 'Retry does not duplicate the set');
select is((select revision from public.workout_sets where id = '22000000-0000-0000-0000-0000000000c1'), 2, 'Revision bumps on update');
select throws_ok($$ insert into public.workout_sets (id, session_exercise_id, position, reps) values (gen_random_uuid(), '21000000-0000-0000-0000-0000000000c1', 1, -1) $$, '23514', null, 'Negative reps rejected');
select lives_ok($$ insert into public.workout_sets (id, session_exercise_id, position) values (gen_random_uuid(), '21000000-0000-0000-0000-0000000000c1', 1) $$, 'Blank reps/weight allowed');
select is((select count(*)::int from public.workout_sets where session_exercise_id = '21000000-0000-0000-0000-0000000000c1' and reps is null and weight_kg is null), 1, 'Blank set stays NULL, not zero');

-- Snapshots: editing or deleting the source exercise does not rewrite history
insert into public.session_exercises (id, session_id, exercise_id, exercise_name_snapshot, position) values ('21000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 'C Row', 1);
update public.exercises set name = 'C Row (renamed)' where id = 'e0000000-0000-0000-0000-0000000000c1';
select is((select exercise_name_snapshot from public.session_exercises where id = '21000000-0000-0000-0000-0000000000c2'), 'C Row', 'Renaming an exercise keeps the logged name');

-- Snapshots: editing a food does not rewrite the diary
insert into public.foods (id, owner_id, name, serving_size, serving_unit, calories_kcal) values ('f0000000-0000-0000-0000-0000000000c1', auth.uid(), 'C Yogurt', 150, 'g', 100);
insert into public.nutrition_days (id, day) values ('50000000-0000-0000-0000-0000000000c1', '2026-10-01');
insert into public.diary_entries (id, nutrition_day_id, meal, food_id, food_name, serving_size, serving_unit, calories_kcal, quantity) values ('51000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-0000000000c1', 'breakfast', 'f0000000-0000-0000-0000-0000000000c1', 'C Yogurt', 150, 'g', 100, 1);
update public.foods set calories_kcal = 999, name = 'C Yogurt v2' where id = 'f0000000-0000-0000-0000-0000000000c1';
select is((select calories_kcal from public.diary_entries where id = '51000000-0000-0000-0000-0000000000c1'), 100::numeric, 'Editing a food keeps logged calories');
select throws_ok($$ insert into public.diary_entries (id, nutrition_day_id, meal, food_name, serving_size, serving_unit, quantity) values (gen_random_uuid(), '50000000-0000-0000-0000-0000000000c1', 'brunch', 'x', 1, 'g', 1) $$, '22P02', null, 'Invalid meal category rejected');
select throws_ok($$ insert into public.diary_entries (id, nutrition_day_id, meal, food_name, serving_size, serving_unit, quantity) values (gen_random_uuid(), '50000000-0000-0000-0000-0000000000c1', 'lunch', 'x', 1, 'g', 0) $$, '23514', null, 'Zero quantity rejected');

select * from finish();
rollback;
