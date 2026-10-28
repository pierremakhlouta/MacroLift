"use client";

import { Trash2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BackLink } from "@/components/back-link";
import { Dialog } from "@/components/dialog";
import { Alert, Button, ButtonLink, Card, EmptyState, PageHeader, QueryState } from "@/components/ui";
import {
  formatWorkoutDate,
  WorkoutExerciseDetails,
  WorkoutStats,
  workoutTitle,
} from "@/components/workouts/workout-history-card";
import { useUnitSystem } from "@/lib/queries/profile";
import { useDeleteWorkout, useWorkout } from "@/lib/queries/workouts";

export default function WorkoutDetailPage() {
  return (
    <>
      <BackLink href="/workouts/history" label="History" />
      <Suspense>
        <WorkoutDetail />
      </Suspense>
    </>
  );
}

function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const finished = useSearchParams().get("finished") === "1";
  const router = useRouter();
  const workout = useWorkout(id);
  const del = useDeleteWorkout();
  const units = useUnitSystem();
  const [confirm, setConfirm] = useState(false);

  if (workout.data === null) {
    return (
      <EmptyState title="Workout not found" action={<ButtonLink href="/workouts/history">Back to history</ButtonLink>}>
        It may have been deleted.
      </EmptyState>
    );
  }
  if (!workout.data) {
    return <QueryState isPending={workout.isPending} error={workout.error} onRetry={() => workout.refetch()} loadingLabel="Loading workout" />;
  }

  const w = workout.data;
  return (
    <>
      <PageHeader title={workoutTitle(w)} description={formatWorkoutDate(w.started_at)} />
      <div className="space-y-4">
        {finished && <Alert tone="success" title="Workout saved">Nice work. Here&apos;s your summary.</Alert>}
        <Card aria-label="Summary">
          <WorkoutStats workout={w} units={units} />
        </Card>
        <section aria-labelledby="exercises-heading" className="space-y-3">
          <h2 id="exercises-heading" className="text-lg font-semibold">Exercises</h2>
          <WorkoutExerciseDetails workout={w} units={units} />
        </section>
        {w.notes && <p className="text-sm text-muted">Notes: {w.notes}</p>}
        <Button variant="danger" onClick={() => setConfirm(true)}>
          <Trash2 aria-hidden className="size-4" /> Delete workout
        </Button>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this workout?"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={async () => {
                await del.mutateAsync(w.id);
                router.replace("/workouts/history");
              }}
            >
              Delete workout
            </Button>
          </div>
        }
      >
        {del.error && <Alert tone="error" className="mb-3">{del.error.message}</Alert>}
        <p className="text-sm text-muted">This permanently removes the workout from your history.</p>
      </Dialog>
    </>
  );
}
