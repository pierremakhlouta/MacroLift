"use client";

import { Dumbbell, History, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, ButtonLink, Card } from "@/components/ui";
import { SyncStatusBadge } from "@/components/workouts/sync-status";
import type { Routine } from "@/lib/queries/routines";
import { activeWorkoutStore, useActiveWorkout } from "@/lib/workouts/active-store";
import { useNow } from "@/lib/hooks/use-now";
import { formatDuration } from "@/lib/workouts/summary";
import { sortedExercises } from "@/lib/workouts/sync-core";

/** Start a workout from a routine or blank; if one exists already, offer to resume it instead. */
export function useStartWorkout() {
  const router = useRouter();
  const { workout } = useActiveWorkout();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function start(routine?: Routine) {
    setError(null);
    if (workout) {
      router.push("/workouts/active");
      return;
    }
    setStarting(true);
    try {
      // Another device may have started one since this page loaded.
      if (navigator.onLine && (await activeWorkoutStore.serverHasActive())) {
        await activeWorkoutStore.reconcile();
        router.push("/workouts/active");
        return;
      }
      activeWorkoutStore.start({
        routine: routine && {
          id: routine.id,
          name: routine.name,
          exercises: routine.items
            .filter((i) => i.exercise)
            .map((i) => ({
              id: i.exercise!.id,
              name: i.exercise!.name,
              load_type: i.exercise!.load_type,
              target_sets: i.target_sets,
              target_reps_min: i.target_reps_min,
              target_reps_max: i.target_reps_max,
            })),
        },
      });
      router.push("/workouts/active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the workout.");
    } finally {
      setStarting(false);
    }
  }

  return { start, starting, error, hasActive: Boolean(workout) };
}

export function StartWorkoutCard({ showHistoryLink = true }: { showHistoryLink?: boolean }) {
  const { workout, status, loaded } = useActiveWorkout();
  const { start, starting, error } = useStartWorkout();
  const now = useNow();

  return (
    <Card aria-labelledby="start-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Dumbbell aria-hidden className="size-5 text-accent" />
          <h2 id="start-heading" className="text-lg font-semibold">
            {workout ? "Workout in progress" : "Start a workout"}
          </h2>
        </div>
        {workout && <SyncStatusBadge status={status} compact />}
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      {workout ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">
            {workout.session.name || workout.session.routine_name_snapshot || "Workout"} · started{" "}
            {formatDuration(now - Date.parse(workout.session.started_at))} ago · {sortedExercises(workout).length} exercises
          </p>
          <ButtonLink href="/workouts/active" className="w-full sm:w-auto">
            <Play aria-hidden className="size-4" /> Resume workout
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={() => start()} loading={starting} disabled={!loaded && !workout}>
            <Play aria-hidden className="size-4" /> Start empty workout
          </Button>
          <p className="text-xs text-muted">Or start one of your routines below.</p>
        </div>
      )}
      {showHistoryLink && (
        <Link href="/workouts/history" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-accent underline underline-offset-4">
          <History aria-hidden className="size-4" /> Workout history
        </Link>
      )}
    </Card>
  );
}

export function StartRoutineButton({ routine }: { routine: Routine }) {
  const { start, starting, hasActive } = useStartWorkout();
  return (
    <Button
      variant="secondary"
      className="shrink-0"
      loading={starting}
      disabled={hasActive || routine.items.length === 0}
      onClick={() => start(routine)}
      aria-label={`Start ${routine.name}`}
      title={hasActive ? "Finish or discard your current workout first" : undefined}
    >
      <Play aria-hidden className="size-4" /> Start
    </Button>
  );
}

