"use client";

import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import type { LoadType } from "@/lib/exercises/catalog";
import {
  distanceInputValue,
  distanceToM,
  distanceUnitLabel,
  durationInputValue,
  parseDecimal,
  parseDuration,
  parseInteger,
  weightInputValue,
  weightToKg,
  weightUnitLabel,
  type UnitSystem,
} from "@/lib/units";
import { isSetDone, type LocalSet, type SetPatch } from "@/lib/workouts/sync-core";

export const weightColumnLabel = (loadType: LoadType) =>
  loadType === "bodyweight" ? "+ Weight" : loadType === "assisted" ? "Assist" : "Weight";

const MAX_WEIGHT_KG = 2000;
const MAX_REPS = 10000;
const MAX_DISTANCE_M = 1_000_000;
const MAX_SECONDS = 86_400;

const inputClass =
  "block min-h-11 w-full min-w-0 rounded-lg border border-border-strong bg-surface-2 px-2 text-center text-base tabular-nums text-text aria-[invalid=true]:border-danger";

/** One labelled set input with its inline error. */
function SetInput({
  id,
  label,
  placeholder,
  inputMode,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  inputMode: "decimal" | "numeric" | "text";
  value: string;
  error: string | null;
  onChange: (text: string) => void;
}) {
  return (
    <div>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        inputMode={inputMode}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className={inputClass}
      />
      {error && (
        <p id={`${id}-err`} className="mt-1 text-[11px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * One set: weight (in the user's units) and reps, or for cardio distance (km / mi) and time. Inputs keep the typed text; valid values are
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
  onChange: (patch: SetPatch) => void;
  onRemove: () => void;
}) {
  const [weight, setWeight] = useState(() => weightInputValue(set.weight_kg, units, 2));
  const [reps, setReps] = useState(() => (set.reps == null ? "" : String(set.reps)));
  const [distance, setDistance] = useState(() => distanceInputValue(set.distance_m, units));
  const [time, setTime] = useState(() => durationInputValue(set.duration_seconds));
  const [weightError, setWeightError] = useState<string | null>(null);
  const [repsError, setRepsError] = useState<string | null>(null);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const unit = weightUnitLabel(units);
  const label = `${exerciseName}, set ${index + 1}`;
  const logged = isSetDone(set, loadType);

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

  function onDistance(text: string) {
    setDistance(text);
    const r = parseDecimal(text);
    if (!r.ok) return setDistanceError(r.error);
    if (r.value != null && r.value < 0) return setDistanceError("Can't be negative");
    const m = r.value == null ? null : distanceToM(r.value, units);
    if (m != null && m >= MAX_DISTANCE_M) return setDistanceError("Too far");
    setDistanceError(null);
    onChange({ distance_m: m });
  }

  function onTime(text: string) {
    setTime(text);
    const r = parseDuration(text);
    if (!r.ok) return setTimeError(r.error);
    if (r.value != null && r.value > MAX_SECONDS) return setTimeError("Up to 24 hours");
    setTimeError(null);
    onChange({ duration_seconds: r.value });
  }

  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] items-start gap-2">
      <span aria-hidden className="flex min-h-11 items-center justify-center text-sm font-semibold text-muted">
        {index + 1}
      </span>
      {loadType === "cardio" ? (
        <>
          <SetInput
            id={`d-${set.id}`}
            label={`${label} distance in ${distanceUnitLabel(units)}`}
            placeholder={distanceUnitLabel(units)}
            inputMode="decimal"
            value={distance}
            error={distanceError}
            onChange={onDistance}
          />
          <SetInput
            id={`t-${set.id}`}
            label={`${label} time, in minutes or minutes:seconds`}
            placeholder="min"
            inputMode="text"
            value={time}
            error={timeError}
            onChange={onTime}
          />
        </>
      ) : (
        <>
          <SetInput
            id={`w-${set.id}`}
            label={`${label} ${weightColumnLabel(loadType).toLowerCase()} in ${unit}`}
            placeholder={unit}
            inputMode="decimal"
            value={weight}
            error={weightError}
            onChange={onWeight}
          />
          <SetInput
            id={`r-${set.id}`}
            label={`${label} reps`}
            placeholder="reps"
            inputMode="numeric"
            value={reps}
            error={repsError}
            onChange={onReps}
          />
        </>
      )}
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
