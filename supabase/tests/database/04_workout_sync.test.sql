-- Phase 3: sync_workout() idempotency, conflicts, isolation, validation.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wa@test.local'),
  ('bbbbbbbb-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wb@test.local');

create temp table fx as select (select id from public.exercises where owner_id is null and name = 'Barbell Bench Press') as bench;
grant select on fx to authenticated;

create function pg_temp.ops(text) returns jsonb language sql as $$ select $1::jsonb $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a4","role":"authenticated"}', true);

-- A brand-new workout: session + exercise (with snapshot + targets) + two sets, in one batch.
create temp table batch1 as select jsonb_build_array(
  jsonb_build_object('kind','session','op','upsert','id','20000000-0000-0000-0000-0000000000a4','base_revision',null,
    'data', jsonb_build_object('name','Push','started_at','2026-10-28T10:00:00Z','routine_name_snapshot','Push A')),
  jsonb_build_object('kind','exercise','op','upsert','id','21000000-0000-0000-0000-0000000000a4','base_revision',null,
    'data', jsonb_build_object('session_id','20000000-0000-0000-0000-0000000000a4','exercise_id',(select bench from fx),
      'exercise_name_snapshot','Barbell Bench Press','load_type_snapshot','external','position',0,'target_sets',3,'target_reps_min',8,'target_reps_max',12)),
  jsonb_build_object('kind','set','op','upsert','id','22000000-0000-0000-0000-0000000000a1','base_revision',null,
    'data', jsonb_build_object('session_exercise_id','21000000-0000-0000-0000-0000000000a4','position',0,'reps',8,'weight_kg',60.5)),
  jsonb_build_object('kind','set','op','upsert','id','22000000-0000-0000-0000-0000000000a2','base_revision',null,
    'data', jsonb_build_object('session_exercise_id','21000000-0000-0000-0000-0000000000a4','position',1,'reps',null,'weight_kg',null))
) as ops;
grant select on batch1 to authenticated;

select is((select jsonb_agg(r->>'status') from jsonb_array_elements(public.sync_workout((select ops from batch1))) r),
  '["applied","applied","applied","applied"]'::jsonb, 'new workout batch applies');
select results_eq($$ select reps, weight_kg from public.workout_sets where session_exercise_id = '21000000-0000-0000-0000-0000000000a4' order by position $$,
  $$ values (8, 60.5::numeric), (null::int, null::numeric) $$, 'sets saved; blank set stays null');
select is((select target_sets from public.session_exercises where id = '21000000-0000-0000-0000-0000000000a4'), 3, 'target snapshot saved');

-- Retry after a lost response (same batch, base revisions still null): no duplicates, no error.
select lives_ok($$ select public.sync_workout((select ops from batch1)) $$, 'retrying the same batch succeeds');
select is((select count(*)::int from public.workout_sets where session_exercise_id = '21000000-0000-0000-0000-0000000000a4'), 2, 'retry does not duplicate sets');

-- Normal edit with the correct base revision.
select is((select revision from public.workout_sets where id = '22000000-0000-0000-0000-0000000000a1'), 2, 'retry counted as an update (revision 2)');
select is(
  public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000a1","base_revision":2,"data":{"session_exercise_id":"21000000-0000-0000-0000-0000000000a4","position":0,"reps":9,"weight_kg":60.5}}]'))->0->>'status',
  'applied', 'edit with matching revision applies');

-- Stale edit (another device already moved it to revision 3): conflict, not applied.
select is(
  public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000a1","base_revision":2,"data":{"session_exercise_id":"21000000-0000-0000-0000-0000000000a4","position":0,"reps":1,"weight_kg":1}}]')),
  '[{"id": "22000000-0000-0000-0000-0000000000a1", "kind": "set", "reason": "modified", "status": "conflict", "revision": 3}]'::jsonb,
  'stale edit is reported as a conflict with the server revision');
select is((select reps from public.workout_sets where id = '22000000-0000-0000-0000-0000000000a1'), 9, 'conflicting edit did not overwrite newer data');

-- Delete: stale base conflicts; correct base applies; repeat is a no-op.
select is(public.sync_workout(pg_temp.ops('[{"kind":"set","op":"delete","id":"22000000-0000-0000-0000-0000000000a2","base_revision":99}]'))->0->>'status', 'conflict', 'stale delete conflicts');
select is(public.sync_workout(pg_temp.ops('[{"kind":"set","op":"delete","id":"22000000-0000-0000-0000-0000000000a2","base_revision":2}]'))->0->>'status', 'applied', 'delete applies');
select is(public.sync_workout(pg_temp.ops('[{"kind":"set","op":"delete","id":"22000000-0000-0000-0000-0000000000a2","base_revision":2}]'))->0->>'status', 'noop', 'repeated delete is a no-op');

