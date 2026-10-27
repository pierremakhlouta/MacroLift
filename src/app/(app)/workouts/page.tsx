"use client";

import { BookOpen, ChevronRight, Dumbbell, Plus } from "lucide-react";
import Link from "next/link";
import { ButtonLink, Card, EmptyState, PageHeader, QueryState } from "@/components/ui";
import { useRoutines } from "@/lib/queries/routines";
import { formatTarget } from "@/lib/routines/targets";

export default function WorkoutsPage() {
  const routines = useRoutines();

  return (
    <>
      <PageHeader
        title="Workouts"
        actions={
          <ButtonLink href="/workouts/exercises" variant="secondary">
            <BookOpen aria-hidden className="size-4" /> Exercise library
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        <Card aria-labelledby="start-heading">
          <div className="flex items-center gap-3">
            <Dumbbell aria-hidden className="size-5 text-accent" />
            <h2 id="start-heading" className="text-lg font-semibold">Start a workout</h2>
          </div>
          <p className="mt-2 text-sm text-muted">Live workout logging arrives in the next build phase.</p>
        </Card>

        <section aria-labelledby="routines-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="routines-heading" className="text-lg font-semibold">Routines</h2>
            <ButtonLink href="/workouts/routines/new">
              <Plus aria-hidden className="size-4" /> New routine
            </ButtonLink>
          </div>

          <QueryState isPending={routines.isPending} error={routines.error} onRetry={() => routines.refetch()} loadingLabel="Loading routines" />

          {routines.data?.length === 0 && (
            <EmptyState icon={<Dumbbell aria-hidden className="size-8" />} title="No routines yet">
              Save a list of exercises with optional set and rep targets, then start it with one tap.
            </EmptyState>
          )}

          {!!routines.data?.length && (
            <ul className="space-y-3">
              {routines.data.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/workouts/routines/${r.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-border-strong"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.name}</span>
                      <span className="block text-sm text-muted">
                        {r.items.length} {r.items.length === 1 ? "exercise" : "exercises"}
                      </span>
                      {r.items.length > 0 && (
                        <span className="mt-1 block truncate text-xs text-muted">
                          {r.items
                            .slice(0, 4)
                            .map((i) => {
                              const t = formatTarget(i.target_sets, { min: i.target_reps_min, max: i.target_reps_max });
                              return `${i.exercise?.name ?? "Unknown"}${t ? ` (${t})` : ""}`;
                            })
                            .join(", ")}
                          {r.items.length > 4 ? ", …" : ""}
                        </span>
                      )}
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                    <span className="sr-only">Edit routine</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
