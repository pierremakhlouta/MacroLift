"use client";

// Active-workout store: local-first state persisted to this browser (per account) plus a sync
// engine that uploads pending edits through sync_workout(). This is basic interruption recovery,
// not full offline support: the workout survives refreshes and short connection drops, and the
// UI only says "Saved" after the server has confirmed every edit.

import { useSyncExternalStore } from "react";
import { readJson, removeKey, userKey, writeJson } from "@/lib/local-store";
import { getSupabase } from "@/lib/supabase/client";
import {
  addExercise,
  addSet,
  applyResults,
  buildOps,
  createWorkout,
  discardWorkout,
  finishWorkout,
  fromServer,
  hasPending,
  moveExercise,
  rebaseOnServer,
  removeExercise,
  removeSet,
  restoreExercise,
  restoreSet,
  updateExercise,
  updateSession,
  updateSet,
  type ActiveWorkout,
  type ExerciseMeta,
  type LocalExercise,
  type LocalSet,
  type SyncResult,
} from "./sync-core";

export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "error" | "conflict";

export type StoreState = {
  loaded: boolean;
  workout: ActiveWorkout | null;
  status: SyncStatus;
  error: string | null;
  /** Set when a finished workout has been fully saved; the UI navigates to its summary. */
  finishedSessionId: string | null;
  /** Shown once when the server says the workout ended elsewhere. */
  notice: string | null;
  /** Bumped whenever local state is replaced from the server, so inputs re-read their values. */
  generation: number;
};

const STORAGE_NAME = "active-workout";
const DEBOUNCE_MS = 400;
const MAX_RETRY_MS = 30_000;

const SESSION_SELECT =
  "id, routine_id, routine_name_snapshot, name, notes, status, started_at, completed_at, revision, " +
  "exercises:session_exercises(id, session_id, exercise_id, exercise_name_snapshot, load_type_snapshot, position, notes, target_sets, target_reps_min, target_reps_max, revision, " +
  "sets:workout_sets(id, session_exercise_id, position, reps, weight_kg, duration_seconds, distance_m, is_warmup, completed, notes, revision))";

type ServerSession = Omit<ActiveWorkout["session"], "revision"> & {
  revision: number;
  exercises: (Omit<LocalExercise, "revision"> & { revision: number; sets: (Omit<LocalSet, "revision"> & { revision: number })[] })[];
};

function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
  return /failed to fetch|network|load failed|fetch failed|timeout|aborted/i.test(msg) || (typeof navigator !== "undefined" && !navigator.onLine);
}

class ActiveWorkoutStore {
  private state: StoreState = { loaded: false, workout: null, status: "idle", error: null, finishedSessionId: null, notice: null, generation: 0 };
  private listeners = new Set<() => void>();
  private userId: string | null = null;
  private inflight = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryMs = 2_000;
  private listening = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;