-- Editing a row that was deleted elsewhere is a conflict, not a silent re-create.
select is(public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000a2","base_revision":2,"data":{"session_exercise_id":"21000000-0000-0000-0000-0000000000a4","position":1,"reps":5}}]'))->0->>'reason',
  'deleted', 'edit of a row deleted elsewhere is a conflict');

-- Child of a missing parent is a conflict.
select is(public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000a9","base_revision":null,"data":{"session_exercise_id":"21000000-0000-0000-0000-000000000999","position":0}}]'))->0->>'reason',
  'parent_missing', 'set under a missing exercise is a conflict');

-- Validation still enforced by constraints (whole batch rolls back).
select throws_ok($$ select public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000b1","base_revision":null,"data":{"session_exercise_id":"21000000-0000-0000-0000-0000000000a4","position":5,"reps":-3}}]')) $$,
  '23514', null, 'negative reps rejected');
select throws_ok($$ select public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000b2","base_revision":null,"data":{"session_exercise_id":"21000000-0000-0000-0000-0000000000a4","position":5,"weight_kg":"NaN"}}]')) $$,
  '23514', null, 'NaN weight rejected');
select throws_ok($$ select public.sync_workout(pg_temp.ops('[{"kind":"lunch","op":"upsert","id":"22000000-0000-0000-0000-0000000000b3"}]')) $$, '22023', null, 'unknown kind rejected');
select throws_ok($$ select public.sync_workout('{}'::jsonb) $$, '22023', null, 'ops must be an array');

-- Only one active workout at a time.
select throws_ok($$ select public.sync_workout(pg_temp.ops('[{"kind":"session","op":"upsert","id":"20000000-0000-0000-0000-0000000000a5","base_revision":null,"data":{}}]')) $$,
  '23505', null, 'second in-progress workout rejected');

-- Finish the workout.
select is(public.sync_workout(jsonb_build_array(jsonb_build_object('kind','session','op','upsert','id','20000000-0000-0000-0000-0000000000a4',
  'base_revision',(select revision from public.workout_sessions where id = '20000000-0000-0000-0000-0000000000a4'),
  'data', jsonb_build_object('name','Push','status','completed','started_at','2026-10-28T10:00:00Z','completed_at','2026-10-28T11:05:00Z'))))->0->>'status',
  'applied', 'finishing applies');
select is((select status::text from public.workout_sessions where id = '20000000-0000-0000-0000-0000000000a4'), 'completed', 'workout completed');
select is((select routine_name_snapshot from public.workout_sessions where id = '20000000-0000-0000-0000-0000000000a4'), 'Push A', 'routine name snapshot kept on update');

-- ---------------------------------------------------------------- user B
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
select is(public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000a1","base_revision":null,"data":{"session_exercise_id":"21000000-0000-0000-0000-0000000000a4","position":0,"reps":0}}]'))->0->>'reason',
  'parent_missing', 'B cannot overwrite A set by id (A parent is invisible to B)');
select is(public.sync_workout(pg_temp.ops('[{"kind":"set","op":"upsert","id":"22000000-0000-0000-0000-0000000000c1","base_revision":null,"data":{"session_exercise_id":"21000000-0000-0000-0000-0000000000a4","position":9,"reps":1}}]'))->0->>'reason',
  'parent_missing', 'B cannot add a set to A exercise');
select is(public.sync_workout(pg_temp.ops('[{"kind":"session","op":"delete","id":"20000000-0000-0000-0000-0000000000a4","base_revision":null}]'))->0->>'status',
  'noop', 'B delete of A session is a no-op');

reset role;
select is((select reps from public.workout_sets where id = '22000000-0000-0000-0000-0000000000a1'), 9, 'A set untouched by B');
select isnt_empty($$ select 1 from public.workout_sessions where id = '20000000-0000-0000-0000-0000000000a4' $$, 'A session untouched by B');

set local role anon;
select throws_ok($$ select public.sync_workout('[]'::jsonb) $$, '42501', null, 'anon cannot sync');

select * from finish();
rollback;
