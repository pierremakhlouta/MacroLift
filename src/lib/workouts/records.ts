import type { LoadType } from "@/lib/exercises/catalog";
import { bestSet, isLoggedSet, type SummarySet } from "./summary";

/** One past appearance of an exercise in a completed workout. */
export type PastExercise = { started_at: string; load_type_snapshot: LoadType; sets: SummarySet[] };

export type DatedSet = { set: SummarySet; date: string };
export type ExerciseRecords = { last: DatedSet | null; best: DatedSet | null };

/**
 * "Last time" (the best set of the most recent workout) and "Best" (the best set ever) for one
 * exercise, across every completed workout regardless of routine. Warm-ups don't count, and only
 * appearances logged the same way as now (e.g. weight × reps vs. distance and time) are compared.
 */
export function exerciseRecords(past: PastExercise[], loadType: LoadType): ExerciseRecords {
  const working = past
    .filter((p) => p.load_type_snapshot === loadType)
    .map((p) => ({ ...p, sets: p.sets.filter((s) => !s.is_warmup && isLoggedSet(s, loadType)) }))
    .filter((p) => p.sets.length > 0)
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  if (working.length === 0) return { last: null, best: null };

  const latest = working[0];
  const last = { set: bestSet({ load_type_snapshot: loadType, sets: latest.sets })!, date: latest.started_at };

  // Ties go to the earliest workout: the date a record was first reached.
  const dated = [...working].reverse().flatMap((p) => p.sets.map((set) => ({ set, date: p.started_at })));
  const top = bestSet({ load_type_snapshot: loadType, sets: dated.map((d) => d.set) })!;
  const best = dated.find((d) => d.set === top)!;
  return { last, best };
}
