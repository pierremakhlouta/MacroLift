"use client";

import { useState } from "react";
import { MeasurementsSection } from "@/components/progress/measurements-section";
import { WeightSection } from "@/components/progress/weight-section";
import { PageHeader, cx } from "@/components/ui";
import { isoDaysAgo } from "@/lib/body/trend";
import { useToday } from "@/lib/hooks/use-today";
import { useUnitSystem } from "@/lib/queries/profile";

const RANGES = [
  { id: "30", label: "30 days", days: 30, phrase: "in the last 30 days" },
  { id: "90", label: "90 days", days: 90, phrase: "in the last 90 days" },
  { id: "365", label: "1 year", days: 365, phrase: "in the last year" },
  { id: "all", label: "All", days: null, phrase: "overall" },
] as const;

export default function ProgressPage() {
  const units = useUnitSystem();
  const today = useToday();
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("90");
  const range = RANGES.find((r) => r.id === rangeId)!;
  const from = range.days && today ? isoDaysAgo(today, range.days) : null;

  return (
    <>
      <PageHeader title="Progress" description="Body weight and measurements over time." />

      {/* One filter row above everything it scopes. */}
      <fieldset className="mb-5">
        <legend className="mb-1.5 text-sm font-medium">Period</legend>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <label
              key={r.id}
              className={cx(
                "inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-3 text-sm font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent",
                rangeId === r.id ? "border-accent bg-accent/10 text-text" : "border-border-strong bg-surface-2 text-muted",
              )}
            >
              <input type="radio" name="range" className="sr-only" checked={rangeId === r.id} onChange={() => setRangeId(r.id)} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-5">
        <WeightSection from={from} rangeLabel={range.phrase} units={units} />
        <MeasurementsSection from={from} rangeLabel={range.phrase} units={units} />
      </div>
    </>
  );
}
