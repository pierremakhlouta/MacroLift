"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/dialog";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { ExerciseSearch, ExerciseSummary } from "@/components/exercises/exercise-search";
import { Button, EmptyState, QueryState } from "@/components/ui";
import { useExercises, type Exercise } from "@/lib/queries/exercises";

/** Dialog to pick an exercise (or create a custom one) by live search. Archived exercises are hidden. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = "Add exercise",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
}) {
  const exercises = useExercises();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const active = useMemo(() => (exercises.data ?? []).filter((e) => !e.archived_at), [exercises.data]);

  const close = () => {
    setCreating(false);
    setQuery("");
    onClose();
  };
  const pick = (e: Exercise) => {
    onPick(e);
    close();
  };

  return (
    <Dialog open={open} onClose={close} title={creating ? "New custom exercise" : title}>
      {creating ? (
        <ExerciseForm initialName={query.trim()} onSaved={pick} onCancel={() => setCreating(false)} />
      ) : exercises.data ? (
        <div className="space-y-3">
          <ExerciseSearch
            exercises={active}
            query={query}
            onQueryChange={setQuery}
            autoFocus
            renderItem={(e) => (
              <button
                type="button"
                onClick={() => pick(e)}
                className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 focus-visible:-outline-offset-2"
              >
                <ExerciseSummary exercise={e} />
                <Plus aria-hidden className="ml-auto size-5 shrink-0 text-accent" />
                <span className="sr-only">Add</span>
              </button>
            )}
            emptyState={
              <EmptyState title="No matching exercise">
                Try a shorter word or a muscle group, or create your own.
              </EmptyState>
            }
          />
          <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
            {query.trim() ? `Create “${query.trim()}”` : "Create custom exercise"}
          </Button>
        </div>
      ) : (
        <QueryState isPending={exercises.isPending} error={exercises.error} onRetry={() => exercises.refetch()} loadingLabel="Loading exercises" />
      )}
    </Dialog>
  );
}
