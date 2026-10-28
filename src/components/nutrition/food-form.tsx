"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, TextField } from "@/components/ui";
import { useSaveFood, type Food } from "@/lib/queries/nutrition";
import { parseDecimal } from "@/lib/units";
import { foodSchema, type FoodInput } from "@/lib/validation/food";

const NUTRIENT_FIELDS: { key: keyof FoodInput; label: string; unit: string }[] = [
  { key: "calories_kcal", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

const str = (v: number | null | undefined) => (v == null ? "" : String(v));

/** Create or edit a saved food. Blank nutrients are saved as unknown, never as 0. */
export function FoodForm({
  food,
  initialName = "",
  onSaved,
  onCancel,
}: {
  food?: Food;
  initialName?: string;
  onSaved: (food: Food) => void;
  onCancel: () => void;
}) {
  const save = useSaveFood();
  const [fields, setFields] = useState<Record<string, string>>(() => ({
    name: food?.name ?? initialName,
    brand: food?.brand ?? "",
    serving_size: str(food?.serving_size ?? 100),
    serving_unit: food?.serving_unit ?? "g",
    ...Object.fromEntries(NUTRIENT_FIELDS.map((f) => [f.key, str(food?.[f.key as keyof Food] as number | null)])),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const errs: Record<string, string> = {};
    const num = (k: string) => {
      const r = parseDecimal(fields[k]);
      if (!r.ok) errs[k] = r.error;
      return r.ok ? r.value : null;
    };
    const candidate = {
      name: fields.name,
      brand: fields.brand.trim() || null,
      serving_size: num("serving_size") ?? Number.NaN,
      serving_unit: fields.serving_unit,
      ...Object.fromEntries(NUTRIENT_FIELDS.map((f) => [f.key, num(f.key)])),
    };
    const parsed = foodSchema.safeParse(candidate);
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
    if (fields.serving_size.trim() === "") errs.serving_size = "Enter a serving size";
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;
    try {
      onSaved(await save.mutateAsync({ id: food?.id, input: parsed.data }));
    } catch {
      /* shown below */
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {save.error && <Alert tone="error">{save.error.message}</Alert>}
      {food && <p className="text-xs text-muted">Changes apply to future logs only. Past diary entries keep the values they were logged with.</p>}
      <TextField label="Food name" value={fields.name} onChange={set("name")} error={errors.name} maxLength={120} />
      <TextField label="Brand (optional)" value={fields.brand} onChange={set("brand")} error={errors.brand} maxLength={120} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Serving</legend>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Size" inputMode="decimal" value={fields.serving_size} onChange={set("serving_size")} error={errors.serving_size} />
          <TextField label="Unit" placeholder="g, ml, scoop, slice…" value={fields.serving_unit} onChange={set("serving_unit")} error={errors.serving_unit} maxLength={30} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Nutrition per serving</legend>
        <p className="mb-2 text-xs text-muted">Leave a field blank if you don&apos;t know it. It&apos;ll show as unknown, not as zero.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NUTRIENT_FIELDS.map((f) => (
            <TextField key={f.key} label={f.label} inputMode="decimal" suffix={f.unit} value={fields[f.key]} onChange={set(f.key)} error={errors[f.key]} />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={save.isPending}>{food ? "Save changes" : "Save food"}</Button>
      </div>
    </form>
  );
}
