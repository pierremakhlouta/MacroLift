import type { LoadType } from "@/lib/exercises/catalog";

export type SummarySet = {
  reps: number | null;
  weight_kg: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
  is_warmup?: boolean | null;
};
export type SummaryExercise = { load_type_snapshot: LoadType; sets: SummarySet[] };

/**
 * A set counts as logged once reps are entered (blank or 0 reps = not performed). Cardio sets
 * count once a time or distance is entered.
 */
export const isLoggedSet = (s: SummarySet, loadType: LoadType = "external") =>
  loadType === "cardio" ? (s.duration_seconds ?? 0) > 0 || (s.distance_m ?? 0) > 0 : s.reps != null && s.reps > 0;

/** completed_at − started_at in ms; null if either is missing, invalid, or out of order. */
export function workoutDurationMs(startedAt: string | null | undefined, completedAt: string | null | undefined): number | null {
  if (!startedAt || !completedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "< 1 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export type WorkoutSummary = {
  durationMs: number | null;
  exerciseCount: number;
  loggedSets: number;
  totalReps: number;
  /** Sum of weight × reps over logged sets of externally loaded exercises; null if there are none. */
  volumeKg: number | null;
  /** Logged sets of bodyweight/assisted exercises: reported separately, never as zero volume. */
  bodyweightSets: number;
  /** Cardio totals over logged cardio sets; null when none has a time / distance. */
  cardioSeconds: number | null;
  cardioDistanceM: number | null;
};

export function workoutSummary(input: {
  started_at: string | null;
  completed_at: string | null;
  exercises: SummaryExercise[];
}): WorkoutSummary {
  let loggedSets = 0;
  let totalReps = 0;
  let volume = 0;
  let volumeSets = 0;
  let bodyweightSets = 0;
  let cardioSeconds: number | null = null;
  let cardioDistanceM: number | null = null;

  for (const ex of input.exercises) {
    for (const s of ex.sets) {
      if (!isLoggedSet(s, ex.load_type_snapshot) || s.is_warmup) continue;
      loggedSets += 1;
      if (ex.load_type_snapshot === "cardio") {
        if (s.duration_seconds != null) cardioSeconds = (cardioSeconds ?? 0) + s.duration_seconds;
        if (s.distance_m != null) cardioDistanceM = (cardioDistanceM ?? 0) + s.distance_m;
        continue;
      }
      totalReps += s.reps!;
      if (ex.load_type_snapshot === "external") {
        if (s.weight_kg != null && Number.isFinite(s.weight_kg)) {
          volume += s.weight_kg * s.reps!;
          volumeSets += 1;
        }
      } else {
        bodyweightSets += 1;
      }
    }
  }

  return {
    durationMs: workoutDurationMs(input.started_at, input.completed_at),
    exerciseCount: input.exercises.length,
    loggedSets,
    totalReps,
    volumeKg: volumeSets > 0 ? volume : null,
    bodyweightSets,
    cardioSeconds,
    cardioDistanceM,
  };
}

/**
 * Best logged set for a summary line: heaviest weight (then most reps); most reps if unweighted;
 * for cardio, the longest distance (then the longest time).
 */
export function bestSet(ex: SummaryExercise): SummarySet | null {
  let best: SummarySet | null = null;
  for (const s of ex.sets) {
    if (!isLoggedSet(s, ex.load_type_snapshot)) continue;
    if (!best) {
      best = s;
      continue;
    }
    if (ex.load_type_snapshot === "cardio") {
      const d = s.distance_m ?? -1;
      const bd = best.distance_m ?? -1;
      if (d > bd || (d === bd && (s.duration_seconds ?? 0) > (best.duration_seconds ?? 0))) best = s;
      continue;
    }
    const w = s.weight_kg ?? -1;
    const bw = best.weight_kg ?? -1;
    if (ex.load_type_snapshot === "assisted") {
      // Less assistance is harder.
      if ((s.weight_kg ?? Infinity) < (best.weight_kg ?? Infinity) || (w === bw && s.reps! > best.reps!)) best = s;
    } else if (w > bw || (w === bw && s.reps! > best.reps!)) {
      best = s;
    }
  }
  return best;
}
