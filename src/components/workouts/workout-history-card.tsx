"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { cx } from "@/components/ui";
import type { HistoryExercise, HistoryWorkout } from "@/lib/queries/workouts";
import { formatTarget } from "@/lib/routines/targets";
import { formatWeight, type UnitSystem } from "@/lib/units";
import { bestSet, formatDuration, isLoggedSet, workoutSummary, type SummarySet } from "@/lib/workouts/summary";

export function workoutTitle(w: Pick<HistoryWorkout, "name" | "routine_name_snapshot">) {
  return w.name || w.routine_name_snapshot || "Workout";
}

export function formatWorkoutDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Unknown date"
    : d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export function summaryFor(w: HistoryWorkout) {
  return workoutSummary({ started_at: w.started_at, completed_at: w.completed_at, exercises: w.exercises });
}

/** Human description of one set, respecting how the exercise's weight is interpreted. */
export function describeSet(set: SummarySet, ex: Pick<HistoryExercise, "load_type_snapshot">, units: UnitSystem): string {
  const reps = set.reps == null ? "— reps" : `${set.reps} ${set.reps === 1 ? "rep" : "reps"}`;
  if (set.weight_kg == null) return ex.load_type_snapshot === "external" ? `${reps} (no weight)` : reps;
  const w = formatWeight(set.weight_kg, units);
  if (ex.load_type_snapshot === "bodyweight") return `${reps} + ${w}`;
  if (ex.load_type_snapshot === "assisted") return `${reps} (${w} assist)`;
  return `${w} × ${reps.replace(/ reps?$/, "")}`;
}

export function WorkoutStats({ workout, units }: { workout: HistoryWorkout; units: UnitSystem }) {
  const s = summaryFor(workout);
  const items = [
    { label: "Duration", value: formatDuration(s.durationMs) },
    { label: "Sets", value: String(s.loggedSets) },
    { label: "Reps", value: String(s.totalReps) },
    { label: "Volume", value: s.volumeKg == null ? "—" : formatWeight(s.volumeKg, units, 0) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="font-semibold tabular-nums">{i.value}</dd>
        </div>
      ))}
      {s.bodyweightSets > 0 && (
        <p className="col-span-full text-xs text-muted">
          Includes {s.bodyweightSets} bodyweight/assisted {s.bodyweightSets === 1 ? "set" : "sets"}, not counted in volume.
        </p>
      )}
    </dl>
  );
}

export function WorkoutExerciseDetails({ workout, units }: { workout: HistoryWorkout; units: UnitSystem }) {
  if (workout.exercises.length === 0) return <p className="text-sm text-muted">No exercises were logged.</p>;
  return (
    <ol className="space-y-3">
      {workout.exercises.map((ex) => {
        const target = formatTarget(ex.target_sets, { min: ex.target_reps_min, max: ex.target_reps_max });
        return (
          <li key={ex.id} className="rounded-xl border border-border p-3">
            <h3 className="font-semibold">{ex.exercise_name_snapshot}</h3>
            {target && <p className="text-xs text-muted">Target {target}</p>}
            {ex.sets.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No sets.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">{ex.exercise_name_snapshot} sets</caption>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="w-12 py-1 font-medium">Set</th>
                    <th scope="col" className="py-1 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s, i) => (
                    <tr key={s.id} className={cx("border-t border-border", !isLoggedSet(s) && "text-muted")}>
                      <td className="py-1.5 tabular-nums">{i + 1}</td>
                      <td className="py-1.5 tabular-nums">
                        {describeSet(s, ex, units)}
                        {!isLoggedSet(s) && <span className="ml-1 text-xs">(not logged)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ex.notes && <p className="mt-2 text-sm text-muted">Note: {ex.notes}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** Summary first; exercises and sets revealed on expand. */
export function WorkoutHistoryCard({ workout, units }: { workout: HistoryWorkout; units: UnitSystem }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const s = summaryFor(workout);
  const title = workoutTitle(workout);

  return (
    <article className="rounded-2xl border border-border bg-surface" aria-label={`${title}, ${formatWorkoutDate(workout.started_at)}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 rounded-2xl p-4 text-left hover:bg-surface-2/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">{formatWorkoutDate(workout.started_at)}</span>
          <span className="block font-semibold">{title}</span>
          <span className="mt-1 block text-sm text-muted">
            {formatDuration(s.durationMs)} · {s.exerciseCount} {s.exerciseCount === 1 ? "exercise" : "exercises"} · {s.loggedSets}{" "}
            {s.loggedSets === 1 ? "set" : "sets"}
            {s.volumeKg != null && ` · ${formatWeight(s.volumeKg, units, 0)}`}
          </span>
          {workout.exercises.length > 0 && (
            <span className="mt-1 block truncate text-xs text-muted">
              {workout.exercises
                .map((e) => {
                  const best = bestSet(e);
                  return best ? `${e.exercise_name_snapshot} ${describeSet(best, e, units)}` : e.exercise_name_snapshot;
                })
                .join(" · ")}
            </span>
          )}
        </span>
        <ChevronDown aria-hidden className={cx("mt-1 size-5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
      </button>
      <div id={detailsId} hidden={!open} className="space-y-3 border-t border-border p-4">
        {open && (
          <>
            <WorkoutStats workout={workout} units={units} />
            <WorkoutExerciseDetails workout={workout} units={units} />
            {workout.notes && <p className="text-sm text-muted">Notes: {workout.notes}</p>}
            <Link href={`/workouts/history/${workout.id}`} className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">
              Open workout
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
