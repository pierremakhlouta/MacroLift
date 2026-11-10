import type { LoadType } from "@/lib/exercises/catalog";
import { bestSet, isLoggedSet, type SummarySet } from "./summary";

/** One past appearance of an exercise in a completed workout. */
export type PastExercise = { started_at: string; load_type_snapshot: LoadType; sets: SummarySet[] };

export type DatedSet = { set: SummarySet; date: string };

/**
 * The best set ever logged for one exercise, across every completed workout regardless of
 * routine, with the date it was first reached. Warm-ups don't count, and only appearances logged
 * the same way as now (e.g. weight × reps vs. distance and time) are compared.
 */
export function exerciseBest(past: PastExercise[], loadType: LoadType): DatedSet | null {
  const dated = past
    .filter((p) => p.load_type_snapshot === loadType)
    // Oldest first, so a tie keeps the earliest date.
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
    .flatMap((p) => p.sets.filter((s) => !s.is_warmup).map((set) => ({ set, date: p.started_at })));
  const top = bestSet({ load_type_snapshot: loadType, sets: dated.map((d) => d.set) });
  return top ? dated.find((d) => d.set === top)! : null;
}
