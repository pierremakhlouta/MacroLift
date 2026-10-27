// Cross-account isolation through the real Data API (PostgREST + JWT), complementing the
// pgTAP policy tests in supabase/tests/database.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createSignedInUser, deleteUser, type TestUser } from "./env";

let alice: TestUser;
let bob: TestUser;
const ids = {
  routine: randomUUID(),
  exercise: randomUUID(),
  session: randomUUID(),
  sessionExercise: randomUUID(),
  set: randomUUID(),
  food: randomUUID(),
  day: randomUUID(),
  entry: randomUUID(),
};

beforeAll(async () => {
  [alice, bob] = await Promise.all([createSignedInUser("alice"), createSignedInUser("bob")]);
  const a = alice.db;
  const steps = [
    await a.from("exercises").insert({ id: ids.exercise, owner_id: alice.id, name: "Alice Curl" }),
    await a.from("routines").insert({ id: ids.routine, name: "Alice Routine" }),
    await a.from("routine_exercises").insert({ routine_id: ids.routine, exercise_id: ids.exercise, position: 0 }),
    await a.from("workout_sessions").insert({ id: ids.session, routine_id: ids.routine }),
    await a.from("session_exercises").insert({ id: ids.sessionExercise, session_id: ids.session, exercise_id: ids.exercise, exercise_name_snapshot: "Alice Curl", position: 0 }),
    await a.from("workout_sets").insert({ id: ids.set, session_exercise_id: ids.sessionExercise, position: 0, reps: 10, weight_kg: 15 }),
    await a.from("weight_entries").insert({ measured_on: "2026-10-27", weight_kg: 61.2 }),
    await a.from("body_measurements").insert({ measured_on: "2026-10-27", site: "waist", value_cm: 70 }),
    await a.from("foods").insert({ id: ids.food, owner_id: alice.id, name: "Alice Bar", serving_size: 1, serving_unit: "bar", calories_kcal: 200 }),
    await a.from("nutrition_days").insert({ id: ids.day, day: "2026-10-27" }),
    await a.from("diary_entries").insert({ id: ids.entry, nutrition_day_id: ids.day, meal: "snack", food_id: ids.food, food_name: "Alice Bar", serving_size: 1, serving_unit: "bar", calories_kcal: 200, quantity: 1 }),
    await a.from("nutrition_targets").insert({ effective_from: "2026-10-01", calories_kcal: 2100 }),
  ];
  for (const step of steps) expect(step.error).toBeNull();
});

afterAll(async () => {
  await Promise.all([alice, bob].filter(Boolean).map((u) => deleteUser(u.id)));
});

const PERSONAL_TABLES = [
  "routines",
  "routine_exercises",
  "workout_sessions",
  "session_exercises",
  "workout_sets",
  "weight_entries",
  "body_measurements",
  "nutrition_days",
  "diary_entries",
  "nutrition_targets",
  "meal_templates",
  "meal_template_items",
] as const;

describe("Bob cannot access Alice's data through the API", () => {
  it.each(PERSONAL_TABLES)("reads nothing from %s", async (table) => {
    const { data, error } = await bob.db.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot read Alice's profile, custom exercises or foods", async () => {
    const profiles = await bob.db.from("profiles").select("id");
    expect(profiles.data).toEqual([{ id: bob.id }]);
    const exercises = await bob.db.from("exercises").select("id").eq("owner_id", alice.id);
    expect(exercises.data).toEqual([]);
    const foods = await bob.db.from("foods").select("id").eq("id", ids.food);
    expect(foods.data).toEqual([]);
  });

  it("cannot update or delete Alice's rows", async () => {
    const upd = await bob.db.from("workout_sets").update({ reps: 99 }).eq("id", ids.set).select();
    expect(upd.data).toEqual([]);
    const del = await bob.db.from("diary_entries").delete().eq("id", ids.entry).select();
    expect(del.data).toEqual([]);
    const prof = await bob.db.from("profiles").update({ display_name: "pwned" }).eq("id", alice.id).select();
    expect(prof.data).toEqual([]);

    const check = await alice.db.from("workout_sets").select("reps").eq("id", ids.set).single();
    expect(check.data?.reps).toBe(10);
    const entry = await alice.db.from("diary_entries").select("id").eq("id", ids.entry);
    expect(entry.data).toHaveLength(1);
  });

  it("cannot write rows as Alice or into Alice's parents", async () => {
    const asAlice = await bob.db.from("routines").insert({ user_id: alice.id, name: "x" });
    expect(asAlice.error?.code).toBe("42501");
    const intoSession = await bob.db.from("workout_sets").insert({ id: randomUUID(), session_exercise_id: ids.sessionExercise, position: 1, reps: 1 });
    expect(intoSession.error).not.toBeNull();
    const intoDay = await bob.db.from("diary_entries").insert({ id: randomUUID(), nutrition_day_id: ids.day, meal: "lunch", food_name: "x", serving_size: 1, serving_unit: "g", quantity: 1 });
    expect(intoDay.error).not.toBeNull();
  });

  it("cannot overwrite Alice's set by upserting its known id", async () => {
    const { error } = await bob.db
      .from("workout_sets")
      .upsert({ id: ids.set, session_exercise_id: ids.sessionExercise, position: 0, reps: 1 });
    expect(error).not.toBeNull();
    const check = await alice.db.from("workout_sets").select("reps").eq("id", ids.set).single();
    expect(check.data?.reps).toBe(10);
  });

  it("cannot call delete_my_account on Alice's behalf", async () => {
    // The function only ever deletes auth.uid(); Bob's call would delete Bob, so just check the
    // signature has no target argument.
    const { error } = await bob.db.rpc("delete_my_account", { user_id: alice.id } as never);
    expect(error).not.toBeNull();
  });
});

describe("unauthenticated access", () => {
  it("is denied for every personal table", async () => {
    const anon = anonClient();
    for (const table of [...PERSONAL_TABLES, "profiles", "exercises", "foods"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error, table).not.toBeNull();
      expect(data, table).toBeNull();
    }
  });
});
