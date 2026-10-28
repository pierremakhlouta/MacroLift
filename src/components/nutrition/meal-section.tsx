"use client";

import { BookmarkPlus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { AmountStep } from "@/components/nutrition/add-food-dialog";
import { fmtNutrient, fmtServing } from "@/components/nutrition/format";
import { Alert, Button, Card, SelectField, TextField } from "@/components/ui";
import { entryAmount, nutrientTotal } from "@/lib/nutrition/totals";
import {
  MEALS,
  mealLabel,
  useDeleteDiaryEntry,
  useSaveMealTemplate,
  useUpdateDiaryEntry,
  type DiaryEntry,
  type MealCategory,
} from "@/lib/queries/nutrition";
import { mealNameSchema } from "@/lib/validation/food";

export function MealSection({
  meal,
  entries,
  onAdd,
  onDeleted,
}: {
  meal: MealCategory;
  entries: DiaryEntry[];
  onAdd: () => void;
  onDeleted: (entry: DiaryEntry) => void;
}) {
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const kcal = nutrientTotal(entries, "calories_kcal");
  const label = mealLabel(meal);

  return (
    <Card aria-labelledby={`meal-${meal}`} className="p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`meal-${meal}`} className="text-base font-semibold">{label}</h2>
        <span className="text-sm text-muted tabular-nums">
          {entries.length ? `${kcal.partial && kcal.total != null ? "≥ " : ""}${kcal.total == null ? "unknown" : fmtNutrient(kcal.total, "calories_kcal")}` : ""}
        </span>
      </div>

      {entries.length > 0 && (
        <ul className="mt-2 divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setEditing(e)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-surface-2/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    <span className="sr-only">Edit </span>
                    {e.food_name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[e.brand, fmtServing(Number(e.quantity), Number(e.serving_size), e.serving_unit)].filter(Boolean).join(" · ")}
                    {" · "}P {fmtNutrient(entryAmount(e, "protein_g"), "protein_g", false)} · C {fmtNutrient(entryAmount(e, "carbs_g"), "carbs_g", false)} · F{" "}
                    {fmtNutrient(entryAmount(e, "fat_g"), "fat_g", false)}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">{fmtNutrient(entryAmount(e, "calories_kcal"), "calories_kcal")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" className="flex-1" onClick={onAdd} aria-label={`Add food to ${label}`}>
          <Plus aria-hidden className="size-4" /> Add food
        </Button>
        {entries.some((e) => e.food_id) && (
          <Button variant="ghost" onClick={() => setSaving(true)} aria-label={`Save ${label} as a meal`}>
            <BookmarkPlus aria-hidden className="size-4" /> Save as meal
          </Button>
        )}
      </div>

      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} onDeleted={onDeleted} />
      <SaveMealDialog open={saving} onClose={() => setSaving(false)} entries={entries} defaultName={label} />
    </Card>
  );
}

function EditEntryDialog({ entry, onClose, onDeleted }: { entry: DiaryEntry | null; onClose: () => void; onDeleted: (e: DiaryEntry) => void }) {
  const update = useUpdateDiaryEntry();
  const del = useDeleteDiaryEntry();
  const [meal, setMeal] = useState<MealCategory | null>(null);

  const close = () => {
    setMeal(null);
    update.reset();
    onClose();
  };

  return (
    <Dialog open={entry !== null} onClose={close} title={entry ? `Edit ${entry.food_name}` : "Edit"}>
      {entry && (
        <div className="space-y-5">
          <SelectField label="Meal" value={meal ?? entry.meal} onChange={(e) => setMeal(e.target.value as MealCategory)}>
            {MEALS.map((m) => (
              <option key={m.meal} value={m.meal}>{m.label}</option>
            ))}
          </SelectField>
          <AmountStep
            key={entry.id}
            food={{
              name: entry.food_name,
              serving_size: Number(entry.serving_size),
              serving_unit: entry.serving_unit,
              calories_kcal: entry.calories_kcal,
              protein_g: entry.protein_g,
              carbs_g: entry.carbs_g,
              fat_g: entry.fat_g,
            }}
            initialQuantity={Number(entry.quantity)}
            busy={update.isPending}
            error={update.error?.message ?? null}
            submitLabel="Save changes"
            onAdd={async (quantity) => {
              await update.mutateAsync({ id: entry.id, quantity, meal: meal ?? entry.meal });
              close();
            }}
          />
          <p className="text-xs text-muted">Values are as logged; editing the saved food later won&apos;t change this entry.</p>
          <div className="border-t border-border pt-4">
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={async () => {
                await del.mutateAsync(entry.id);
                onDeleted(entry);
                close();
              }}
            >
              Delete entry
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function SaveMealDialog({ open, onClose, entries, defaultName }: { open: boolean; onClose: () => void; entries: DiaryEntry[]; defaultName: string }) {
  const save = useSaveMealTemplate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const withFood = entries.filter((e) => e.food_id);
  const skipped = entries.length - withFood.length;

  const close = () => {
    setName("");
    setError(null);
    setDone(false);
    save.reset();
    onClose();
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = mealNameSchema.safeParse(name || `My ${defaultName.toLowerCase()}`);
    if (!r.success) return setError(r.error.issues[0].message);
    try {
      await save.mutateAsync({
        id: crypto.randomUUID(),
        name: r.data,
        notes: "",
        items: withFood.map((x) => ({ id: crypto.randomUUID(), food_id: x.food_id!, quantity: Number(x.quantity) })),
      });
      setDone(true);
    } catch {
      /* shown below */
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Save as a reusable meal" size="sm">
      {done ? (
        <div className="space-y-4">
          <Alert tone="success">Meal saved. Log it any day from Add food → Meals.</Alert>
          <Button onClick={close}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {save.error && <Alert tone="error">{save.error.message}</Alert>}
          <TextField label="Meal name" placeholder={`My ${defaultName.toLowerCase()}`} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} error={error} />
          <p className="text-sm text-muted">
            {withFood.length} {withFood.length === 1 ? "item" : "items"} will be saved.
            {skipped > 0 && ` ${skipped} quick-add ${skipped === 1 ? "item isn't" : "items aren't"} saved foods and will be left out.`}
          </p>
          <Button type="submit" loading={save.isPending} className="w-full">Save meal</Button>
        </form>
      )}
    </Dialog>
  );
}
