-- Phase 3: workout logging with basic interrupted-connection recovery.
--
-- 1. session_exercises keep a snapshot of the routine targets they were started from, so
--    editing the routine later never changes what a past workout showed.
-- 2. sync_workout() applies a batch of client edits (upserts/deletes of sessions, session
--    exercises and sets) keyed by stable client-generated ids. It is:
--      * idempotent: re-sending a batch after a lost response changes nothing further;
--      * conflict-aware: each edit carries the revision the client last saw; if the server
--        row has moved on (edited/finished/deleted on another device) the edit is NOT
--        applied and the current server row is returned so the client can ask the user;
--      * SECURITY INVOKER: every statement runs under the caller's RLS policies.

alter table public.session_exercises
  add column target_sets integer check (target_sets between 1 and 50),
  add column target_reps_min integer check (target_reps_min between 1 and 1000),
  add column target_reps_max integer check (target_reps_max between 1 and 1000),
  add constraint session_exercises_target_range_check
    check (target_reps_min is null or target_reps_max is null or target_reps_min <= target_reps_max);

create function public.sync_workout(p_ops jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  op jsonb;
  kind text;
  action text;
  rid uuid;
  base integer;
  cur integer;
  d jsonb;
  new_rev integer;
  parent_ok boolean;
  results jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_ops) is distinct from 'array' then
    raise exception 'p_ops must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ops) > 500 then
    raise exception 'too many operations in one batch' using errcode = '22023';
  end if;

  for op in select value from jsonb_array_elements(p_ops) loop
    kind := op->>'kind';
    action := op->>'op';
    rid := (op->>'id')::uuid;
    base := (op->>'base_revision')::integer;
    d := coalesce(op->'data', '{}'::jsonb);
    cur := null;
    new_rev := null;

    if kind not in ('session', 'exercise', 'set') or action not in ('upsert', 'delete') or rid is null then
      raise exception 'invalid operation: %', op using errcode = '22023';
    end if;

    -- Current server revision (NULL if the row does not exist or is not visible to the caller).
    if kind = 'session' then
      select s.revision into cur from public.workout_sessions s where s.id = rid;
    elsif kind = 'exercise' then
      select e.revision into cur from public.session_exercises e where e.id = rid;
    else
      select w.revision into cur from public.workout_sets w where w.id = rid;
    end if;

    -- ------------------------------------------------------------------ delete
    if action = 'delete' then
      if cur is null then
        results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'noop');
      elsif base is not null and base <> cur then
        results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'conflict', 'reason', 'modified', 'revision', cur);
      else
        if kind = 'session' then delete from public.workout_sessions where id = rid;
        elsif kind = 'exercise' then delete from public.session_exercises where id = rid;
        else delete from public.workout_sets where id = rid;
        end if;
        results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'applied');
      end if;
      continue;
    end if;

    -- ------------------------------------------------------------------ upsert
    if cur is null and base is not null then
      -- The client had seen this row, but it is gone: deleted elsewhere.
      results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'conflict', 'reason', 'deleted');
      continue;
    end if;
    if cur is not null and base is not null and base <> cur then
      results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'conflict', 'reason', 'modified', 'revision', cur);
      continue;
    end if;
    -- cur not null and base null: a retry of an insert whose response was lost. Apply it.

    if kind = 'session' then
      if cur is null then
        insert into public.workout_sessions (id, user_id, routine_id, routine_name_snapshot, name, status, started_at, completed_at, notes)
        select rid, uid, r.routine_id, r.routine_name_snapshot, r.name, coalesce(r.status, 'in_progress'), coalesce(r.started_at, now()), r.completed_at, r.notes
        from jsonb_populate_record(null::public.workout_sessions, d) r
        returning revision into new_rev;
      else
        update public.workout_sessions s
        set name = r.name, notes = r.notes, status = coalesce(r.status, s.status),
            started_at = coalesce(r.started_at, s.started_at), completed_at = r.completed_at
        from jsonb_populate_record(null::public.workout_sessions, d) r
        where s.id = rid
        returning s.revision into new_rev;
      end if;

    elsif kind = 'exercise' then
      select exists (select 1 from public.workout_sessions s where s.id = (d->>'session_id')::uuid) into parent_ok;
      if not parent_ok then
        results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'conflict', 'reason', 'parent_missing');
        continue;
      end if;
      if cur is null then
        insert into public.session_exercises
          (id, session_id, user_id, exercise_id, exercise_name_snapshot, load_type_snapshot, position, notes,
           target_sets, target_reps_min, target_reps_max)
        select rid, r.session_id, uid, r.exercise_id, r.exercise_name_snapshot, coalesce(r.load_type_snapshot, 'external'),
               r.position, r.notes, r.target_sets, r.target_reps_min, r.target_reps_max
        from jsonb_populate_record(null::public.session_exercises, d) r
        returning revision into new_rev;
      else
        update public.session_exercises e
        set position = r.position, notes = r.notes
        from jsonb_populate_record(null::public.session_exercises, d) r
        where e.id = rid
        returning e.revision into new_rev;
      end if;

    else
      select exists (select 1 from public.session_exercises e where e.id = (d->>'session_exercise_id')::uuid) into parent_ok;
      if not parent_ok then
        results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'conflict', 'reason', 'parent_missing');
        continue;
      end if;
      if cur is null then
        insert into public.workout_sets (id, session_exercise_id, user_id, position, reps, weight_kg, is_warmup, completed, notes)
        select rid, r.session_exercise_id, uid, r.position, r.reps, r.weight_kg, coalesce(r.is_warmup, false), coalesce(r.completed, false), r.notes
        from jsonb_populate_record(null::public.workout_sets, d) r
        returning revision into new_rev;
      else
        update public.workout_sets w
        set position = r.position, reps = r.reps, weight_kg = r.weight_kg,
            is_warmup = coalesce(r.is_warmup, false), completed = coalesce(r.completed, false), notes = r.notes
        from jsonb_populate_record(null::public.workout_sets, d) r
        where w.id = rid
        returning w.revision into new_rev;
      end if;
    end if;

    results := results || jsonb_build_object('kind', kind, 'id', rid, 'status', 'applied', 'revision', new_rev);
  end loop;

  return results;
end;
$$;

revoke all on function public.sync_workout(jsonb) from public, anon;
grant execute on function public.sync_workout(jsonb) to authenticated;
