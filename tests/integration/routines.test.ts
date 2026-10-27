import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, type TestUser } from "./env";

let alice: TestUser;
let bob: TestUser;
let bench: string;
let row: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createSignedInUser("r-alice"), createSignedInUser("r-bob")]);
  const { data } = await alice.db.from("exercises").select("id, name").in("name", ["Barbell Bench Press", "Barbell Row"]);
  bench = data!.find((e) => e.name === "Barbell Bench Press")!.id;
  row = data!.find((e) => e.name === "Barbell Row")!.id;
});

afterAll(async () => {
  await Promise.all([alice, bob].filter(Boolean).map((u) => deleteUser(u.id)));
});

describe("exercise library", () => {
  it("shows built-ins plus only the caller's custom exercises", async () => {
    const created = await alice.db.from("exercises").insert({ owner_id: alice.id, name: "Alice Landmine Press", muscles: ["shoulders"] }).select().single();
    expect(created.error).toBeNull();

    const forAlice = await alice.db.from("exercises").select("id, owner_id");
    const forBob = await bob.db.from("exercises").select("id, owner_id");
    expect(forAlice.data!.length).toBe(forBob.data!.length + 1);
    expect(forBob.data!.every((e) => e.owner_id === null)).toBe(true);
  });

  it("rejects duplicate custom names (case-insensitive) but allows reuse after archiving", async () => {
    const first = await alice.db.from("exercises").insert({ owner_id: alice.id, name: "Zercher Squat", muscles: ["quads"] }).select().single();
    const dup = await alice.db.from("exercises").insert({ owner_id: alice.id, name: "zercher squat", muscles: ["quads"] });
    expect(dup.error?.code).toBe("23505");
    await alice.db.from("exercises").update({ archived_at: new Date().toISOString() }).eq("id", first.data!.id);
    const again = await alice.db.from("exercises").insert({ owner_id: alice.id, name: "Zercher Squat", muscles: ["quads"] });
    expect(again.error).toBeNull();
  });

  it("does not let users create built-ins or edit them", async () => {
    const asBuiltin = await alice.db.from("exercises").insert({ owner_id: null, name: "Fake Builtin" });
    expect(asBuiltin.error?.code).toBe("42501");
    const edit = await alice.db.from("exercises").update({ name: "Hacked" }).eq("id", bench).select();
    expect(edit.data).toEqual([]);
  });
});

describe("save_routine", () => {
  const routineId = randomUUID();
  const benchItem = randomUUID();
  const rowItem = randomUUID();
  // Built lazily: exercise ids are only known after beforeAll.
  const payload = () => ({
    p_id: routineId,
    p_name: "Push A",
    p_notes: "",
    p_items: [
      { id: benchItem, exercise_id: bench, target_sets: 3, target_reps_min: 8, target_reps_max: 12, notes: null },
      { id: rowItem, exercise_id: row, target_sets: null, target_reps_min: null, target_reps_max: null, notes: "slow" },
    ],
  });

  it("saves atomically and is idempotent on retry", async () => {
    for (let i = 0; i < 2; i++) {
      const { error } = await alice.db.rpc("save_routine", payload());
      expect(error).toBeNull();
    }
    const { data } = await alice.db
      .from("routine_exercises")
      .select("id, position, target_sets, target_reps_min, target_reps_max, notes")
      .eq("routine_id", routineId)
      .order("position");
    expect(data).toEqual([
      { id: benchItem, position: 0, target_sets: 3, target_reps_min: 8, target_reps_max: 12, notes: null },
      { id: rowItem, position: 1, target_sets: null, target_reps_min: null, target_reps_max: null, notes: "slow" },
    ]);
  });

  it("is invisible to other users and cannot be overwritten by them", async () => {
    const read = await bob.db.from("routines").select("id").eq("id", routineId);
    expect(read.data).toEqual([]);
    const hijack = await bob.db.rpc("save_routine", { ...payload(), p_name: "Bob's now", p_items: [] });
    expect(hijack.error).not.toBeNull();
    const check = await alice.db.from("routines").select("name").eq("id", routineId).single();
    expect(check.data?.name).toBe("Push A");
  });

  it("rolls back completely when any item is invalid", async () => {
    const bad = await alice.db.rpc("save_routine", {
      ...payload(),
      p_name: "Renamed",
      p_items: [{ ...payload().p_items[0], target_reps_min: 12, target_reps_max: 8 }],
    });
    expect(bad.error?.code).toBe("23514");
    const check = await alice.db.from("routines").select("name, items:routine_exercises(id)").eq("id", routineId).single();
    expect(check.data?.name).toBe("Push A");
    expect(check.data?.items).toHaveLength(2);
  });
});
