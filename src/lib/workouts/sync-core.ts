// Pure state transitions for the active workout. No I/O here: the store persists the state to
// localStorage and the sync engine sends `buildOps()` to sync_workout() and feeds the response
// to `applyResults()`.
//
// Every row has a stable client-generated id. `revision` is the server revision this device last
// saw (null = never confirmed by the server). Edits mark the row in `pending`; only the latest
// state of each row is sent, so rapid edits coalesce into one write.

import type { LoadType } from "@/lib/exercises/catalog";

export type Kind = "session" | "exercise" | "set";

export type LocalSession = {
  id: string;
  routine_id: string | null;
  routine_name_snapshot: string | null;
  name: string | null;
  notes: string | null;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  revision: number | null;
};

export type LocalExercise = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  load_type_snapshot: LoadType;
  position: number;
  notes: string | null;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  revision: number | null;
};

export type LocalSet = {
  id: string;
  session_exercise_id: string;
  position: number;
  reps: number | null;
  weight_kg: number | null;
  is_warmup: boolean;
  completed: boolean;
  notes: string | null;
  revision: number | null;
};

export type Pending = { kind: Kind; op: "upsert" | "delete"; seq: number; baseRevision?: number | null };

export type ConflictItem = { kind: Kind; id: string; reason: "modified" | "deleted" | "parent_missing"; revision?: number };

export type ActiveWorkout = {
  version: 1;
  userId: string;
  session: LocalSession;
  exercises: LocalExercise[];
  sets: LocalSet[];
  pending: Record<string, Pending>;
  seq: number;
  conflicts: ConflictItem[];
  /** Set when the user discarded the workout; cleared from storage once the server confirms. */
  discarded?: boolean;
};

export type SyncOp = {
  kind: Kind;
  op: "upsert" | "delete";
  id: string;
  base_revision: number | null;
  data?: Record<string, unknown>;
};

export type SyncResult = {
  kind: Kind;
  id: string;
  status: "applied" | "noop" | "conflict";
  revision?: number;
  reason?: ConflictItem["reason"];
};

