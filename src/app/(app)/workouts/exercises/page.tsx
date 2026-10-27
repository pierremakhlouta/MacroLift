"use client";

import { Pencil, Plus } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/dialog";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { ExerciseSearch, ExerciseSummary } from "@/components/exercises/exercise-search";
import { Alert, Button, EmptyState, PageHeader, QueryState } from "@/components/ui";
import { isCustom, useExercises, useSetExerciseArchived, type Exercise } from "@/lib/queries/exercises";

type Editing = { mode: "create"; name: string } | { mode: "edit"; exercise: Exercise } | null;

export default function ExerciseLibraryPage() {
  const exercises = useExercises();
  const setArchived = useSetExerciseArchived();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

  const visible = useMemo(
    () => (exercises.data ?? []).filter((e) => showArchived || !e.archived_at),
    [exercises.data, showArchived],
  );
  const archivedCount = (exercises.data ?? []).filter((e) => e.archived_at).length;

  return (
    <>
      <BackLink href="/workouts" label="Workouts" />
      <PageHeader
        title="Exercise library"
        description="Built-in exercises plus your own. Search by name or muscle group."
        actions={
          <Button onClick={() => setEditing({ mode: "create", name: query.trim() })}>
            <Plus aria-hidden className="size-4" /> New exercise
          </Button>
        }
      />

      {setArchived.error && <Alert tone="error" className="mb-3">{setArchived.error.message}</Alert>}

      {exercises.data ? (
        <div className="space-y-3">
          <ExerciseSearch
            exercises={visible}
            query={query}
            onQueryChange={setQuery}
            renderItem={(e) => (
              <div className="flex min-h-14 items-center gap-2 px-3 py-2">
                <ExerciseSummary exercise={e} />
                {isCustom(e) ? (
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", exercise: e })}
                    className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
                    aria-label={`Edit ${e.name}`}
                  >
                    <Pencil aria-hidden className="size-4" />
                  </button>
                ) : (
                  <span className="ml-auto shrink-0 text-[11px] text-muted">Built-in</span>
                )}
              </div>
            )}
            emptyState={
              <EmptyState
                title="No matching exercise"
                action={
                  <Button variant="secondary" onClick={() => setEditing({ mode: "create", name: query.trim() })}>
                    Create “{query.trim() || "new exercise"}”
                  </Button>
                }
              >
                Try a shorter word or a muscle group like “back” or “legs”.
              </EmptyState>
            }
          />
          {archivedCount > 0 && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Show archived ({archivedCount})
            </label>
          )}
        </div>
      ) : (
        <QueryState isPending={exercises.isPending} error={exercises.error} onRetry={() => exercises.refetch()} loadingLabel="Loading exercises" />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? "Edit exercise" : "New custom exercise"}
      >
        {editing && (
          <div className="space-y-6">
            <ExerciseForm
              exercise={editing.mode === "edit" ? editing.exercise : undefined}
              initialName={editing.mode === "create" ? editing.name : ""}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
            {editing.mode === "edit" && (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm text-muted">
                  {editing.exercise.archived_at
                    ? "Restore this exercise so it appears in search and pickers again."
                    : "Archiving hides it from search and pickers. Routines and past workouts keep it."}
                </p>
                <Button
                  variant={editing.exercise.archived_at ? "secondary" : "danger"}
                  loading={setArchived.isPending}
                  onClick={async () => {
                    await setArchived.mutateAsync({ id: editing.exercise.id, archived: !editing.exercise.archived_at });
                    setEditing(null);
                  }}
                >
                  {editing.exercise.archived_at ? "Restore exercise" : "Archive exercise"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
