"use client";

import { LineChart, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { fmtNutrient } from "@/components/nutrition/format";
import { formatDay, signed } from "@/components/progress/weight-section";
import { ButtonLink, Card } from "@/components/ui";
import { changeOver, isoDaysAgo, since } from "@/lib/body/trend";
import { useToday } from "@/lib/hooks/use-today";
import { dayTotals, remainingFor } from "@/lib/nutrition/totals";
import { useWeightEntries } from "@/lib/queries/body";
import { useDiaryDay, useTargetForDate } from "@/lib/queries/nutrition";
import { formatWeight, weightFromKg, weightUnitLabel, type UnitSystem } from "@/lib/units";

export function NutritionTodayCard() {
  const today = useToday();
  return (
    <Card aria-labelledby="today-nutrition">
      <div className="flex items-center gap-3">
        <UtensilsCrossed aria-hidden className="size-5 text-accent" />
        <h2 id="today-nutrition" className="text-lg font-semibold">Nutrition today</h2>
      </div>
      {today ? <NutritionToday date={today} /> : <p className="mt-2 text-sm text-muted">Loading…</p>}
    </Card>
  );
}

function NutritionToday({ date }: { date: string }) {
  const entries = useDiaryDay(date);
  const target = useTargetForDate(date);
  if (!entries.data) return <p className="mt-2 text-sm text-muted">{entries.error ? "Couldn't load your diary." : "Loading…"}</p>;
  const totals = dayTotals(entries.data.map((e) => ({ ...e, quantity: Number(e.quantity) })));
  const kcalTarget = target.data?.calories_kcal ?? null;
  const rem = remainingFor(kcalTarget, totals.calories_kcal);
  const p = (k: keyof typeof totals) => `${totals[k].partial && totals[k].total != null ? "≥ " : ""}${fmtNutrient(totals[k].total ?? (totals[k].missing ? null : 0), k)}`;

  return (
    <div className="mt-2 space-y-3">
      {entries.data.length === 0 ? (
        <p className="text-sm text-muted">Nothing logged yet today.</p>
      ) : (
        <>
          <p className="text-sm">
            <strong className="text-lg">{p("calories_kcal")}</strong>
            {kcalTarget != null && (
              <span className="text-muted">
                {" "}
                of {fmtNutrient(kcalTarget, "calories_kcal")} · {rem.over ? `${fmtNutrient(-rem.remaining!, "calories_kcal")} over` : `${fmtNutrient(rem.remaining!, "calories_kcal")} left`}
              </span>
            )}
          </p>
          <p className="text-sm text-muted">
            Protein {p("protein_g")} · Carbs {p("carbs_g")} · Fat {p("fat_g")}
          </p>
        </>
      )}
      <ButtonLink href="/nutrition" variant="secondary">Open diary</ButtonLink>
    </div>
  );
}

export function RecentProgressCard({ units }: { units: UnitSystem }) {
  const entries = useWeightEntries();
  const today = useToday();
  const all = (entries.data ?? []).map((e) => ({ date: e.measured_on, value: e.weight_kg }));
  const latest = all[all.length - 1];
  const change = today ? changeOver(since(all, isoDaysAgo(today, 30))) : null;
  const unit = weightUnitLabel(units);

  return (
    <Card aria-labelledby="recent-progress">
      <div className="flex items-center gap-3">
        <LineChart aria-hidden className="size-5 text-accent" />
        <h2 id="recent-progress" className="text-lg font-semibold">Recent progress</h2>
      </div>
      {latest ? (
        <div className="mt-2 space-y-1 text-sm">
          <p>
            Latest weigh-in: <strong>{formatWeight(latest.value, units)}</strong> <span className="text-muted">on {formatDay(latest.date)}</span>
          </p>
          {change && (
            <p className="text-muted">
              {signed(weightFromKg(change.delta, units), 1)} {unit} in the last 30 days
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">{entries.isPending ? "Loading…" : "No weigh-ins yet."}</p>
      )}
      <Link href="/progress" className="mt-2 inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">
        {latest ? "See trends" : "Log your weight"}
      </Link>
    </Card>
  );
}
