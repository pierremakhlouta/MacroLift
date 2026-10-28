// Workout logging through the real API, driven by the same pure sync logic the browser uses.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addSet,
  applyResults,
  buildOps,
  createWorkout,
  finishWorkout,
  setsFor,
  sortedExercises,
  updateSet,
  type ActiveWorkout,
  type SyncResult,
} from "@/lib/workouts/sync-core";
import { API_URL, PUBLISHABLE_KEY, anonClient, createSignedInUser, deleteUser, type Db, type TestUser } from "./env";

let user: TestUser;
let other: TestUser;

beforeAll(async () => {
  [user, other] = await Promise.all([createSignedInUser("w-user"), createSignedInUser("w-other")]);
});
afterAll(async () => {
  await Promise.all([user, other].filter(Boolean).map((u) => deleteUser(u.id)));
});

async function sync(db: Db, state: ActiveWorkout): Promise<ActiveWorkout> {
  const { ops, sent } = buildOps(state);
  const { data, error } = await db.rpc("sync_workout", { p_ops: ops as never });
  if (error) throw new Error(`${error.code}: ${error.message}`);
  return applyResults(state, sent, data as unknown as SyncResult[]);
}

/** Second "device" for the same account: a separate client with its own session. */
async function secondDevice(u: TestUser): Promise<Db> {
  const db = anonClient();
  const { error } = await db.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw error;
  return db;
}

