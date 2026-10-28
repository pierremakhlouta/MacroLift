"use client";

import { ChevronLeft, ChevronRight, ListChecks, Salad } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import { AddFoodDialog } from "@/components/nutrition/add-food-dialog";
import { DayTotals } from "@/components/nutrition/day-totals";
import { MealSection } from "@/components/nutrition/meal-section";
import { UndoToast, type UndoAction } from "@/components/undo-toast";
import { ButtonLink, Card, PageHeader, QueryState, Spinner } from "@/components/ui";
import { isoDaysAgo } from "@/lib/body/trend";
import { isValidIsoDate } from "@/lib/dates";
import { useToday } from "@/lib/hooks/use-today";
import { MEALS, useDiaryDay, useRestoreDiaryEntry, useTargetForDate, type DiaryEntry, type MealCategory } from "@/lib/queries/nutrition";

export default function NutritionPage() {
  return (
    <>
      <PageHeader
        title="Nutrition"
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/nutrition/foods" variant="secondary">
              <Salad aria-hidden className="size-4" /> Foods
            </ButtonLink>
            <ButtonLink href="/nutrition/meals" variant="secondary">
              <ListChecks aria-hidden className="size-4" /> Meals
            </ButtonLink>
          </div>
        }
      />
      <Suspense fallback={<Spinner label="Loading diary" />}>
        <Diary />
      </Suspense>
    </>
  );
}

function formatLongDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function Diary() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = useToday();
  const requested = params.get("date");
  const date = requested && isValidIsoDate(requested) ? requested : today;

  const goTo = (d: string) => router.replace(d === today ? pathname : `${pathname}?date=${d}`, { scroll: false });

  if (!date) return <Spinner label="Loading diary" />;
  return (
    <div className="space-y-4">
      <nav aria-label="Diary date" className="flex items-center gap-2">
        <button type="button" onClick={() => goTo(isoDaysAgo(date, 1))} aria-label="Previous day" className="inline-flex size-11 items-center justify-center rounded-xl border border-border-strong bg-surface-2 hover:bg-border">
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Date</span>
          <input
            type="date"
            value={date}
            min="1900-01-01"
            onChange={(e) => isValidIsoDate(e.target.value) && goTo(e.target.value)}
            className="block min-h-11 w-full rounded-xl border border-border-strong bg-surface-2 px-3 text-center text-text"
          />
        </label>
        <button type="button" onClick={() => goTo(isoDaysAgo(date, -1))} aria-label="Next day" className="inline-flex size-11 items-center justify-center rounded-xl border border-border-strong bg-surface-2 hover:bg-border">
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </nav>
      <p className="text-center text-sm text-muted" aria-live="polite">
        {date === today ? "Today · " : ""}
        {formatLongDate(date)}
        {date !== today && today && (
          <>
            {" · "}
            <button type="button" className="text-accent underline underline-offset-4" onClick={() => goTo(today)}>Back to today</button>
          </>
        )}
      </p>
      <DiaryDay key={date} date={date} />
    </div>
  );
}

function DiaryDay({ date }: { date: string }) {
  const entries = useDiaryDay(date);
  const target = useTargetForDate(date);
  const restore = useRestoreDiaryEntry();
  const [adding, setAdding] = useState<MealCategory | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const clearUndo = useCallback(() => setUndo(null), []);
  const undoSeq = useRef(0);

  if (!entries.data) {
    return <QueryState isPending={entries.isPending} error={entries.error} onRetry={() => entries.refetch()} loadingLabel="Loading diary" />;
  }

  const onDeleted = (e: DiaryEntry) =>
    setUndo({ id: ++undoSeq.current, message: `${e.food_name} removed`, undo: () => restore.mutate(e) });

  return (
    <>
      <Card>
        <DayTotals entries={entries.data.map((e) => ({ ...e, quantity: Number(e.quantity) }))} target={target.data} />
      </Card>
      {MEALS.map(({ meal }) => (
        <MealSection
          key={meal}
          meal={meal}
          entries={entries.data.filter((e) => e.meal === meal)}
          onAdd={() => setAdding(meal)}
          onDeleted={onDeleted}
        />
      ))}
      <AddFoodDialog open={adding !== null} onClose={() => setAdding(null)} date={date} meal={adding ?? "breakfast"} />
      <UndoToast action={undo} onDone={clearUndo} />
    </>
  );
}
