-- Cardio: built-in cardio exercises, time/distance on sets through sync_workout(), and limits.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ca@test.local');

select is((select load_type::text from public.exercises where owner_id is null and name = 'Treadmill'), 'cardio', 'built-in Treadmill is cardio');
select cmp_ok((select count(*)::int from public.exercises where owner_id is null and load_type = 'cardio'), '>=', 8, 'cardio exercises are seeded');

create temp table fx as select (select id from public.exercises where owner_id is null and name = 'Treadmill') as treadmill;
grant select on fx to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a6","role":"authenticated"}', true);

select is((select jsonb_agg(r->>'status') from jsonb_array_elements(public.sync_workout(jsonb_build_array(
  jsonb_build_object('kind','session','op','upsert','id','30000000-0000-0000-0000-0000000000a6','base_revision',null,
    'data', jsonb_build_object('name','Cardio','started_at','2026-10-29T10:00:00Z')),
  jsonb_build_object('kind','exercise','op','upsert','id','31000000-0000-0000-0000-0000000000a6','base_revision',null,
    'data', jsonb_build_object('session_id','30000000-0000-0000-0000-0000000000a6','exercise_id',(select treadmill from fx),
      'exercise_name_snapshot','Treadmill','load_type_snapshot','cardio','position',0)),
  jsonb_build_object('kind','set','op','upsert','id','32000000-0000-0000-0000-0000000000a1','base_revision',null,
    'data', jsonb_build_object('session_exercise_id','31000000-0000-0000-0000-0000000000a6','position',0,'duration_seconds',1530,'distance_m',5000,'completed',true)),
  jsonb_build_object('kind','set','op','upsert','id','32000000-0000-0000-0000-0000000000a2','base_revision',null,
    'data', jsonb_build_object('session_exercise_id','31000000-0000-0000-0000-0000000000a6','position',1))
))) r), '["applied","applied","applied","applied"]'::jsonb, 'cardio workout batch applies');

select is((select load_type_snapshot::text from public.session_exercises where id = '31000000-0000-0000-0000-0000000000a6'), 'cardio', 'cardio snapshot saved');
select results_eq($$ select duration_seconds, distance_m, reps, weight_kg from public.workout_sets where session_exercise_id = '31000000-0000-0000-0000-0000000000a6' order by position $$,
  $$ values (1530, 5000::numeric, null::int, null::numeric), (null::int, null::numeric, null::int, null::numeric) $$, 'time and distance saved; blank stays null');

-- Editing updates time and distance.
select is(public.sync_workout(jsonb_build_array(jsonb_build_object('kind','set','op','upsert','id','32000000-0000-0000-0000-0000000000a2','base_revision',1,
  'data', jsonb_build_object('session_exercise_id','31000000-0000-0000-0000-0000000000a6','position',1,'duration_seconds',600))))->0->>'status', 'applied', 'cardio set edit applies');
select is((select duration_seconds from public.workout_sets where id = '32000000-0000-0000-0000-0000000000a2'), 600, 'edited time saved');

-- Limits.
select throws_ok($$ select public.sync_workout(jsonb_build_array(jsonb_build_object('kind','set','op','upsert','id','32000000-0000-0000-0000-0000000000b1','base_revision',null,
  'data', jsonb_build_object('session_exercise_id','31000000-0000-0000-0000-0000000000a6','position',5,'duration_seconds',-1)))) $$, '23514', null, 'negative time rejected');
select throws_ok($$ select public.sync_workout(jsonb_build_array(jsonb_build_object('kind','set','op','upsert','id','32000000-0000-0000-0000-0000000000b2','base_revision',null,
  'data', jsonb_build_object('session_exercise_id','31000000-0000-0000-0000-0000000000a6','position',5,'duration_seconds',90000)))) $$, '23514', null, 'more than 24 h rejected');
select throws_ok($$ select public.sync_workout(jsonb_build_array(jsonb_build_object('kind','set','op','upsert','id','32000000-0000-0000-0000-0000000000b3','base_revision',null,
  'data', jsonb_build_object('session_exercise_id','31000000-0000-0000-0000-0000000000a6','position',5,'distance_m',-5)))) $$, '23514', null, 'negative distance rejected');

-- Built-in cardio exercises stay read-only.
update public.exercises set load_type = 'external' where name = 'Treadmill' and owner_id is null;
reset role;
select is((select load_type::text from public.exercises where owner_id is null and name = 'Treadmill'), 'cardio', 'users cannot change a built-in exercise');

select * from finish();
rollback;
