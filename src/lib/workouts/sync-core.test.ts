import { describe, expect, it } from "vitest";
import {
  addExercise,
  addSet,
  applyResults,
  buildOps,
  createWorkout,
  discardWorkout,
  finishWorkout,
  hasPending,
  moveExercise,
  rebaseOnServer,
  removeExercise,
  removeSet,
  restoreExercise,
  restoreSet,
  setsFor,
  sortedExercises,
  updateSet,
  type ActiveWorkout,
  type SyncResult,
} from "./sync-core";

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

const bench = { id: "ex-bench", name: "Bench Press", load_type: "external" as const, target_sets: 3, target_reps_min: 8, target_reps_max: 12 };
const pullup = { id: "ex-pullup", name: "Pull-Up", load_type: "bodyweight" as const };

/** Pretend the server accepted everything that was sent. */
function syncAll(state: ActiveWorkout): ActiveWorkout {
  const { ops, sent } = buildOps(state);
  const results: SyncResult[] = ops.map((o) => ({
    kind: o.kind,
    id: o.id,
    status: o.op === "delete" ? "applied" : "applied",
    revision: o.op === "upsert" ? (o.base_revision ?? 0) + 1 : undefined,
  }));
  return applyResults(state, sent, results);
}

function start(routine = true) {
  return createWorkout({
    userId: "u1",
    newId: ids(),
    startedAt: "2026-10-28T10:00:00.000Z",
    name: null,
    routine: routine ? { id: "r1", name: "Push A", exercises: [bench, pullup] } : undefined,
  });
}

describe("createWorkout", () => {
  it("snapshots the routine and pre-creates blank target sets", () => {
    const s = start();
    expect(s.session).toMatchObject({ routine_id: "r1", routine_name_snapshot: "Push A", name: "Push A", status: "in_progress", revision: null });
    const [b, p] = sortedExercises(s);
    expect(b).toMatchObject({ exercise_name_snapshot: "Bench Press", target_sets: 3, target_reps_min: 8, target_reps_max: 12, position: 0 });
    expect(p).toMatchObject({ exercise_name_snapshot: "Pull-Up", target_sets: null, position: 1 });
    expect(setsFor(s, b.id)).toHaveLength(3);
    expect(setsFor(s, p.id)).toHaveLength(1);
    expect(s.sets.every((x) => x.reps === null && x.weight_kg === null)).toBe(true);
  });

  it("creates a blank workout with nothing but the session", () => {
    const s = start(false);
    expect(s.exercises).toEqual([]);
    expect(Object.keys(s.pending)).toEqual([s.session.id]);
  });
});

describe("buildOps", () => {
  it("orders upserts parent-first and deletes child-first", () => {
    let s = syncAll(start());
    const benchEx = sortedExercises(s)[0];
    s = removeSet(s, setsFor(s, benchEx.id)[0].id).state;
    s = removeExercise(s, sortedExercises(s)[1].id).state;
    let n = 0;
    s = addExercise(s, pullup, () => `new-${++n}`);
    const { ops } = buildOps(s);
    expect(ops.map((o) => `${o.op}:${o.kind}`)).toEqual(["upsert:exercise", "upsert:set", "delete:set", "delete:exercise"]);
  });

  it("coalesces repeated edits of a row into one write with the latest values", () => {
    let s = syncAll(start());
    const setId = s.sets[0].id;
    s = updateSet(s, setId, { weight_kg: 60 });
    s = updateSet(s, setId, { reps: 8 });
    s = updateSet(s, setId, { reps: 9 });
    const { ops } = buildOps(s);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "set", id: setId, base_revision: 1, data: { reps: 9, weight_kg: 60, completed: true } });
    expect(ops[0].data).not.toHaveProperty("revision");
  });

  it("sends base_revision null for rows the server has never confirmed", () => {
    const { ops } = buildOps(start());
    expect(ops.every((o) => o.base_revision === null)).toBe(true);
  });
});

describe("applyResults", () => {
  it("clears pending and records revisions on success", () => {
    const s = syncAll(start());
    expect(hasPending(s)).toBe(false);
    expect(s.session.revision).toBe(1);
    expect(s.sets.every((x) => x.revision === 1)).toBe(true);
  });

  it("keeps rows that were edited again while the request was in flight", () => {
    let s = syncAll(start());
    const setId = s.sets[0].id;
    s = updateSet(s, setId, { reps: 5 });
    const { sent } = buildOps(s);
    s = updateSet(s, setId, { reps: 6 }); // typed while the request was in flight
    s = applyResults(s, sent, [{ kind: "set", id: setId, status: "applied", revision: 2 }]);
    expect(s.pending[setId]).toBeDefined();
    expect(s.sets.find((x) => x.id === setId)?.revision).toBe(2);
    expect(buildOps(s).ops[0]).toMatchObject({ base_revision: 2, data: { reps: 6 } });
  });

  it("is safe when the same response is applied twice (retry)", () => {
    const s0 = start();
    const { ops, sent } = buildOps(s0);
    const results: SyncResult[] = ops.map((o) => ({ kind: o.kind, id: o.id, status: "applied", revision: 1 }));
    const once = applyResults(s0, sent, results);
    expect(applyResults(once, sent, results)).toEqual(once);
  });

  it("surfaces conflicts and leaves the row pending (not overwritten)", () => {
    let s = syncAll(start());
    const setId = s.sets[0].id;
    s = updateSet(s, setId, { reps: 3 });
    const { sent } = buildOps(s);
    s = applyResults(s, sent, [{ kind: "set", id: setId, status: "conflict", reason: "modified", revision: 4 }]);
    expect(s.conflicts).toEqual([{ kind: "set", id: setId, reason: "modified", revision: 4 }]);
    expect(s.pending[setId]).toBeDefined();
    expect(s.sets.find((x) => x.id === setId)?.reps).toBe(3);
  });
});

