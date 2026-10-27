"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, SegmentedRadio, SelectField, TextField } from "@/components/ui";
import { todayIsoDate } from "@/lib/dates";
import type { Profile } from "@/lib/queries/profile";
import {
  cmToFeetInches,
  feetInchesToCm,
  lengthInputValue,
  parseDecimal,
  roundTo,
  weightInputValue,
  weightToKg,
  weightUnitLabel,
  type UnitSystem,
} from "@/lib/units";
import {
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVELS,
  bodyWeightKgSchema,
  firstError,
  profileUpdateSchema,
  type ActivityLevel,
  type EstimateSex,
  type ProfileUpdate,
} from "@/lib/validation/profile";

export type EstimateDetailsValues = {
  profile: Pick<ProfileUpdate, "birth_date" | "height_cm" | "estimate_sex" | "activity_level">;
  /** New weigh-in for today in kg, or null when unchanged/blank. */
  weightKg: number | null;
};

/**
 * Optional inputs for the maintenance estimate. Every field may be left blank.
 * The Mifflin–St Jeor coefficient is an explicit choice and never inferred.
 */
export function EstimateDetailsForm({
  profile,
  units,
  latestWeightKg,
  submitLabel,
  secondaryAction,
  onSubmit,
}: {
  profile: Profile;
  units: UnitSystem;
  latestWeightKg: number | null;
  submitLabel: string;
  secondaryAction?: ReactNode;
  onSubmit: (values: EstimateDetailsValues) => Promise<void>;
}) {
  const initialFtIn = profile.height_cm != null ? cmToFeetInches(profile.height_cm) : null;
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? "");
  const [heightCm, setHeightCm] = useState(lengthInputValue(profile.height_cm, "metric"));
  const [heightFt, setHeightFt] = useState(initialFtIn ? String(initialFtIn.feet) : "");
  const [heightIn, setHeightIn] = useState(initialFtIn ? String(initialFtIn.inches) : "");
  const [weight, setWeight] = useState(weightInputValue(latestWeightKg, units, 1));
  const [activity, setActivity] = useState<ActivityLevel | "">(profile.activity_level ?? "");
  const [sex, setSex] = useState<EstimateSex | null>(profile.estimate_sex);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function parseHeight(): { value: number | null; error: string | null } {
    if (units === "metric") {
      const r = parseDecimal(heightCm);
      return r.ok ? { value: r.value, error: null } : { value: null, error: r.error };
    }
    const ft = parseDecimal(heightFt);
    const inch = parseDecimal(heightIn);
    if (!ft.ok) return { value: null, error: ft.error };
    if (!inch.ok) return { value: null, error: inch.error };
    if (ft.value == null && inch.value == null) return { value: null, error: null };
    if ((inch.value ?? 0) < 0 || (inch.value ?? 0) >= 12) return { value: null, error: "Inches must be 0–11.9" };
    return { value: feetInchesToCm(ft.value ?? 0, inch.value ?? 0), error: null };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const height = parseHeight();
    const weightParsed = parseDecimal(weight);
    const weightKg = weightParsed.ok && weightParsed.value != null ? weightToKg(weightParsed.value, units) : null;

    const profileUpdate = {
      birth_date: birthDate || null,
      height_cm: height.value,
      estimate_sex: sex,
      activity_level: activity || null,
    };
    const parsed = profileUpdateSchema.safeParse(profileUpdate);
    const fieldErrors: Record<string, string | null> = {
      birth_date: null,
      height: height.error,
      weight: weightParsed.ok ? (weightKg != null ? firstError(bodyWeightKgSchema.safeParse(weightKg)) : null) : weightParsed.error,
    };
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "height_cm" ? "height" : String(issue.path[0]);
        fieldErrors[key] ??= issue.message;
      }
    }
    setErrors(fieldErrors);
    if (Object.values(fieldErrors).some(Boolean)) return;

    const unchangedWeight =
      latestWeightKg != null && weightKg != null && roundTo(weightKg, 3) === roundTo(latestWeightKg, 3);
    setSaving(true);
    try {
      await onSubmit({ profile: parsed.data!, weightKg: unchangedWeight ? null : weightKg });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const unitLabel = weightUnitLabel(units);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {submitError && <Alert tone="error">{submitError}</Alert>}

      <TextField
        label="Date of birth"
        type="date"
        max={todayIsoDate()}
        min="1900-01-01"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        error={errors.birth_date}
        hint="Used only to work out your age for the estimate."
      />

      {units === "metric" ? (
        <TextField
          label="Height"
          inputMode="decimal"
          suffix="cm"
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          error={errors.height}
        />
      ) : (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Height</legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Feet" inputMode="numeric" suffix="ft" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
            <TextField label="Inches" inputMode="decimal" suffix="in" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
          </div>
          {errors.height && <p className="text-xs font-medium text-danger">{errors.height}</p>}
        </fieldset>
      )}

      <TextField
        label="Current body weight"
        inputMode="decimal"
        suffix={unitLabel}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        error={errors.weight}
        hint="Saved as today's weigh-in on your Progress page."
      />

      <SelectField
        label="Activity level"
        value={activity}
        onChange={(e) => setActivity(e.target.value as ActivityLevel | "")}
        error={errors.activity_level}
      >
        <option value="">Not set</option>
        {ACTIVITY_LEVELS.map((level) => (
          <option key={level} value={level}>
            {ACTIVITY_LEVEL_LABELS[level].label} — {ACTIVITY_LEVEL_LABELS[level].description}
          </option>
        ))}
      </SelectField>

      <SegmentedRadio
        legend="Formula coefficient"
        name="estimate_sex"
        value={sex}
        onChange={setSex}
        hint="The Mifflin–St Jeor formula uses a different constant for male (+5) and female (−161). Choose the one you want applied to your estimate."
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
      />
      {sex && (
        <button type="button" className="text-xs text-muted underline underline-offset-4 hover:text-text" onClick={() => setSex(null)}>
          Clear coefficient choice
        </button>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {secondaryAction}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
