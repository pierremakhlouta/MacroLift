-- Save a routine and its ordered exercises in one transaction, so an interrupted save can
-- never leave a half-written routine. SECURITY INVOKER: every statement runs under the
-- caller's RLS policies, so a caller cannot touch another user's routine, items, or
-- private exercises even by guessing their IDs. Idempotent: retrying the same payload
-- produces the same result.
--
-- p_items: [{ "id": uuid, "exercise_id": uuid, "target_sets": int|null,
--             "target_reps_min": int|null, "target_reps_max": int|null, "notes": text|null }]
-- Array order defines position. Items missing from the array are removed.

create function public.save_routine(p_id uuid, p_name text, p_notes text, p_items jsonb)
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
    raise exception 'a routine can have at most 100 exercises' using errcode = '22023';
  end if;

  insert into public.routines (id, user_id, name, notes)
  values (p_id, uid, btrim(p_name), nullif(btrim(p_notes), ''))
  on conflict (id) do update set name = excluded.name, notes = excluded.notes;

  delete from public.routine_exercises re
  where re.routine_id = p_id
    and re.id not in (select (item->>'id')::uuid from jsonb_array_elements(p_items) item);

  insert into public.routine_exercises
    (id, routine_id, user_id, exercise_id, position, target_sets, target_reps_min, target_reps_max, notes)
  select
    (item->>'id')::uuid,
    p_id,
    uid,
    (item->>'exercise_id')::uuid,
    (ord - 1)::int,
    (item->>'target_sets')::int,
    (item->>'target_reps_min')::int,
    (item->>'target_reps_max')::int,
    nullif(btrim(item->>'notes'), '')
  from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  on conflict (id) do update set
    routine_id = excluded.routine_id,
    exercise_id = excluded.exercise_id,
    position = excluded.position,
    target_sets = excluded.target_sets,
    target_reps_min = excluded.target_reps_min,
    target_reps_max = excluded.target_reps_max,
    notes = excluded.notes;

  return p_id;
end;
$$;

revoke all on function public.save_routine(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_routine(uuid, text, text, jsonb) to authenticated;
