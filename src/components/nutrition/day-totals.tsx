"use client";

import { AlertTriangle, Info } from "lucide-react";
import { fmtNutrient } from "@/components/nutrition/format";
import { cx } from "@/components/ui";
import { dayTotals, NUTRIENT_LABELS, remainingFor, type LoggedEntry, type NutrientKey } from "@/lib/nutrition/totals";
import type { NutritionTarget } from "@/lib/queries/nutrition";

const ROWS: NutrientKey[] = ["protein_g", "carbs_g", "fat_g", "fiber_g"];

/** Meter: fill = logged share of the user's own target. Over target uses the warning status + icon + text. */
function Meter({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / target) * 100));
  const over = value > target;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(target)}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)} of ${Math.round(target)}${over ? ", over target" : ""}`}
      className="h-2 w-full overflow-hidden rounded-full bg-border"
    >
      <div className={cx("h-full rounded-full", over ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DayTotals({ entries, target }: { entries: LoggedEntry[]; target: NutritionTarget | null | undefined }) {
  const totals = dayTotals(entries);
  const kcal = totals.calories_kcal;
  const kcalTarget = target?.calories_kcal ?? null;
  const rem = remainingFor(kcalTarget, kcal);
  // "≥" only qualifies a number: a nutrient with no known values is simply "unknown".
  const prefix = (t: { partial: boolean; total: number | null }) => (t.partial && t.total != null ? "≥ " : "");
  const anyPartial = Object.values(totals).some((t) => t.partial && t.known + t.missing > 0);

  return (
    <section aria-labelledby="totals-heading" className="space-y-4">
      <h2 id="totals-heading" className="sr-only">Daily totals</h2>
      <div>
        <p className="text-sm text-muted">Calories</p>
        <p className="text-3xl font-bold">
          {prefix(kcal)}
          {kcal.total == null ? (kcal.missing ? "unknown" : "0") : fmtNutrient(kcal.total, "calories_kcal", false)}
          {" "}
          <span className="text-base font-medium text-muted">
            {kcalTarget != null ? `/ ${fmtNutrient(kcalTarget, "calories_kcal")}` : "kcal"}
          </span>
        </p>
        {kcalTarget != null && (
          <>
            <div className="mt-2">
              <Meter value={kcal.total ?? 0} target={kcalTarget} label="Calories logged against your target" />
            </div>
            <p className={cx("mt-1.5 flex items-center gap-1.5 text-sm", rem.over ? "text-warn" : "text-muted")}>
              {rem.over && <AlertTriangle aria-hidden className="size-4" />}
              {rem.over
                ? `${fmtNutrient(-rem.remaining!, "calories_kcal")} over target`
                : `${rem.uncertain ? "At most " : ""}${fmtNutrient(rem.remaining!, "calories_kcal")} left`}
            </p>
          </>
        )}
        {kcalTarget == null && <p className="mt-1 text-xs text-muted">No calorie target set.</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROWS.map((k) => {
          const t = totals[k];
          const tgt = target?.[k] ?? null;
          const r = remainingFor(tgt, t);
          return (
            <div key={k} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">{NUTRIENT_LABELS[k].label}</dt>
              <dd>
                <span className="font-semibold tabular-nums">
                  {prefix(t)}
                  {t.total == null ? (t.missing ? "unknown" : "0 g") : fmtNutrient(t.total, k)}
                </span>
                {tgt != null && <span className="text-xs text-muted"> / {fmtNutrient(tgt, k)}</span>}
                {tgt != null && (
                  <div className="mt-1.5">
                    <Meter value={t.total ?? 0} target={tgt} label={`${NUTRIENT_LABELS[k].label} logged against your target`} />
                    {r.over && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-warn">
                        <AlertTriangle aria-hidden className="size-3" /> over by {fmtNutrient(-r.remaining!, k)}
                      </p>
                    )}
                  </div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {anyPartial && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Totals marked ≥ are partial: some logged items have unknown values for that nutrient, so the real total may be higher.
        </p>
      )}
      <p className="text-xs text-muted">Exercise is never added to or subtracted from your calorie budget.</p>
    </section>
  );
}
