"use client";

import { Calculator } from "lucide-react";
import Link from "next/link";
import { formatDay } from "@/components/progress/weight-section";
import { Alert, Card } from "@/components/ui";
import { daysBetween } from "@/lib/body/trend";
import { APP_NAME } from "@/lib/brand";
import { ageInYears } from "@/lib/dates";
import { useToday } from "@/lib/hooks/use-today";
import { maintenanceEstimate, roundKcal, SEX_CONSTANT, type MissingInput } from "@/lib/nutrition/maintenance";
import { useLatestWeight, useProfile } from "@/lib/queries/profile";
import { formatHeight, formatWeight, roundTo, type UnitSystem } from "@/lib/units";
import { ACTIVITY_LEVEL_LABELS } from "@/lib/validation/profile";

const MISSING_LABELS: Record<MissingInput, string> = {
  weight: "a weigh-in",
  height: "your height",
  age: "your date of birth",
  coefficient: "the formula coefficient",
  activity: "your activity level",
};

const STALE_WEIGHT_DAYS = 30;

const n = (v: number, decimals = 0) => v.toLocaleString(undefined, { maximumFractionDigits: decimals });

function listJoin(items: string[]) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Maintenance estimate with every input and step shown. Informational only: it is visually
 * separate from targets and offers no way to turn the estimate into a target.
 */
export function MaintenanceCard({ units, showEditLink = true }: { units: UnitSystem; showEditLink?: boolean }) {
  const profile = useProfile();
  const weight = useLatestWeight();
  const today = useToday();

  return (
    <Card aria-labelledby="estimate-result-heading">
      <div className="flex items-center gap-3">
        <Calculator aria-hidden className="size-5 text-muted" />
        <h2 id="estimate-result-heading" className="text-lg font-semibold">Maintenance estimate</h2>
      </div>
      <p className="mt-1 text-sm text-muted">For reference only. It is not your target and never changes it.</p>
      {!profile.data || weight.isPending || !today ? (
        <p className="mt-3 text-sm text-muted">{profile.error || weight.error ? "Couldn't load your details." : "Loading…"}</p>
      ) : (
        <EstimateBody
          today={today}
          units={units}
          profile={profile.data}
          weight={weight.data ?? null}
          showEditLink={showEditLink}
        />
      )}
    </Card>
  );
}

function EstimateBody({
  today,
  units,
  profile,
  weight,
  showEditLink,
}: {
  today: string;
  units: UnitSystem;
  profile: NonNullable<ReturnType<typeof useProfile>["data"]>;
  weight: { measured_on: string; weight_kg: number } | null;
  showEditLink: boolean;
}) {
  const ageYears = profile.birth_date ? ageInYears(profile.birth_date, today) : null;
  const est = maintenanceEstimate({
    weightKg: weight?.weight_kg ?? null,
    heightCm: profile.height_cm,
    ageYears,
    sex: profile.estimate_sex,
    activity: profile.activity_level,
  });
  const editLink = showEditLink && (
    <Link href="/profile" className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">
      {est.ok ? "Edit estimate details" : "Add details in Profile"}
    </Link>
  );

  if (!est.ok) {
    return (
      <div className="mt-3 space-y-1">
        <p className="text-sm">To see an estimate, add {listJoin(est.missing.map((m) => MISSING_LABELS[m]))}.</p>
        {editLink}
      </div>
    );
  }

  const { inputs } = est;
  const weightAge = daysBetween(weight!.measured_on, today);
  const constant = SEX_CONSTANT[inputs.sex];

  return (
    <div className="mt-3 space-y-4">
      <p>
        <span className="text-3xl font-bold tabular-nums">≈ {n(roundKcal(est.maintenanceKcal))}</span>{" "}
        <span className="text-muted">kcal per day</span>
      </p>

      {weightAge > STALE_WEIGHT_DAYS && (
        <Alert tone="warning">
          Your latest weigh-in is from {formatDay(weight!.measured_on)}. Log a current weight on Progress for an up-to-date estimate.
        </Alert>
      )}

      <section aria-labelledby="estimate-working" className="rounded-xl bg-surface-2 p-3 text-sm">
        <h3 id="estimate-working" className="font-medium">How it&apos;s worked out</h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted">Weight</dt>
          <dd>
            {formatWeight(inputs.weightKg, units)}
            {units === "imperial" && ` (${n(inputs.weightKg, 1)} kg)`} · weigh-in on {formatDay(weight!.measured_on)}
          </dd>
          <dt className="text-muted">Height</dt>
          <dd>
            {formatHeight(inputs.heightCm, units)}
            {units === "imperial" && ` (${n(inputs.heightCm, 1)} cm)`}
          </dd>
          <dt className="text-muted">Age</dt>
          <dd>{inputs.ageYears} years</dd>
          <dt className="text-muted">Coefficient</dt>
          <dd>
            {inputs.sex === "male" ? "Male" : "Female"} ({constant > 0 ? "+" : "−"}
            {Math.abs(constant)}), as you chose
          </dd>
          <dt className="text-muted">Activity</dt>
          <dd>
            {ACTIVITY_LEVEL_LABELS[inputs.activity].label} (× {est.factor})
          </dd>
        </dl>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>
            Resting estimate (Mifflin–St Jeor): 10 × {n(inputs.weightKg, 1)} kg + 6.25 × {n(inputs.heightCm, 1)} cm − 5 ×{" "}
            {inputs.ageYears} {constant > 0 ? "+" : "−"} {Math.abs(constant)} = <strong>{n(roundTo(est.restingKcal))} kcal</strong>
          </li>
          <li>
            × {est.factor} for activity = <strong>{n(roundTo(est.maintenanceKcal))} kcal</strong>, shown rounded to the nearest 10.
          </li>
        </ol>
      </section>

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        <li>This is a population-average formula. Real needs commonly differ from it by 10% or more.</li>
        <li>It was developed from studies of adults and doesn&apos;t account for body composition, pregnancy, illness, or medication.</li>
        <li>Exercise calories are never added or subtracted anywhere in {APP_NAME}; the activity factor is the only adjustment.</li>
        <li>Not medical advice. Your target is always the one you set yourself.</li>
      </ul>
      {editLink}
    </div>
  );
}
