"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { BackLink } from "@/components/back-link";
import { Dialog } from "@/components/dialog";
import { filterFoods } from "@/components/nutrition/add-food-dialog";
import { fmtNutrient } from "@/components/nutrition/format";
import { Alert, Button, EmptyState, PageHeader, QueryState, TextField } from "@/components/ui";
import { nutrientTotal } from "@/lib/nutrition/totals";
import { useDeleteMealTemplate, useFoods, useMealTemplates, useSaveMealTemplate, type Food, type MealTemplate } from "@/lib/queries/nutrition";
import { parseDecimal } from "@/lib/units";
import { mealNameSchema, quantitySchema } from "@/lib/validation/food";

export default function MealsPage() {
  const templates = useMealTemplates();
  const [editing, setEditing] = useState<MealTemplate | "new" | null>(null);

  return (
    <>
      <BackLink href="/nutrition" label="Nutrition" />
      <PageHeader
        title="Saved meals"
        description="Reusable groups of foods you can log in one tap."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-4" /> New meal
          </Button>
        }
      />
      <QueryState isPending={templates.isPending} error={templates.error} onRetry={() => templates.refetch()} loadingLabel="Loading meals" />
      {templates.data?.length === 0 && (
        <EmptyState icon={<ListChecks aria-hidden className="size-8" />} title="No saved meals yet">
          Create one here, or use “Save as meal” on any meal in your diary.
        </EmptyState>
      )}
      {!!templates.data?.length && (
        <ul className="space-y-3">
          {templates.data.map((t) => {
            const kcal = nutrientTotal(
              t.items.map((i) => ({ calories_kcal: i.food?.calories_kcal ?? null, quantity: Number(i.quantity) })),
              "calories_kcal",
            );
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="block w-full rounded-2xl border border-border bg-surface p-4 text-left hover:border-border-strong"
                >
                  <span className="block font-semibold">
                    <span className="sr-only">Edit meal </span>
                    {t.name}
                  </span>
                  <span className="block text-sm text-muted">
                    {t.items.length} {t.items.length === 1 ? "item" : "items"} · {kcal.partial ? "≥ " : ""}
                    {kcal.total == null ? "calories unknown" : fmtNutrient(kcal.total, "calories_kcal")}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">{t.items.map((i) => i.food?.name ?? "Unavailable food").join(", ")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New meal" : "Edit meal"}>
        {editing && <MealEditor key={editing === "new" ? "new" : editing.id} template={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}

type DraftItem = { id: string; food: Food; quantity: string };

function MealEditor({ template, onDone }: { template: MealTemplate | null; onDone: () => void }) {
  const foods = useFoods();
  const save = useSaveMealTemplate();
  const del = useDeleteMealTemplate();
  const idRef = useRef<string | null>(template?.id ?? null);
  const [name, setName] = useState(template?.name ?? "");
  const [items, setItems] = useState<DraftItem[]>(() =>
    (template?.items ?? []).filter((i) => i.food).map((i) => ({ id: i.id, food: i.food!, quantity: String(Number(i.quantity)) })),
  );
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const results = useMemo(() => (query.trim() ? filterFoods(foods.data ?? [], query).slice(0, 8) : []), [foods.data, query]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const n = mealNameSchema.safeParse(name);
    if (!n.success) errs.name = n.error.issues[0].message;
    const payload = items.map((it) => {
      const r = parseDecimal(it.quantity);
      const ok = r.ok && r.value != null && quantitySchema.safeParse(r.value).success;
      if (!ok) errs[it.id] = "Enter servings greater than 0";
      return { id: it.id, food_id: it.food.id, quantity: ok ? r.value! : 0 };
    });
    if (!items.length) errs.items = "Add at least one food";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const id = (idRef.current ??= crypto.randomUUID());
    try {
      await save.mutateAsync({ id, name: n.data!, notes: "", items: payload });
      onDone();
    } catch {
      /* shown below */
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} noValidate className="space-y-4">
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <TextField label="Meal name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <section aria-labelledby="meal-items" className="space-y-2">
          <h3 id="meal-items" className="text-sm font-medium">Foods</h3>
          {errors.items && <p className="text-xs font-medium text-danger">{errors.items}</p>}
          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex items-end gap-2 rounded-xl border border-border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.food.name}</p>
                    <p className="text-xs text-muted">1 serving = {it.food.serving_size} {it.food.serving_unit}</p>
                  </div>
                  <TextField
                    className="w-24"
                    label="Servings"
                    inputMode="decimal"
                    value={it.quantity}
                    onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, quantity: e.target.value } : x)))}
                    error={errors[it.id]}
                    aria-label={`Servings of ${it.food.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}
                    aria-label={`Remove ${it.food.name}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div>
          <TextField label="Add a saved food" type="search" autoComplete="off" placeholder="Search your foods" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query.trim() && (
            <ul aria-label="Matching foods" className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {results.length === 0 && <li className="px-3 py-3 text-sm text-muted">No matching saved food. Create it under Saved foods first.</li>}
              {results.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((xs) => [...xs, { id: crypto.randomUUID(), food: f, quantity: "1" }]);
                      setQuery("");
                    }}
                    className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <Plus aria-hidden className="size-4 text-accent" />
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="submit" loading={save.isPending} className="w-full">Save meal</Button>
      </form>
      {template && (
        <div className="border-t border-border pt-4">
          {del.error && <Alert tone="error" className="mb-2">{del.error.message}</Alert>}
          <Button
            variant="danger"
            loading={del.isPending}
            onClick={async () => {
              await del.mutateAsync(template.id);
              onDone();
            }}
          >
            Delete meal
          </Button>
          <p className="mt-2 text-xs text-muted">Diary entries already logged from this meal stay as they are.</p>
        </div>
      )}
    </div>
  );
}