  private emit(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private get key() {
    return this.userId ? userKey(this.userId, STORAGE_NAME) : null;
  }

  private persist(workout: ActiveWorkout | null) {
    if (!this.key) return;
    if (workout) {
      if (!writeJson(this.key, workout)) this.emit({ error: "Couldn't keep a backup on this device (storage full or blocked)." });
    } else {
      removeKey(this.key);
    }
  }

  private listen() {
    if (this.listening || typeof window === "undefined") return;
    this.listening = true;
    window.addEventListener("online", () => {
      this.retryMs = 2_000;
      void this.flush();
    });
    window.addEventListener("offline", () => {
      if (this.state.workout && hasPending(this.state.workout)) this.emit({ status: "offline" });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.flush();
    });
  }

  // ------------------------------------------------------------------ lifecycle

  /** Called when the signed-in user is known. Loads this account's local copy, then reconciles with the server. */
  async init(userId: string) {
    if (this.userId === userId && this.state.loaded) return;
    this.userId = userId;
    this.listen();
    const local = readJson<ActiveWorkout>(this.key!);
    const workout = local?.version === 1 && local.userId === userId ? local : null;
    this.emit({ loaded: !!workout, workout, status: workout && hasPending(workout) ? "saving" : workout ? "saved" : "idle", error: null, notice: null });
    await this.reconcile();
    this.emit({ loaded: true });
    void this.flush();
  }

  reset() {
    this.userId = null;
    if (this.timer) clearTimeout(this.timer);
    this.emit({ loaded: false, workout: null, status: "idle", error: null, finishedSessionId: null, notice: null, generation: this.state.generation + 1 });
  }

  /**
   * Without unsynced local edits, the server is authoritative: adopt its in-progress workout
   * (resume on another device / pick up edits made elsewhere) or drop a stale local copy.
   * With unsynced edits, keep them; revisions will surface any conflict on upload.
   */
  async reconcile() {
    const local = this.state.workout;
    if (local && (hasPending(local) || local.session.status === "completed")) return;
    try {
      const server = await this.fetchActive();
      if (server) this.set(server, "saved", true);
      else if (local) {
        this.set(null, "idle");
        this.emit({ notice: "Your workout was finished or discarded on another device." });
      }
    } catch {
      // Offline or server unreachable: keep whatever we have locally.
    }
  }

  private async fetchActive(): Promise<ActiveWorkout | null> {
    const { data, error } = await getSupabase()
      .from("workout_sessions")
      .select(SESSION_SELECT)
      .eq("status", "in_progress")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const s = data as unknown as ServerSession;
    const { exercises, ...session } = s;
    return fromServer(
      this.userId!,
      session,
      exercises.map(({ sets: _sets, ...e }) => e),
      exercises.flatMap((e) => e.sets),
    );
  }

  /** True if the server already has an in-progress workout (e.g. started on another device). */
  async serverHasActive(): Promise<boolean> {
    try {
      const { data } = await getSupabase().from("workout_sessions").select("id").eq("status", "in_progress").maybeSingle();
      return Boolean(data);
    } catch {
      return false;
    }
  }

  private set(workout: ActiveWorkout | null, status?: SyncStatus, fromServer = false) {
    this.persist(workout);
    this.emit({ workout, ...(status ? { status } : {}), ...(fromServer ? { generation: this.state.generation + 1 } : {}) });
  }

  // ------------------------------------------------------------------ edits

  private update(fn: (w: ActiveWorkout) => ActiveWorkout) {
    const current = this.state.workout;
    if (!current) return;
    const next = fn(current);
    if (next === current) return;
    this.set(next, this.state.status === "conflict" ? "conflict" : navigator.onLine ? "saving" : "offline");
    this.schedule(DEBOUNCE_MS);
  }

  start(args: { name?: string | null; routine?: { id: string; name: string; exercises: ExerciseMeta[] } }) {
    if (!this.userId) throw new Error("Not signed in");
    const workout = createWorkout({
      userId: this.userId,
      newId: () => crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      name: args.name ?? null,
      routine: args.routine,
    });
    this.emit({ finishedSessionId: null, notice: null, error: null });
    this.set(workout, "saving");
    void this.flush();
    return workout.session.id;
  }

  addExercise = (ex: ExerciseMeta) => this.update((w) => addExercise(w, ex, () => crypto.randomUUID()));
  addSet = (exerciseId: string) => this.update((w) => addSet(w, exerciseId, () => crypto.randomUUID()));
  updateSet = (setId: string, patch: Parameters<typeof updateSet>[2]) => this.update((w) => updateSet(w, setId, patch));
  updateExercise = (id: string, patch: Parameters<typeof updateExercise>[2]) => this.update((w) => updateExercise(w, id, patch));
  updateSession = (patch: Parameters<typeof updateSession>[1]) => this.update((w) => updateSession(w, patch));
  moveExercise = (id: string, delta: -1 | 1) => this.update((w) => moveExercise(w, id, delta));

  removeSet = (setId: string) => {
    let removed: LocalSet | null = null;
    this.update((w) => {
      const r = removeSet(w, setId);
      removed = r.removed;
      return r.state;
    });
    return removed as LocalSet | null;
  };
  restoreSet = (set: LocalSet) => this.update((w) => restoreSet(w, set));

  removeExercise = (id: string) => {
    let removed: ReturnType<typeof removeExercise>["removed"] = null;
    this.update((w) => {
      const r = removeExercise(w, id);
      removed = r.removed;
      return r.state;
    });
    return removed as ReturnType<typeof removeExercise>["removed"];
  };
  restoreExercise = (removed: NonNullable<ReturnType<typeof removeExercise>["removed"]>) =>
    this.update((w) => restoreExercise(w, removed));

  finish = () => this.update((w) => finishWorkout(w, new Date()));
  discard = () => this.update((w) => discardWorkout(w));

  dismissFinished = () => this.emit({ finishedSessionId: null });
  dismissNotice = () => this.emit({ notice: null });

  // ------------------------------------------------------------------ conflicts

  /** Discard this device's unsynced edits and load the server's version. */
  async useServerVersion() {
    try {
      const server = await this.fetchActive();
      if (server) this.set(server, "saved", true);
      else {
        this.set(null, "idle");
        this.emit({ notice: "This workout was finished or discarded on another device." });
      }
      this.emit({ error: null });
    } catch (e) {
      this.emit({ error: e instanceof Error ? e.message : "Couldn't load the server version." });
    }
  }

  /** Keep this device's version: rebase onto current server revisions and upload everything. */
  async keepThisVersion() {
    const w = this.state.workout;
    if (!w) return;
    try {
      const supabase = getSupabase();
      const exIds = w.exercises.map((e) => e.id);
      const setIds = w.sets.map((s) => s.id);
      const [sess, exs, sets] = await Promise.all([
        supabase.from("workout_sessions").select("id, revision").eq("id", w.session.id),
        exIds.length ? supabase.from("session_exercises").select("id, revision").in("id", exIds) : Promise.resolve({ data: [], error: null }),
        setIds.length ? supabase.from("workout_sets").select("id, revision").in("id", setIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const err = sess.error ?? exs.error ?? sets.error;
      if (err) throw new Error(err.message);
      const revs: Record<string, number> = {};
      for (const row of [...(sess.data ?? []), ...(exs.data ?? []), ...(sets.data ?? [])]) revs[row.id] = row.revision;
      this.set(rebaseOnServer(w, revs), "saving");
      this.emit({ error: null });
      void this.flush();
    } catch (e) {
      this.emit({ error: e instanceof Error ? e.message : "Couldn't reach the server." });
    }
  }

  // ------------------------------------------------------------------ sync

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  async flush(): Promise<void> {
    const w = this.state.workout;
    if (!w || this.inflight || w.conflicts.length || !hasPending(w)) return;
    if (!navigator.onLine) {
      this.emit({ status: "offline" });
      return;
    }

    this.inflight = true;
    this.emit({ status: "saving" });
    const { ops, sent } = buildOps(w);
    try {
      const { data, error } = await getSupabase().rpc("sync_workout", { p_ops: ops as never });
      if (error) throw error;
      this.retryMs = 2_000;

      const latest = this.state.workout;
      if (!latest || latest.session.id !== w.session.id) return;
      const next = applyResults(latest, sent, data as unknown as SyncResult[]);

      if (next.conflicts.length) {
        this.set(next, "conflict");
      } else if (!hasPending(next) && next.discarded) {
        this.set(null, "idle");
      } else if (!hasPending(next) && next.session.status === "completed") {
        this.set(null, "saved");
        this.emit({ finishedSessionId: next.session.id });
      } else {
        this.set(next, hasPending(next) ? "saving" : "saved");
      }
      this.emit({ error: null });
    } catch (e) {
      const offline = isNetworkError(e);
      const message = (e as { message?: string })?.message ?? "Sync failed";
      this.emit({ status: offline ? "offline" : "error", error: offline ? null : message });
      this.schedule(this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
    } finally {
      this.inflight = false;
      const after = this.state.workout;
      if (after && hasPending(after) && !after.conflicts.length && this.state.status === "saving") this.schedule(DEBOUNCE_MS);
    }
  }
}

export const activeWorkoutStore = new ActiveWorkoutStore();

const SERVER_SNAPSHOT: StoreState = { loaded: false, workout: null, status: "idle", error: null, finishedSessionId: null, notice: null, generation: 0 };

export function useActiveWorkout(): StoreState {
  return useSyncExternalStore(activeWorkoutStore.subscribe, activeWorkoutStore.getSnapshot, () => SERVER_SNAPSHOT);
}
