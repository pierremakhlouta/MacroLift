-- Row Level Security for every table exposed through the Data API.
--
--   * anon has no access to any table.
--   * authenticated users see built-in catalog rows (owner_id IS NULL) read-only, plus their own rows.
--   * Child-table policies check the child's user_id AND the parent's owner, and any referenced
--     catalog row must be visible to the caller (built-in or their own).
--   * auth.uid() is wrapped in a sub-select so Postgres evaluates it once per statement.

-- Defense in depth: strip default grants, then grant only what policies allow.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.nutrition_targets,
  public.exercises,
  public.routines,
  public.routine_exercises,
  public.workout_sessions,
  public.session_exercises,
  public.workout_sets,
  public.weight_entries,
  public.body_measurements,
  public.foods,
  public.meal_templates,
  public.meal_template_items,
  public.nutrition_days,
  public.diary_entries
to authenticated;

alter table public.profiles enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.weight_entries enable row level security;
alter table public.body_measurements enable row level security;
alter table public.foods enable row level security;
alter table public.meal_templates enable row level security;
alter table public.meal_template_items enable row level security;
alter table public.nutrition_days enable row level security;
alter table public.diary_entries enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: created by trigger, removed by account deletion. Users read/update their own.
-- ---------------------------------------------------------------------------

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Simple owner-scoped tables
-- ---------------------------------------------------------------------------

create policy nutrition_targets_all_own on public.nutrition_targets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy routines_all_own on public.routines for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy weight_entries_all_own on public.weight_entries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy body_measurements_all_own on public.body_measurements for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy meal_templates_all_own on public.meal_templates for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy nutrition_days_all_own on public.nutrition_days for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A session may only link to a routine the caller owns.
create policy workout_sessions_all_own on public.workout_sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      routine_id is null
      or exists (
        select 1 from public.routines r
        where r.id = routine_id and r.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Catalogs: built-in rows readable by any signed-in user; never writable by users.
-- ---------------------------------------------------------------------------

create policy exercises_select_visible on public.exercises for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy exercises_insert_own on public.exercises for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy exercises_update_own on public.exercises for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy exercises_delete_own on public.exercises for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy foods_select_visible on public.foods for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy foods_insert_own on public.foods for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy foods_update_own on public.foods for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy foods_delete_own on public.foods for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Child tables: child owner + parent owner (+ visible catalog reference)
-- ---------------------------------------------------------------------------

create policy routine_exercises_all_own on public.routine_exercises for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.routines r
      where r.id = routine_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.routines r
      where r.id = routine_id and r.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

create policy session_exercises_all_own on public.session_exercises for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
    and (
      exercise_id is null
      or exists (
        select 1 from public.exercises e
        where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))
      )
    )
  );

create policy workout_sets_all_own on public.workout_sets for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id
        and se.user_id = (select auth.uid())
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.session_exercises se
      join public.workout_sessions s on s.id = se.session_id
      where se.id = session_exercise_id
        and se.user_id = (select auth.uid())
        and s.user_id = (select auth.uid())
    )
  );

create policy meal_template_items_all_own on public.meal_template_items for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meal_templates t
      where t.id = template_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.meal_templates t
      where t.id = template_id and t.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.foods f
      where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid()))
    )
  );

create policy diary_entries_all_own on public.diary_entries for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.nutrition_days d
      where d.id = nutrition_day_id and d.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.nutrition_days d
      where d.id = nutrition_day_id and d.user_id = (select auth.uid())
    )
    and (
      food_id is null
      or exists (
        select 1 from public.foods f
        where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid()))
      )
    )
    and (
      meal_template_id is null
      or exists (
        select 1 from public.meal_templates t
        where t.id = meal_template_id and t.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Account deletion. Deleting the auth user cascades to every personal row (all user_id /
-- owner_id / profiles.id FKs are ON DELETE CASCADE). Built-in catalog rows are untouched.
-- ---------------------------------------------------------------------------

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
