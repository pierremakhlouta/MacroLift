"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useId, useMemo, type ReactNode } from "react";
import { EQUIPMENT, musclesText } from "@/lib/exercises/catalog";
import { searchExercises } from "@/lib/exercises/search";
import { isCustom, type Exercise } from "@/lib/queries/exercises";

const MAX_RESULTS = 60;

export function ExerciseBadges({ exercise }: { exercise: Exercise }) {
  return (
    <>
      {isCustom(exercise) && (
        <span className="rounded-md border border-info/50 px-1.5 py-0.5 text-[11px] font-medium text-info">Custom</span>
      )}
      {exercise.archived_at && (
        <span className="rounded-md border border-warn/50 px-1.5 py-0.5 text-[11px] font-medium text-warn">Archived</span>
      )}
    </>
  );
}

export function ExerciseSummary({ exercise }: { exercise: Exercise }) {
  return (
    <span className="block min-w-0">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{exercise.name}</span>
        <ExerciseBadges exercise={exercise} />
      </span>
      <span className="block truncate text-xs text-muted">
        {[musclesText(exercise.muscles), exercise.equipment && EQUIPMENT[exercise.equipment]].filter(Boolean).join(" · ")}
      </span>
    </span>
  );
}

/**
 * Search box with live partial matching on name and muscle group. Results update as you type;
 * the result count is announced politely to screen readers.
 */
export function ExerciseSearch({
  exercises,
  query,
  onQueryChange,
  renderItem,
  emptyState,
  autoFocus,
}: {
  exercises: Exercise[];
  query: string;
  onQueryChange: (q: string) => void;
  renderItem: (exercise: Exercise) => ReactNode;
  emptyState?: ReactNode;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const listId = useId();
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => searchExercises(exercises, deferredQuery), [exercises, deferredQuery]);
  const shown = results.slice(0, MAX_RESULTS);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
          Search exercises
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            data-autofocus={autoFocus || undefined}
            placeholder="Name or muscle, e.g. bench, back, legs"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-controls={listId}
            aria-describedby={`${listId}-count`}
            className="block min-h-11 w-full rounded-xl border border-border-strong bg-surface-2 pl-9 pr-3 text-text placeholder:text-muted/70"
          />
        </div>
      </div>
      <p id={`${listId}-count`} aria-live="polite" className="text-xs text-muted">
        {results.length === 0
          ? "No matches"
          : results.length > MAX_RESULTS
            ? `Showing ${MAX_RESULTS} of ${results.length} matches. Keep typing to narrow down.`
            : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
      </p>
      {shown.length === 0 ? (
        emptyState
      ) : (
        <ul id={listId} aria-label="Exercise results" className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {shown.map((e) => (
            <li key={e.id}>{renderItem(e)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
