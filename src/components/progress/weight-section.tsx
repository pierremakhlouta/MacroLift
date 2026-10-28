"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { TrendChart } from "@/components/charts/trend-chart";
import { UndoToast, type UndoAction } from "@/components/undo-toast";
import { Alert, Button, Card, EmptyState, QueryState, TextField } from "@/components/ui";
import { changeOver, since } from "@/lib/body/trend";
import { isValidIsoDate } from "@/lib/dates";
import { useToday } from "@/lib/hooks/use-today";
import { useDeleteWeight, useSaveWeight, useWeightEntries, type WeightEntry } from "@/lib/queries/body";
import { parseDecimal, roundTo, weightFromKg, weightInputValue, weightToKg, weightUnitLabel, type UnitSystem } from "@/lib/units";
import { bodyWeightKgSchema, firstError } from "@/lib/validation/profile";

export const formatDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function signed(n: number, decimals: number) {
  const r = roundTo(n, decimals);
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
}

export function WeightSection({ from, rangeLabel, units }: { from: string | null; rangeLabel: string; units: UnitSystem }) {
  const entries = useWeightEntries();
  const save = useSaveWeight();
  const del = useDeleteWeight();
  const today = useToday();
  const unit = weightUnitLabel(units);

  const [date, setDate] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ date?: string | null; weight?: string | null }>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const clearUndo = useCallback(() => setUndo(null), []);
  const undoSeq = useRef(0);
  const weightRef = useRef<HTMLInputElement>(null);

  const formDate = date ?? today;
  const all = entries.data ?? [];
  const inRange = from ? since(all.map((e) => ({ ...e, date: e.measured_on })), from) : all.map((e) => ({ ...e, date: e.measured_on }));
  const points = inRange.map((e) => ({ date: e.measured_on, value: roundTo(weightFromKg(e.weight_kg, units), 2) }));
  const change = changeOver(points);
  const existingForDate = all.find((e) => e.measured_on === formDate);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(null);
    const parsed = parseDecimal(weight);
    const kg = parsed.ok && parsed.value != null ? weightToKg(parsed.value, units) : null;
    const errs = {
      date: isValidIsoDate(formDate) ? (today && formDate > today ? "Date can't be in the future" : null) : "Enter a valid date",
      weight: !parsed.ok ? parsed.error : kg == null ? "Enter your weight" : firstError(bodyWeightKgSchema.safeParse(kg)),
    };
    setErrors(errs);
    if (errs.date || errs.weight) return;
    try {
      await save.mutateAsync({ measured_on: formDate, weight_kg: kg!, note: note.trim() || null });
      setSaved(`Saved ${weight} ${unit} for ${formatDay(formDate)}.`);
      setWeight("");
      setNote("");
      setDate(null);
    } catch {
      /* shown below */
    }
  }

  function edit(entry: WeightEntry) {
    setDate(entry.measured_on);
    setWeight(weightInputValue(entry.weight_kg, units, 2));
    setNote(entry.note ?? "");
    setSaved(null);
    weightRef.current?.focus();
  }

  async function remove(entry: WeightEntry) {
    await del.mutateAsync(entry.id);
    setUndo({
      id: ++undoSeq.current,
      message: `Weigh-in for ${formatDay(entry.measured_on)} deleted`,
      undo: () => save.mutate({ measured_on: entry.measured_on, weight_kg: entry.weight_kg, note: entry.note }),
    });
  }

  return (
    <Card aria-labelledby="weight-heading" className="space-y-5">
      <div>
        <h2 id="weight-heading" className="text-lg font-semibold">Body weight</h2>
        {change ? (
          <p className="mt-1 text-sm text-muted">
            <span className="font-semibold text-text">{signed(change.delta, 1)} {unit}</span> {rangeLabel} ({formatDay(change.from.date)} → {formatDay(change.to.date)})
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Log at least two weigh-ins to see a trend.</p>
        )}
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-3" aria-label="Log weight">
        {saved && <Alert tone="success">{saved}</Alert>}
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={formDate} max={today || undefined} min="1900-01-01" onChange={(e) => setDate(e.target.value)} error={errors.date} />
          <TextField ref={weightRef} label="Weight" inputMode="decimal" suffix={unit} value={weight} onChange={(e) => setWeight(e.target.value)} error={errors.weight} />
        </div>
        <TextField label="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.isPending}>Save weigh-in</Button>
          {existingForDate && <p className="text-xs text-muted">Replaces the weigh-in already logged for this date.</p>}
        </div>
      </form>

      <QueryState isPending={entries.isPending} error={entries.error} onRetry={() => entries.refetch()} loadingLabel="Loading weigh-ins" />
      {entries.isSuccess && points.length === 0 && (
        <EmptyState title={all.length ? "No weigh-ins in this period" : "No weigh-ins yet"}>
          {all.length ? "Choose a longer period above." : "Your trend chart appears after your first entries."}
        </EmptyState>
      )}

      {points.length > 0 && (
        <>
          <TrendChart
            points={points}
            unit={unit}
            label={`Body weight trend, ${points.length} ${points.length === 1 ? "weigh-in" : "weigh-ins"} from ${formatDay(points[0].date)} to ${formatDay(points[points.length - 1].date)}, ${points[0].value} to ${points[points.length - 1].value} ${unit}`}
          />
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Weigh-ins, newest first</caption>
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Weight</th>
                  <th scope="col" className="w-24 px-1 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {[...inRange].reverse().map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-1.5">
                      {formatDay(e.measured_on)}
                      {e.note && <span className="block truncate text-xs text-muted">{e.note}</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {roundTo(weightFromKg(e.weight_kg, units), 1).toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
                    </td>
                    <td className="px-1 py-1 text-right">
                      <button type="button" onClick={() => edit(e)} aria-label={`Edit weigh-in for ${formatDay(e.measured_on)}`} className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
                        <Pencil aria-hidden className="size-4" />
                      </button>
                      <button type="button" onClick={() => remove(e)} aria-label={`Delete weigh-in for ${formatDay(e.measured_on)}`} className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <UndoToast action={undo} onDone={clearUndo} />
    </Card>
  );
}
