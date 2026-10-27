"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RoutineEditor } from "@/components/routines/routine-editor";
import { ButtonLink, EmptyState, PageHeader, QueryState } from "@/components/ui";
import { useRoutine } from "@/lib/queries/routines";
import { BackLink } from "@/components/back-link";

export default function EditRoutinePage() {
  return (
    <>
      <BackLink href="/workouts" label="Workouts" />
      <Suspense>
        <EditRoutine />
      </Suspense>
    </>
  );
}

function EditRoutine() {
  const { id } = useParams<{ id: string }>();
  const routine = useRoutine(id);

  return (
    <>
      <PageHeader title={routine.data?.name || "Routine"} />
      {routine.data ? (
        <RoutineEditor key={routine.data.updated_at} routine={routine.data} isNew={false} />
      ) : routine.data === null ? (
        <EmptyState title="Routine not found" action={<ButtonLink href="/workouts">Back to workouts</ButtonLink>}>
          It may have been deleted.
        </EmptyState>
      ) : (
        <QueryState isPending={routine.isPending} error={routine.error} onRetry={() => routine.refetch()} loadingLabel="Loading routine" />
      )}
    </>
  );
}