export type ExerciseMeta = {
  id: string | null;
  name: string;
  load_type: LoadType;
  target_sets?: number | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mark(state: ActiveWorkout, kind: Kind, id: string, op: Pending["op"], baseRevision?: number | null): ActiveWorkout {
  const seq = state.seq + 1;
  const entry: Pending = op === "delete" ? { kind, op, seq, baseRevision: baseRevision ?? null } : { kind, op, seq };
  return { ...state, seq, pending: { ...state.pending, [id]: entry } };
}

function unmark(state: ActiveWorkout, ids: string[]): ActiveWorkout {
  const pending = { ...state.pending };
  ids.forEach((id) => delete pending[id]);
  return { ...state, pending };
}

const nextPosition = (items: { position: number }[]) => (items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0);

export const sortedExercises = (s: ActiveWorkout) => [...s.exercises].sort((a, b) => a.position - b.position);
export const setsFor = (s: ActiveWorkout, exerciseId: string) =>
  s.sets.filter((x) => x.session_exercise_id === exerciseId).sort((a, b) => a.position - b.position);

export const hasPending = (s: ActiveWorkout) => Object.keys(s.pending).length > 0;

function blankSet(id: string, exerciseId: string, position: number, weightKg: number | null = null): LocalSet {
  return { id, session_exercise_id: exerciseId, position, reps: null, weight_kg: weightKg, is_warmup: false, completed: false, notes: null, revision: null };
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------

/** New workout, optionally from a routine. Routine targets are snapshotted; `target_sets` blank sets are pre-created. */
export function createWorkout(args: {
  userId: string;
  newId: () => string;
  startedAt: string;
  name: string | null;
  routine?: { id: string; name: string; exercises: ExerciseMeta[] };
}): ActiveWorkout {
  const sessionId = args.newId();
  let state: ActiveWorkout = {
    version: 1,
    userId: args.userId,
    session: {
      id: sessionId,
      routine_id: args.routine?.id ?? null,
      routine_name_snapshot: args.routine?.name ?? null,
      name: args.name ?? args.routine?.name ?? null,
      notes: null,
      status: "in_progress",
      started_at: args.startedAt,
      completed_at: null,
      revision: null,
    },
    exercises: [],
    sets: [],
    pending: {},
    seq: 0,
    conflicts: [],
  };
  state = mark(state, "session", sessionId, "upsert");
  for (const ex of args.routine?.exercises ?? []) state = addExercise(state, ex, args.newId);
  return state;
}

export function addExercise(state: ActiveWorkout, ex: ExerciseMeta, newId: () => string): ActiveWorkout {
  const id = newId();
  const exercise: LocalExercise = {
    id,
    session_id: state.session.id,
    exercise_id: ex.id,
    exercise_name_snapshot: ex.name,
    load_type_snapshot: ex.load_type,
    position: nextPosition(state.exercises),
    notes: null,
    target_sets: ex.target_sets ?? null,
    target_reps_min: ex.target_reps_min ?? null,
    target_reps_max: ex.target_reps_max ?? null,
    revision: null,
  };
  let next = mark({ ...state, exercises: [...state.exercises, exercise] }, "exercise", id, "upsert");
  const count = Math.max(1, ex.target_sets ?? 1);
  for (let i = 0; i < count; i++) {
    const setId = newId();
    next = mark({ ...next, sets: [...next.sets, blankSet(setId, id, i)] }, "set", setId, "upsert");
  }
  return next;
}

/** Add a set to an exercise, carrying over the previous set's weight (reps start blank). */
export function addSet(state: ActiveWorkout, exerciseId: string, newId: () => string): ActiveWorkout {
  const existing = setsFor(state, exerciseId);
  const last = existing[existing.length - 1];
  const id = newId();
  const set = blankSet(id, exerciseId, nextPosition(existing), last?.weight_kg ?? null);
  return mark({ ...state, sets: [...state.sets, set] }, "set", id, "upsert");
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export function updateSet(state: ActiveWorkout, setId: string, patch: Partial<Pick<LocalSet, "reps" | "weight_kg" | "notes" | "is_warmup">>): ActiveWorkout {
  const sets = state.sets.map((s) => {
    if (s.id !== setId) return s;
    const next = { ...s, ...patch };
    next.completed = next.reps != null && next.reps > 0;
    return next;
  });
  return mark({ ...state, sets }, "set", setId, "upsert");
}

export function updateExercise(state: ActiveWorkout, exerciseId: string, patch: Partial<Pick<LocalExercise, "notes">>): ActiveWorkout {
  const exercises = state.exercises.map((e) => (e.id === exerciseId ? { ...e, ...patch } : e));
  return mark({ ...state, exercises }, "exercise", exerciseId, "upsert");
}

export function updateSession(state: ActiveWorkout, patch: Partial<Pick<LocalSession, "name" | "notes">>): ActiveWorkout {
  return mark({ ...state, session: { ...state.session, ...patch } }, "session", state.session.id, "upsert");
}

/** Swap an exercise with its neighbour (delta -1 = up, +1 = down). */
export function moveExercise(state: ActiveWorkout, exerciseId: string, delta: -1 | 1): ActiveWorkout {
  const ordered = sortedExercises(state);
  const i = ordered.findIndex((e) => e.id === exerciseId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ordered.length) return state;
  const a = ordered[i];
  const b = ordered[j];
  const exercises = state.exercises.map((e) =>
    e.id === a.id ? { ...e, position: b.position } : e.id === b.id ? { ...e, position: a.position } : e,
  );
  return mark(mark({ ...state, exercises }, "exercise", a.id, "upsert"), "exercise", b.id, "upsert");
}

// ---------------------------------------------------------------------------
// Removing (with undo)
// ---------------------------------------------------------------------------

export function removeSet(state: ActiveWorkout, setId: string): { state: ActiveWorkout; removed: LocalSet | null } {
  const removed = state.sets.find((s) => s.id === setId) ?? null;
  if (!removed) return { state, removed };
  const next = { ...state, sets: state.sets.filter((s) => s.id !== setId) };
  return { state: mark(next, "set", setId, "delete", removed.revision), removed };
}

/** Undo: re-create the row with the same id. revision=null makes the server insert it, or update it if the delete never landed. */
export function restoreSet(state: ActiveWorkout, set: LocalSet): ActiveWorkout {
  if (!state.exercises.some((e) => e.id === set.session_exercise_id)) return state;
  return mark({ ...state, sets: [...state.sets, { ...set, revision: null }] }, "set", set.id, "upsert");
}

export function removeExercise(
  state: ActiveWorkout,
  exerciseId: string,
): { state: ActiveWorkout; removed: { exercise: LocalExercise; sets: LocalSet[] } | null } {
  const exercise = state.exercises.find((e) => e.id === exerciseId);
  if (!exercise) return { state, removed: null };
  const sets = state.sets.filter((s) => s.session_exercise_id === exerciseId);
  // The server cascades the sets; drop their pending writes so they don't hit a missing parent.
  let next = unmark(
    { ...state, exercises: state.exercises.filter((e) => e.id !== exerciseId), sets: state.sets.filter((s) => s.session_exercise_id !== exerciseId) },
    sets.map((s) => s.id),
  );
  next = mark(next, "exercise", exerciseId, "delete", exercise.revision);
  return { state: next, removed: { exercise, sets } };
}

export function restoreExercise(state: ActiveWorkout, removed: { exercise: LocalExercise; sets: LocalSet[] }): ActiveWorkout {
  let next = mark({ ...state, exercises: [...state.exercises, { ...removed.exercise, revision: null }] }, "exercise", removed.exercise.id, "upsert");
  for (const s of removed.sets) next = mark({ ...next, sets: [...next.sets, { ...s, revision: null }] }, "set", s.id, "upsert");
  return next;
}

// ---------------------------------------------------------------------------
// Finishing / discarding
// ---------------------------------------------------------------------------

export function finishWorkout(state: ActiveWorkout, now: Date): ActiveWorkout {
  const started = Date.parse(state.session.started_at);
  // Guard against a device clock that is behind the recorded start.
  const completed = new Date(Number.isFinite(started) ? Math.max(started, now.getTime()) : now.getTime()).toISOString();
  return mark({ ...state, session: { ...state.session, status: "completed", completed_at: completed } }, "session", state.session.id, "upsert");
}

export function discardWorkout(state: ActiveWorkout): ActiveWorkout {
  // Only the session delete is needed; the server cascades its children.
  const cleared = unmark(state, Object.keys(state.pending));
  return { ...mark(cleared, "session", state.session.id, "delete", state.session.revision), discarded: true };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

const KIND_ORDER: Kind[] = ["session", "exercise", "set"];

function rowData(state: ActiveWorkout, kind: Kind, id: string): Record<string, unknown> | null {
  const strip = <T extends { revision: number | null }>(row: T) => {
    const { revision: _revision, ...rest } = row;
    return rest;
  };
  if (kind === "session") return state.session.id === id ? strip(state.session) : null;
  if (kind === "exercise") {
    const e = state.exercises.find((x) => x.id === id);
    return e ? strip(e) : null;
  }
  const s = state.sets.find((x) => x.id === id);
  return s ? strip(s) : null;
}

function revisionOf(state: ActiveWorkout, kind: Kind, id: string): number | null {
  if (kind === "session") return state.session.id === id ? state.session.revision : null;
  if (kind === "exercise") return state.exercises.find((x) => x.id === id)?.revision ?? null;
  return state.sets.find((x) => x.id === id)?.revision ?? null;
}

/**
 * Ops for every pending row, parents before children for upserts and children before parents
 * for deletes. Returns the seq of each op so results only clear what was actually sent.
 */
export function buildOps(state: ActiveWorkout): { ops: SyncOp[]; sent: Record<string, number> } {
  const entries = Object.entries(state.pending);
  const sent: Record<string, number> = {};
  const upserts: SyncOp[] = [];
  const deletes: SyncOp[] = [];

  for (const kind of KIND_ORDER) {
    for (const [id, p] of entries.filter(([, p]) => p.kind === kind && p.op === "upsert").sort((a, b) => a[1].seq - b[1].seq)) {
      const data = rowData(state, kind, id);
      if (!data) continue;
      upserts.push({ kind, op: "upsert", id, base_revision: revisionOf(state, kind, id), data });
      sent[id] = p.seq;
    }
  }
  for (const kind of [...KIND_ORDER].reverse()) {
    for (const [id, p] of entries.filter(([, p]) => p.kind === kind && p.op === "delete").sort((a, b) => a[1].seq - b[1].seq)) {
      deletes.push({ kind, op: "delete", id, base_revision: p.baseRevision ?? null });
      sent[id] = p.seq;
    }
  }
  return { ops: [...upserts, ...deletes], sent };
}

/** Apply the server's per-op results. Rows edited again while the request was in flight stay pending. */
export function applyResults(state: ActiveWorkout, sent: Record<string, number>, results: SyncResult[]): ActiveWorkout {
  let next: ActiveWorkout = { ...state, pending: { ...state.pending } };
  const conflicts: ConflictItem[] = [];

  for (const r of results) {
    if (r.status === "conflict") {
      conflicts.push({ kind: r.kind, id: r.id, reason: r.reason ?? "modified", revision: r.revision });
      continue;
    }
    if (r.status === "applied" && r.revision != null) {
      if (r.kind === "session" && next.session.id === r.id) next = { ...next, session: { ...next.session, revision: r.revision } };
      if (r.kind === "exercise") next = { ...next, exercises: next.exercises.map((e) => (e.id === r.id ? { ...e, revision: r.revision! } : e)) };
      if (r.kind === "set") next = { ...next, sets: next.sets.map((s) => (s.id === r.id ? { ...s, revision: r.revision! } : s)) };
    }
    if (next.pending[r.id]?.seq === sent[r.id]) delete next.pending[r.id];
  }
  return { ...next, conflicts };
}

/**
 * "Keep this device's version": rebase every local row onto the server's current revisions
 * (null where the server no longer has it, so it is re-created) and mark everything for upload.
 */
export function rebaseOnServer(
  state: ActiveWorkout,
  serverRevisions: Record<string, number | undefined>,
): ActiveWorkout {
  let next: ActiveWorkout = {
    ...state,
    conflicts: [],
    session: { ...state.session, revision: serverRevisions[state.session.id] ?? null },
    exercises: state.exercises.map((e) => ({ ...e, revision: serverRevisions[e.id] ?? null })),
    sets: state.sets.map((s) => ({ ...s, revision: serverRevisions[s.id] ?? null })),
  };
  const deletes = Object.entries(state.pending).filter(([, p]) => p.op === "delete");
  next = unmark(next, Object.keys(next.pending));
  next = mark(next, "session", next.session.id, "upsert");
  for (const e of next.exercises) next = mark(next, "exercise", e.id, "upsert");
  for (const s of next.sets) next = mark(next, "set", s.id, "upsert");
  for (const [id, p] of deletes) next = mark(next, p.kind, id, "delete", serverRevisions[id] ?? null);
  return next;
}

/** Build local state from server rows (resume on another device, or "use the server version"). */
export function fromServer(
  userId: string,
  session: Omit<LocalSession, "revision"> & { revision: number },
  exercises: (Omit<LocalExercise, "revision"> & { revision: number })[],
  sets: (Omit<LocalSet, "revision"> & { revision: number })[],
): ActiveWorkout {
  return { version: 1, userId, session, exercises, sets, pending: {}, seq: 0, conflicts: [] };
}
