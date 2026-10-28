"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { TrendChart } from "@/components/charts/trend-chart";
import { UndoToast, type UndoAction } from "@/components/undo-toast";
import { Alert, Button, Card, EmptyState, QueryState, SelectField, TextField } from "@/components/ui";
import { changeOver, since } from "@/lib/body/trend";
import { isValidIsoDate } from "@/lib/dates";
import { useToday } from "@/lib/hooks/use-today";
import {
  MEASUREMENT_SITES,
  siteLabel,
  useDeleteMeasurement,
  useMeasurements,
  useSaveMeasurements,
  type Measurement,
  type MeasurementSite,
} from "@/lib/queries/body";
import { lengthFromCm, lengthToCm, lengthUnitLabel, parseDecimal, roundTo, type UnitSystem } from "@/lib/units";
import { formatDay, signed } from "./weight-section";

const PRIMARY_SITES: MeasurementSite[] = ["waist", "hips", "chest"];

export function MeasurementsSection({ from, rangeLabel, units }: { from: string | null; rangeLabel: string; units: UnitSystem }) {
  const measurements = useMeasurements();
  const save = useSaveMeasurements();
  const del = useDeleteMeasurement();
  const today = useToday();
  const unit = lengthUnitLabel(units);

  const [date, setDate] = useState<string | null>(null);
  const [values, setValues] = useState<Partial<Record<MeasurementSite, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<MeasurementSite | "date", string>>>({});
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [chosenSite, setChosenSite] = useState<MeasurementSite | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const clearUndo = useCallback(() => setUndo(null), []);
  const undoSeq = useRef(0);

  const formDate = date ?? today;
  const all = measurements.data ?? [];
  const sitesWithData = MEASUREMENT_SITES.filter((s) => all.some((m) => m.site === s.site));
  const site = chosenSite && sitesWithData.some((s) => s.site === chosenSite) ? chosenSite : (sitesWithData[0]?.site ?? null);
  const forSite = all.filter((m) => m.site === site).map((m) => ({ ...m, date: m.measured_on }));
  const inRange = from ? since(forSite, from) : forSite;
  const points = inRange.map((m) => ({ date: m.measured_on, value: roundTo(lengthFromCm(m.value_cm, units), 2) }));
  const change = changeOver(points);
  const visibleSites = showAll ? MEASUREMENT_SITES : MEASUREMENT_SITES.filter((s) => PRIMARY_SITES.includes(s.site));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(null);
    const errs: typeof errors = {};
    if (!isValidIsoDate(formDate)) errs.date = "Enter a valid date";
    else if (today && formDate > today) errs.date = "Date can't be in the future";
    const rows: { measured_on: string; site: MeasurementSite; value_cm: number }[] = [];
    for (const { site: s } of MEASUREMENT_SITES) {
      const r = parseDecimal(values[s]);
      if (!r.ok) errs[s] = r.error;
      else if (r.value != null) {
        const cm = lengthToCm(r.value, units);
        if (cm <= 0 || cm >= 500) errs[s] = "Enter a realistic value";
        else rows.push({ measured_on: formDate, site: s, value_cm: cm });
      }
    }
    if (!rows.length && !Object.keys(errs).length) errs.waist = "Enter at least one measurement";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync(rows);
      setSaved(`Saved ${rows.length} ${rows.length === 1 ? "measurement" : "measurements"} for ${formatDay(formDate)}.`);
      setValues({});
      setDate(null);
      if (!site) setChosenSite(rows[0].site);
    } catch {
      /* shown below */
    }
  }

  async function remove(m: Measurement) {
    await del.mutateAsync(m.id);
    setUndo({
      id: ++undoSeq.current,
      message: `${siteLabel(m.site)} for ${formatDay(m.measured_on)} deleted`,
      undo: () => save.mutate([{ measured_on: m.measured_on, site: m.site, value_cm: m.value_cm }]),
    });
  }

  return (
    <Card aria-labelledby="measure-heading" className="space-y-5">
      <div>
        <h2 id="measure-heading" className="text-lg font-semibold">Body measurements</h2>
        <p className="mt-1 text-sm text-muted">Optional. Fill in only the ones you track.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-3" aria-label="Log measurements">
        {saved && <Alert tone="success">{saved}</Alert>}
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <TextField label="Date" type="date" value={formDate} max={today || undefined} min="1900-01-01" onChange={(e) => setDate(e.target.value)} error={errors.date} className="max-w-[12rem]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleSites.map(({ site: s, label }) => (
            <TextField
              key={s}
              label={label}
              inputMode="decimal"
              suffix={unit}
              value={values[s] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [s]: e.target.value }))}
              error={errors[s]}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.isPending}>Save measurements</Button>
          <Button type="button" variant="ghost" aria-expanded={showAll} onClick={() => setShowAll((x) => !x)}>
            {showAll ? "Fewer sites" : "More sites"}
          </Button>
        </div>
      </form>

      <QueryState isPending={measurements.isPending} error={measurements.error} onRetry={() => measurements.refetch()} loadingLabel="Loading measurements" />
      {measurements.isSuccess && sitesWithData.length === 0 && <EmptyState title="No measurements yet">Your trend appears after you log some.</EmptyState>}

      {site && (
        <div className="space-y-3">
          <SelectField label="Show trend for" value={site} onChange={(e) => setChosenSite(e.target.value as MeasurementSite)} className="max-w-[16rem]">
            {sitesWithData.map((s) => (
              <option key={s.site} value={s.site}>{s.label}</option>
            ))}
          </SelectField>
          {change && (
            <p className="text-sm text-muted">
              <span className="font-semibold text-text">{signed(change.delta, 1)} {unit}</span> {rangeLabel}
            </p>
          )}
          {points.length === 0 ? (
            <EmptyState title="No entries in this period">Choose a longer period above.</EmptyState>
          ) : (
            <>
              <TrendChart
                points={points}
                unit={unit}
                label={`${siteLabel(site)} trend, ${points.length} entries from ${formatDay(points[0].date)} to ${formatDay(points[points.length - 1].date)}`}
              />
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <caption className="sr-only">{siteLabel(site)} measurements, newest first</caption>
                  <thead className="bg-surface-2 text-left text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Date</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{siteLabel(site)}</th>
                      <th scope="col" className="w-12 px-1 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...inRange].reverse().map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{formatDay(m.measured_on)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {roundTo(lengthFromCm(m.value_cm, units), 1)} {unit}
                        </td>
                        <td className="px-1 py-1 text-right">
                          <button type="button" onClick={() => remove(m)} aria-label={`Delete ${siteLabel(m.site)} for ${formatDay(m.measured_on)}`} className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
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
        </div>
      )}
      <UndoToast action={undo} onDone={clearUndo} />
    </Card>
  );
}
