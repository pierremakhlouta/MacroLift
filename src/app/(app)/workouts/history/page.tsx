"use client";

import { History } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Button, ButtonLink, EmptyState, PageHeader, QueryState } from "@/components/ui";
import { WorkoutHistoryCard } from "@/components/workouts/workout-history-card";
import { useUnitSystem } from "@/lib/queries/profile";
import { useWorkoutHistory } from "@/lib/queries/workouts";

export default function WorkoutHistoryPage() {
  const history = useWorkoutHistory();
  const units = useUnitSystem();
  const workouts = history.data?.pages.flat() ?? [];

  return (
    <>
      <BackLink href="/workouts" label="Workouts" />
      <PageHeader title="Workout history" description="Newest first. Expand a workout to see every exercise and set." />
      <QueryState isPending={history.isPending} error={history.error} onRetry={() => history.refetch()} loadingLabel="Loading history" />

      {history.isSuccess && workouts.length === 0 && (
        <EmptyState icon={<History aria-hidden className="size-8" />} title="No finished workouts yet" action={<ButtonLink href="/workouts">Start a workout</ButtonLink>}>
          Workouts appear here after you finish them.
        </EmptyState>
      )}

      {workouts.length > 0 && (
        <ul className="space-y-3">
          {workouts.map((w) => (
            <li key={w.id}>
              <WorkoutHistoryCard workout={w} units={units} />
            </li>
          ))}
        </ul>
      )}

      {history.hasNextPage && (
        <Button variant="secondary" className="mt-4 w-full" loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>
          Load older workouts
        </Button>
      )}
    </>
  );
}
