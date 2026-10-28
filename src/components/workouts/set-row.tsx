"use client";

import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import type { LoadType } from "@/lib/exercises/catalog";
import { parseDecimal, parseInteger, weightInputValue, weightToKg, weightUnitLabel, type UnitSystem } from "@/lib/units";
import type { LocalSet } from "@/lib/workouts/sync-core";

export const weightColumnLabel = (loadType: LoadType) =>
  loadType === "bodyweight" ? "+ Weight" : loadType === "assisted" ? "Assist" : "Weight";

const MAX_WEIGHT_KG = 2000;
const MAX_REPS = 10000;

/**
 * One set: weight (in the user's units) and reps. Inputs keep the typed text; valid values are
 * converted to kg and saved immediately, invalid ones show an inline error and are not saved.
 * Blank stays blank (null), never zero.
 */
export function SetRow({
  set,
  index,
  units,
  loadType,
  exerciseName,
  onChange,
  onRemove,
}: {
  set: LocalSet;
  index: number;
  units: UnitSystem;
  loadType: LoadType;
  exerciseName: string;
  onChange: (patch: { reps?: number | null; weight_kg?: number | null }) => void;
  onRemove: () => void;
}) {
  const [weight, setWeight] = useState(() => weightInputValue(set.weight_kg, units, 2));
  const [reps, setReps] = useState(() => (set.reps == null ? "" : String(set.reps)));
  const [weightError, setWeightError] = useState<string | null>(null);
  const [repsError, setRepsError] = useState<string | null>(null);
  const unit = weightUnitLabel(units);
  const label = `${exerciseName}, set ${index + 1}`;
  const logged = set.reps != null && set.reps > 0;

  function onWeight(text: string) {
    setWeight(text);
    const r = parseDecimal(text);
    if (!r.ok) return setWeightError(r.error);
    if (r.value != null && r.value < 0) return setWeightError("Can't be negative");
    const kg = r.value == null ? null : weightToKg(r.value, units);
    if (kg != null && kg >= MAX_WEIGHT_KG) return setWeightError("Too heavy");
    setWeightError(null);
    onChange({ weight_kg: kg });
  }

  function onReps(text: string) {
    setReps(text);
    const r = parseInteger(text);
    if (!r.ok) return setRepsError(r.error);
    if (r.value != null && (r.value < 0 || r.value > MAX_REPS)) return setRepsError("Enter 0–10000");
    setRepsError(null);
    onChange({ reps: r.value });
  }

  const inputClass =
    "block min-h-11 w-full min-w-0 rounded-lg border border-border-strong bg-surface-2 px-2 text-center text-base tabular-nums text-text aria-[invalid=true]:border-danger";

  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] items-start gap-2">
      <span aria-hidden className="flex min-h-11 items-center justify-center text-sm font-semibold text-muted">
        {index + 1}
      </span>
      <div>
        <label className="sr-only" htmlFor={`w-${set.id}`}>
          {`${label} ${weightColumnLabel(loadType).toLowerCase()} in ${unit}`}
        </label>
        <input
          id={`w-${set.id}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder={unit}
          value={weight}
          onChange={(e) => onWeight(e.target.value)}
          aria-invalid={weightError ? true : undefined}
          aria-describedby={weightError ? `w-${set.id}-err` : undefined}
          className={inputClass}
        />
        {weightError && (
          <p id={`w-${set.id}-err`} className="mt-1 text-[11px] font-medium text-danger">
            {weightError}
          </p>
        )}
      </div>
      <div>
        <label className="sr-only" htmlFor={`r-${set.id}`}>
          {`${label} reps`}
        </label>
        <input
          id={`r-${set.id}`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="reps"
          value={reps}
          onChange={(e) => onReps(e.target.value)}
          aria-invalid={repsError ? true : undefined}
          aria-describedby={repsError ? `r-${set.id}-err` : undefined}
          className={inputClass}
        />
        {repsError && (
          <p id={`r-${set.id}-err`} className="mt-1 text-[11px] font-medium text-danger">
            {repsError}
          </p>
        )}
      </div>
      <span
        className={cx(
          "flex min-h-11 items-center justify-center rounded-lg",
          logged ? "bg-ok-bg text-ok" : "text-border-strong",
        )}
      >
        <Check aria-hidden className="size-5" />
        <span className="sr-only">{logged ? "Logged" : "Not logged yet"}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
    </li>
  );
}