describe("workout logging", () => {
  let customExerciseId: string;
  let routineId: string;
  let sessionId: string;

  it("starts from a routine, logs sets, and finishes", async () => {
    const ex = await user.db.from("exercises").insert({ owner_id: user.id, name: "Cable Y Raise", muscles: ["shoulders"] }).select().single();
    customExerciseId = ex.data!.id;
    routineId = randomUUID();
    await user.db.rpc("save_routine", {
      p_id: routineId,
      p_name: "Shoulders",
      p_notes: "",
      p_items: [{ id: randomUUID(), exercise_id: customExerciseId, target_sets: 2, target_reps_min: 10, target_reps_max: 15, notes: null }],
    });

    let w = createWorkout({
      userId: user.id,
      newId: randomUUID,
      startedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
      name: null,
      routine: { id: routineId, name: "Shoulders", exercises: [{ id: customExerciseId, name: "Cable Y Raise", load_type: "external", target_sets: 2, target_reps_min: 10, target_reps_max: 15 }] },
    });
    sessionId = w.session.id;
    w = await sync(user.db, w);
    expect(Object.keys(w.pending)).toEqual([]);

    const ex1 = sortedExercises(w)[0];
    const [s1, s2] = setsFor(w, ex1.id);
    w = updateSet(w, s1.id, { weight_kg: 10, reps: 12 });
    w = updateSet(w, s2.id, { weight_kg: 10, reps: 11 });
    w = await sync(user.db, finishWorkout(w, new Date()));
    expect(Object.keys(w.pending)).toEqual([]);

    const { data } = await user.db
      .from("workout_sessions")
      .select("status, routine_id, routine_name_snapshot, exercises:session_exercises(exercise_name_snapshot, target_sets, sets:workout_sets(reps, weight_kg))")
      .eq("id", sessionId)
      .single();
    expect(data).toMatchObject({ status: "completed", routine_id: routineId, routine_name_snapshot: "Shoulders" });
    expect(data!.exercises[0]).toMatchObject({ exercise_name_snapshot: "Cable Y Raise", target_sets: 2 });
    expect(data!.exercises[0].sets.map((s) => s.reps).sort()).toEqual([11, 12]);
  });

  it("keeps history unchanged when the routine and exercise are edited, archived, and deleted", async () => {
    await user.db.rpc("save_routine", { p_id: routineId, p_name: "Shoulders v2", p_notes: "", p_items: [] });
    await user.db.from("exercises").update({ name: "Renamed Raise", load_type: "bodyweight" }).eq("id", customExerciseId);
    await user.db.from("exercises").update({ archived_at: new Date().toISOString() }).eq("id", customExerciseId);
    await user.db.from("routines").delete().eq("id", routineId);
    const del = await user.db.from("exercises").delete().eq("id", customExerciseId);
    expect(del.error).toBeNull();

    const { data } = await user.db
      .from("workout_sessions")
      .select("routine_id, routine_name_snapshot, exercises:session_exercises(exercise_id, exercise_name_snapshot, load_type_snapshot, target_sets, target_reps_min, target_reps_max)")
      .eq("id", sessionId)
      .single();
    expect(data).toMatchObject({ routine_id: null, routine_name_snapshot: "Shoulders" });
    expect(data!.exercises[0]).toEqual({
      exercise_id: null,
      exercise_name_snapshot: "Cable Y Raise",
      load_type_snapshot: "external",
      target_sets: 2,
      target_reps_min: 10,
      target_reps_max: 15,
    });
  });

  it("does not duplicate sets when a batch is retried after a lost response", async () => {
    let w = createWorkout({ userId: user.id, newId: randomUUID, startedAt: new Date().toISOString(), name: "Retry test" });
    w = await sync(user.db, w);
    const exRes = await user.db.from("exercises").select("id").eq("name", "Barbell Row").single();
    w = { ...w };
    const { addExercise } = await import("@/lib/workouts/sync-core");
    w = addExercise(w, { id: exRes.data!.id, name: "Barbell Row", load_type: "external" }, randomUUID);
    w = addSet(w, sortedExercises(w)[0].id, randomUUID);

    const { ops } = buildOps(w);
    // Send the same batch twice, as if the first response never arrived.
    for (let i = 0; i < 2; i++) {
      const { error } = await user.db.rpc("sync_workout", { p_ops: ops as never });
      expect(error).toBeNull();
    }
    const { count } = await user.db
      .from("workout_sets")
      .select("id", { count: "exact", head: true })
      .eq("session_exercise_id", sortedExercises(w)[0].id);
    expect(count).toBe(2);

    // Clean up so later tests can start a new workout.
    await user.db.from("workout_sessions").delete().eq("id", w.session.id);
  });

  it("surfaces a conflict when two devices edit the same set", async () => {
    const deviceB = await secondDevice(user);
    const ex = await user.db.from("exercises").select("id").eq("name", "Barbell Bench Press").single();
    let a = createWorkout({
      userId: user.id,
      newId: randomUUID,
      startedAt: new Date().toISOString(),
      name: "Two devices",
      routine: { id: randomUUID(), name: "Ad hoc", exercises: [{ id: ex.data!.id, name: "Barbell Bench Press", load_type: "external" }] },
    });
    a = { ...a, session: { ...a.session, routine_id: null } };
    a = await sync(user.db, a);
    const setId = a.sets[0].id;

    // Device B resumes the same workout (same revisions) and edits the set first.
    let b: ActiveWorkout = JSON.parse(JSON.stringify(a));
    b = updateSet(b, setId, { weight_kg: 100, reps: 5 });
    b = await sync(deviceB, b);
    expect(b.conflicts).toEqual([]);

    // Device A, unaware, edits the same set: conflict, and B's data is not overwritten.
    a = updateSet(a, setId, { weight_kg: 40, reps: 10 });
    a = await sync(user.db, a);
    expect(a.conflicts).toEqual([{ kind: "set", id: setId, reason: "modified", revision: 2 }]);
    const { data } = await user.db.from("workout_sets").select("weight_kg, reps").eq("id", setId).single();
    expect(data).toEqual({ weight_kg: 100, reps: 5 });

    // Device B finishes; A's later session edit is a conflict too (not a silent reopen).
    b = await sync(deviceB, finishWorkout(b, new Date()));
    a = { ...a, conflicts: [], pending: {} };
    const { updateSession } = await import("@/lib/workouts/sync-core");
    a = await sync(user.db, updateSession(a, { name: "Renamed on A" }));
    expect(a.conflicts[0]).toMatchObject({ kind: "session", reason: "modified" });
    const s = await user.db.from("workout_sessions").select("status, name").eq("id", a.session.id).single();
    expect(s.data).toEqual({ status: "completed", name: "Two devices" });
  });

  it("is isolated from other accounts", async () => {
    const { data } = await other.db.from("workout_sessions").select("id");
    expect(data).toEqual([]);
    const { data: sets } = await other.db.from("workout_sets").select("id");
    expect(sets).toEqual([]);
  });

  it("rejects sync calls with an invalid or expired token", async () => {
    const bogus = createClient(API_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid" } },
    });
    const { error } = await bogus.rpc("sync_workout", { p_ops: [] as never });
    expect(error).not.toBeNull();
  });
});