describe("editing", () => {
  it("adds a set carrying over the previous weight, reps blank", () => {
    let s = syncAll(start());
    const ex = sortedExercises(s)[0];
    const last = setsFor(s, ex.id).at(-1)!;
    s = updateSet(s, last.id, { weight_kg: 62.5, reps: 8 });
    s = addSet(s, ex.id, () => "set-new");
    const added = s.sets.find((x) => x.id === "set-new")!;
    expect(added).toMatchObject({ weight_kg: 62.5, reps: null, position: 3, revision: null });
  });

  it("marks a set completed only when reps are entered", () => {
    let s = start();
    const id = s.sets[0].id;
    s = updateSet(s, id, { weight_kg: 50 });
    expect(s.sets[0].completed).toBe(false);
    s = updateSet(s, id, { reps: 5 });
    expect(s.sets.find((x) => x.id === id)?.completed).toBe(true);
    s = updateSet(s, id, { reps: null });
    expect(s.sets.find((x) => x.id === id)?.completed).toBe(false);
  });

  it("reorders exercises by swapping positions", () => {
    let s = syncAll(start());
    const [a, b] = sortedExercises(s);
    s = moveExercise(s, b.id, -1);
    expect(sortedExercises(s).map((e) => e.id)).toEqual([b.id, a.id]);
    expect(moveExercise(s, b.id, -1)).toBe(s); // already first
  });
});

describe("undo", () => {
  it("restores a removed set with the same id", () => {
    let s = syncAll(start());
    const target = s.sets[0];
    const { state, removed } = removeSet(s, target.id);
    expect(state.pending[target.id]).toMatchObject({ op: "delete", baseRevision: 1 });
    s = restoreSet(state, removed!);
    expect(s.sets.find((x) => x.id === target.id)).toMatchObject({ id: target.id, revision: null });
    expect(s.pending[target.id]).toMatchObject({ op: "upsert" });
  });

  it("removes an exercise with its sets and drops their pending writes", () => {
    let s = start(); // nothing confirmed yet: sets are pending
    const ex = sortedExercises(s)[0];
    const { state, removed } = removeExercise(s, ex.id);
    expect(state.sets.some((x) => x.session_exercise_id === ex.id)).toBe(false);
    expect(removed!.sets).toHaveLength(3);
    expect(removed!.sets.every((x) => state.pending[x.id] === undefined)).toBe(true);
    s = restoreExercise(state, removed!);
    expect(setsFor(s, ex.id)).toHaveLength(3);
    expect(s.pending[ex.id]).toMatchObject({ op: "upsert" });
  });
});

describe("finish and discard", () => {
  it("finishes with completed_at not before started_at", () => {
    const s = finishWorkout(start(), new Date("2026-10-28T09:00:00Z")); // device clock behind
    expect(s.session.status).toBe("completed");
    expect(s.session.completed_at).toBe("2026-10-28T10:00:00.000Z");
  });

  it("discard sends only the session delete", () => {
    const s = discardWorkout(syncAll(start()));
    expect(buildOps(s).ops).toEqual([{ kind: "session", op: "delete", id: s.session.id, base_revision: 1 }]);
    expect(s.discarded).toBe(true);
  });
});

describe("rebaseOnServer (keep this device's version)", () => {
  it("adopts server revisions, re-creates rows the server lost, and marks everything for upload", () => {
    let s = syncAll(start());
    const setId = s.sets[0].id;
    s = updateSet(s, setId, { reps: 7 });
    s = { ...s, conflicts: [{ kind: "set", id: setId, reason: "modified", revision: 5 }] };
    const revs: Record<string, number> = { [s.session.id]: 3, [setId]: 5 };
    const r = rebaseOnServer(s, revs);
    expect(r.conflicts).toEqual([]);
    expect(r.session.revision).toBe(3);
    expect(r.sets.find((x) => x.id === setId)?.revision).toBe(5);
    expect(r.exercises.every((e) => e.revision === null)).toBe(true);
    const { ops } = buildOps(r);
    expect(ops.find((o) => o.id === setId)).toMatchObject({ base_revision: 5, data: { reps: 7 } });
    expect(ops.length).toBe(1 + r.exercises.length + r.sets.length);
  });
});
