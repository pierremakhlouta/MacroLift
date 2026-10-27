"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, SelectField, TextField } from "@/components/ui";
import {
  EQUIPMENT,
  LOAD_TYPES,
  MUSCLE_REGIONS,
  MUSCLES,
  type Equipment,
  type LoadType,
  type MuscleGroup,
} from "@/lib/exercises/catalog";
import { useSaveExercise, type Exercise } from "@/lib/queries/exercises";
import { exerciseSchema } from "@/lib/validation/exercise";

export function ExerciseForm({
  exercise,
  initialName = "",
  onSaved,
  onCancel,
}: {
  exercise?: Exercise;
  initialName?: string;
  onSaved: (exercise: Exercise) => void;
  onCancel: () => void;
}) {
  const save = useSaveExercise();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [muscles, setMuscles] = useState<MuscleGroup[]>(exercise?.muscles ?? []);
  const [equipment, setEquipment] = useState<Equipment | "">(exercise?.equipment ?? "");
  const [loadType, setLoadType] = useState<LoadType>(exercise?.load_type ?? "external");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const toggleMuscle = (m: MuscleGroup) =>
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // This form is often rendered inside dialogs opened from other forms; keep the submit local.
    e.stopPropagation();
    const parsed = exerciseSchema.safeParse({ name, muscles, equipment: equipment || null, load_type: loadType });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      onSaved(await save.mutateAsync({ id: exercise?.id, input: parsed.data }));
    } catch {
      /* shown via save.error */
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {save.error && <Alert tone="error">{save.error.message}</Alert>}
      {exercise && (
        <p className="text-xs text-muted">Renaming or changing this exercise won&apos;t change workouts you already logged.</p>
      )}
      <TextField label="Exercise name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} required />

      <fieldset aria-describedby={errors.muscles ? "muscles-error" : undefined}>
        <legend className="text-sm font-medium">Muscle groups</legend>
        <p className="mb-2 text-xs text-muted">Used for search. Pick the main ones.</p>
        <div className="space-y-3">
          {MUSCLE_REGIONS.map((region) => (
            <div key={region.label}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{region.label}</p>
              <div className="flex flex-wrap gap-2">
                {region.muscles.map((m) => (
                  <label
                    key={m}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border-strong bg-surface-2 px-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
                  >
                    <input
                      type="checkbox"
                      checked={muscles.includes(m)}
                      onChange={() => toggleMuscle(m)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    {MUSCLES[m].label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <FieldError id="muscles-error" error={errors.muscles} />
      </fieldset>

      <SelectField label="Equipment (optional)" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment | "")}>
        <option value="">None / not specified</option>
        {(Object.keys(EQUIPMENT) as Equipment[]).map((k) => (
          <option key={k} value={k}>
            {EQUIPMENT[k]}
          </option>
        ))}
      </SelectField>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How is weight logged?</legend>
        {(Object.keys(LOAD_TYPES) as LoadType[]).map((k) => (
          <label
            key={k}
            className="flex min-h-11 cursor-pointer gap-3 rounded-xl border border-border-strong bg-surface-2 px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
          >
            <input
              type="radio"
              name="load_type"
              checked={loadType === k}
              onChange={() => setLoadType(k)}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-semibold">{LOAD_TYPES[k].label}</span>
              <span className="block text-xs text-muted">{LOAD_TYPES[k].description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {exercise ? "Save changes" : "Create exercise"}
        </Button>
      </div>
    </form>
  );
}
