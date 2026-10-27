-- Phase 2: starter library and atomic routine saves.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select cmp_ok((select count(*)::int from public.exercises where owner_id is null), '>=', 60, 'starter library is seeded');
select is_empty($$ select 1 from public.exercises where owner_id is null and cardinality(muscles) = 0 $$, 'every built-in exercise has muscles');
select is((select load_type::text from public.exercises where owner_id is null and name = 'Pull-Up'), 'bodyweight', 'pull-up is bodyweight');
select is((select load_type::text from public.exercises where owner_id is null and name = 'Assisted Pull-Up Machine'), 'assisted', 'assisted machine is assisted');

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ra@test.local'),
  ('bbbbbbbb-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rb@test.local');

-- Fixtures: A's private exercise, and ids of two built-ins.
insert into public.exercises (id, owner_id, name) values
  ('e0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-0000000000a3', 'A Private Lift');

create temp table ids as
select
  (select id from public.exercises where owner_id is null and name = 'Barbell Bench Press') as bench,
  (select id from public.exercises where owner_id is null and name = 'Barbell Row') as row_;
grant select on ids to authenticated;

-- ---------------------------------------------------------------- as A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a3","role":"authenticated"}', true);

select lives_ok(format($$ select public.save_routine('10000000-0000-0000-0000-0000000000a3', '  Push  ', '', %L::jsonb) $$,
  jsonb_build_array(
    jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a1', 'exercise_id', (select bench from ids), 'target_sets', 3, 'target_reps_min', 8, 'target_reps_max', 12),
    jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a2', 'exercise_id', 'e0000000-0000-0000-0000-0000000000a3', 'target_sets', null, 'target_reps_min', null, 'target_reps_max', null)
  )), 'A saves a routine with two exercises');

select is((select name from public.routines where id = '10000000-0000-0000-0000-0000000000a3'), 'Push', 'name is trimmed');
select is((select notes from public.routines where id = '10000000-0000-0000-0000-0000000000a3'), null, 'blank notes become null');
select results_eq($$ select position, target_sets, target_reps_min, target_reps_max from public.routine_exercises where routine_id = '10000000-0000-0000-0000-0000000000a3' order by position $$,
  $$ values (0, 3, 8, 12), (1, null::int, null::int, null::int) $$, 'targets saved; blank targets stay null');

-- Reorder, drop one, add one, retry the same payload: idempotent, no duplicates.
select lives_ok(format($$ select public.save_routine('10000000-0000-0000-0000-0000000000a3', 'Push', 'note', %L::jsonb) $$,
  jsonb_build_array(
    jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a3', 'exercise_id', (select row_ from ids)),
    jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a1', 'exercise_id', (select bench from ids), 'target_sets', 4)
  )), 'A edits the routine');
select lives_ok(format($$ select public.save_routine('10000000-0000-0000-0000-0000000000a3', 'Push', 'note', %L::jsonb) $$,
  jsonb_build_array(
    jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a3', 'exercise_id', (select row_ from ids)),
    jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a1', 'exercise_id', (select bench from ids), 'target_sets', 4)
  )), 'retrying the same save succeeds');
select results_eq($$ select id::text, position from public.routine_exercises where routine_id = '10000000-0000-0000-0000-0000000000a3' order by position $$,
  $$ values ('11000000-0000-0000-0000-0000000000a3', 0), ('11000000-0000-0000-0000-0000000000a1', 1) $$, 'reordered, removed item gone, no duplicates');

-- Invalid payload rolls back the whole save.
select throws_ok(format($$ select public.save_routine('10000000-0000-0000-0000-0000000000a3', 'Renamed', null, %L::jsonb) $$,
  jsonb_build_array(jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a1', 'exercise_id', (select bench from ids), 'target_reps_min', 12, 'target_reps_max', 8))),
  '23514', null, 'inverted rep range rejected');
select is((select name from public.routines where id = '10000000-0000-0000-0000-0000000000a3'), 'Push', 'failed save changed nothing');
select is((select count(*)::int from public.routine_exercises where routine_id = '10000000-0000-0000-0000-0000000000a3'), 2, 'failed save kept items');

select throws_ok($$ select public.save_routine(gen_random_uuid(), 'x', null, '{}'::jsonb) $$, '22023', null, 'items must be an array');

-- ---------------------------------------------------------------- as B
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b3","role":"authenticated"}', true);

select throws_ok($$ select public.save_routine('10000000-0000-0000-0000-0000000000a3', 'hijack', null, '[]'::jsonb) $$,
  '42501', null, 'B cannot overwrite A routine by id');
select throws_ok(format($$ select public.save_routine('10000000-0000-0000-0000-0000000000b3', 'B', null, %L::jsonb) $$,
  jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'exercise_id', 'e0000000-0000-0000-0000-0000000000a3'))),
  '42501', null, 'B cannot use A private exercise');
select throws_ok(format($$ select public.save_routine('10000000-0000-0000-0000-0000000000b4', 'B', null, %L::jsonb) $$,
  jsonb_build_array(jsonb_build_object('id', '11000000-0000-0000-0000-0000000000a1', 'exercise_id', (select bench from ids)))),
  '42501', null, 'B cannot steal A routine item by id');
select is_empty($$ select 1 from public.routines where id in ('10000000-0000-0000-0000-0000000000b3', '10000000-0000-0000-0000-0000000000b4') $$,
  'failed saves by B left nothing behind');

reset role;
select is((select name from public.routines where id = '10000000-0000-0000-0000-0000000000a3'), 'Push', 'A routine untouched by B');
select is((select count(*)::int from public.routine_exercises where routine_id = '10000000-0000-0000-0000-0000000000a3'), 2, 'A items untouched by B');

-- anon cannot call it
set local role anon;
select throws_ok($$ select public.save_routine(gen_random_uuid(), 'x', null, '[]'::jsonb) $$, '42501', null, 'anon cannot save routines');

select * from finish();
rollback;
