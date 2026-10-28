"use client";

import { ExternalLink, Plus, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { FoodForm } from "@/components/nutrition/food-form";
import { fmtNutrient, fmtServing } from "@/components/nutrition/format";
import { Alert, Button, EmptyState, QueryState, SegmentedRadio, TextField, cx } from "@/components/ui";
import { normalize } from "@/lib/exercises/search";
import { entryAmount, isMeasurableUnit, servingsFromAmount } from "@/lib/nutrition/totals";
import type { UsdaFood } from "@/lib/nutrition/usda";
import {
  mealLabel,
  searchUsda,
  useAddDiaryEntries,
  useFoods,
  useImportUsdaFood,
  useMealTemplates,
  useUsdaStatus,
  type Food,
  type MealCategory,
  type MealTemplate,
} from "@/lib/queries/nutrition";
import { parseDecimal } from "@/lib/units";
import { quantitySchema } from "@/lib/validation/food";

type Tab = "foods" | "meals" | "usda" | "quick";
type Step = { kind: "browse" } | { kind: "amount"; food: Food } | { kind: "create"; name: string };

export function filterFoods(foods: Food[], query: string, includeArchived = false): Food[] {
  const q = normalize(query);
  const active = includeArchived ? foods : foods.filter((f) => !f.archived_at);
  if (!q) return active;
  const terms = q.split(" ");
  return active.filter((f) => {
    const hay = normalize(`${f.name} ${f.brand ?? ""}`);
    return terms.every((t) => hay.includes(t));
  });
}

export function AddFoodDialog({
  open,
  onClose,
  date,
  meal,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  meal: MealCategory;
}) {
  const [tab, setTab] = useState<Tab>("foods");
  const [step, setStep] = useState<Step>({ kind: "browse" });
  const [query, setQuery] = useState("");
  const usda = useUsdaStatus();
  const add = useAddDiaryEntries();

  const close = () => {
    setStep({ kind: "browse" });
    setQuery("");
    setTab("foods");
    add.reset();
    onClose();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "foods", label: "My foods" },
    { id: "meals", label: "Meals" },
    ...(usda.data ? [{ id: "usda" as const, label: "USDA" }] : []),
    { id: "quick", label: "Quick add" },
  ];

  const title =
    step.kind === "amount" ? `Add ${step.food.name}` : step.kind === "create" ? "New food" : `Add to ${mealLabel(meal)}`;

  return (
    <Dialog open={open} onClose={close} title={title}>
      {step.kind === "create" ? (
        <FoodForm initialName={step.name} onSaved={(food) => setStep({ kind: "amount", food })} onCancel={() => setStep({ kind: "browse" })} />
      ) : step.kind === "amount" ? (
        <AmountStep
          food={step.food}
          meal={meal}
          busy={add.isPending}
          error={add.error?.message ?? null}
          onBack={() => setStep({ kind: "browse" })}
          onAdd={async (quantity) => {
            await add.mutateAsync({ date, meal, items: [{ id: crypto.randomUUID(), food_id: step.food.id, quantity }] });
            close();
          }}
        />
      ) : (
        <div className="space-y-4">
          <div role="group" aria-label="Add from" className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  "min-h-11 rounded-xl border px-3 text-sm font-medium",
                  tab === t.id ? "border-accent bg-accent/10 text-text" : "border-border-strong bg-surface-2 text-muted hover:text-text",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "foods" && (
            <MyFoodsTab query={query} setQuery={setQuery} onPick={(food) => setStep({ kind: "amount", food })} onCreate={() => setStep({ kind: "create", name: query.trim() })} />
          )}
          {tab === "meals" && (
            <MealsTab
              busy={add.isPending}
              error={add.error?.message ?? null}
              onLog={async (t) => {
                const items = t.items.filter((i) => i.food).map((i) => ({ id: crypto.randomUUID(), food_id: i.food_id, quantity: i.quantity, meal_template_id: t.id }));
                await add.mutateAsync({ date, meal, items });
                close();
              }}
            />
          )}
          {tab === "usda" && <UsdaTab onPick={(food) => setStep({ kind: "amount", food })} />}
          {tab === "quick" && (
            <QuickAddTab
              busy={add.isPending}
              error={add.error?.message ?? null}
              onAdd={async (item) => {
                await add.mutateAsync({ date, meal, items: [{ id: crypto.randomUUID(), quantity: 1, serving_size: 1, serving_unit: "serving", ...item }] });
                close();
              }}
            />
          )}
        </div>
      )}
    </Dialog>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 focus-visible:-outline-offset-2">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{food.name}</span>
        <span className="block truncate text-xs text-muted">
          {[food.brand, `${fmtServing(1, food.serving_size, food.serving_unit).replace(/^1 × /, "")}`, fmtNutrient(food.calories_kcal, "calories_kcal")].filter(Boolean).join(" · ")}
          {food.source === "usda" && " · USDA"}
          {food.owner_id === null && " · Built-in"}
        </span>
      </span>
      <Plus aria-hidden className="size-5 shrink-0 text-accent" />
    </button>
  );
}

function MyFoodsTab({ query, setQuery, onPick, onCreate }: { query: string; setQuery: (q: string) => void; onPick: (f: Food) => void; onCreate: () => void }) {
  const foods = useFoods();
  const results = useMemo(() => filterFoods(foods.data ?? [], query), [foods.data, query]);
  return (
    <div className="space-y-3">
      <TextField label="Search your foods" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} data-autofocus />
      <QueryState isPending={foods.isPending} error={foods.error} onRetry={() => foods.refetch()} loadingLabel="Loading foods" />
      {foods.isSuccess &&
        (results.length ? (
          <ul aria-label="Food results" className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {results.slice(0, 50).map((f) => (
              <li key={f.id}>
                <FoodRow food={f} onPick={() => onPick(f)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={foods.data?.length ? "No matching food" : "No saved foods yet"}>
            Create a food from its nutrition label, or use Quick add.
          </EmptyState>
        ))}
      <Button variant="secondary" className="w-full" onClick={onCreate}>
        <Plus aria-hidden className="size-4" /> {query.trim() ? `Create “${query.trim()}”` : "Create a food"}
      </Button>
    </div>
  );
}

function MealsTab({ onLog, busy, error }: { onLog: (t: MealTemplate) => Promise<void>; busy: boolean; error: string | null }) {
  const templates = useMealTemplates();
  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <QueryState isPending={templates.isPending} error={templates.error} onRetry={() => templates.refetch()} loadingLabel="Loading meals" />
      {templates.data?.length === 0 && <EmptyState title="No saved meals yet">Save a meal from your diary, or create one under Nutrition → Meals.</EmptyState>}
      {!!templates.data?.length && (
        <ul className="space-y-2">
          {templates.data.map((t) => {
            const kcal = t.items.reduce<number | null>((sum, i) => {
              const v = i.food ? entryAmount({ calories_kcal: i.food.calories_kcal, quantity: i.quantity }, "calories_kcal") : null;
              return v == null || sum == null ? null : sum + v;
            }, 0);
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {t.items.length} {t.items.length === 1 ? "item" : "items"} · {kcal == null ? "calories partly unknown" : fmtNutrient(kcal, "calories_kcal")}
                  </span>
                </span>
                <Button variant="secondary" loading={busy} disabled={t.items.length === 0} onClick={() => onLog(t)} aria-label={`Log ${t.name}`}>
                  Log
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function UsdaTab({ onPick }: { onPick: (f: Food) => void }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"generic" | "branded">("generic");
  const [results, setResults] = useState<UsdaFood[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const importFood = useImportUsdaFood();

  // Search on submit, not per keystroke, to stay well inside the shared API limit.
  async function onSearch(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (q.trim().length < 2) return setError("Type at least 2 characters");
    setLoading(true);
    setError(null);
    try {
      setResults(await searchUsda(q.trim(), kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSearch} noValidate className="space-y-3" role="search">
        <TextField label="Search USDA FoodData Central" type="search" value={q} onChange={(e) => setQ(e.target.value)} data-autofocus />
        <SegmentedRadio
          legend="Type"
          name="usda-kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "generic", label: "Generic", description: "e.g. cooked rice" },
            { value: "branded", label: "Branded", description: "packaged products" },
          ]}
        />
        <Button type="submit" loading={loading} className="w-full">
          <Search aria-hidden className="size-4" /> Search
        </Button>
      </form>
      {error && <Alert tone="error">{error}</Alert>}
      {importFood.error && <Alert tone="error">{importFood.error.message}</Alert>}
      {results && (
        <>
          <p aria-live="polite" className="text-xs text-muted">
            {results.length} {results.length === 1 ? "result" : "results"} · values per 100 g/ml
          </p>
          {results.length > 0 && (
            <ul aria-label="USDA results" className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {results.map((r) => (
                <li key={r.fdcId}>
                  <button
                    type="button"
                    onClick={async () => onPick(await importFood.mutateAsync(r))}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[r.brand, `per 100 ${r.serving_unit}`, fmtNutrient(r.calories_kcal, "calories_kcal"), `P ${fmtNutrient(r.protein_g, "protein_g", false)} g`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Plus aria-hidden className="size-5 shrink-0 text-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="flex items-center gap-1 text-xs text-muted">
        Data: USDA FoodData Central (public domain). Values are approximate.
        <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-4">
          Source <ExternalLink aria-hidden className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}

function QuickAddTab({
  onAdd,
  busy,
  error,
}: {
  onAdd: (item: { food_name: string; calories_kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }) => Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  const [f, setF] = useState({ name: "", kcal: "", p: "", c: "", fat: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const errs: Record<string, string> = {};
    const num = (k: keyof typeof f) => {
      const r = parseDecimal(f[k]);
      if (!r.ok) errs[k] = r.error;
      else if (r.value != null && r.value < 0) errs[k] = "Can't be negative";
      return r.ok ? r.value : null;
    };
    const item = { food_name: f.name.trim(), calories_kcal: num("kcal"), protein_g: num("p"), carbs_g: num("c"), fat_g: num("fat") };
    if (!item.food_name) errs.name = "Enter a description";
    if (item.calories_kcal == null && item.protein_g == null && item.carbs_g == null && item.fat_g == null && !errs.kcal) errs.kcal = "Enter at least one value";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await onAdd(item).catch(() => {});
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <p className="text-xs text-muted">For a one-off item without saving a food. Blank values are unknown, not zero.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="Description" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} data-autofocus />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Calories" inputMode="decimal" suffix="kcal" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} error={errors.kcal} />
        <TextField label="Protein" inputMode="decimal" suffix="g" value={f.p} onChange={(e) => setF({ ...f, p: e.target.value })} error={errors.p} />
        <TextField label="Carbs" inputMode="decimal" suffix="g" value={f.c} onChange={(e) => setF({ ...f, c: e.target.value })} error={errors.c} />
        <TextField label="Fat" inputMode="decimal" suffix="g" value={f.fat} onChange={(e) => setF({ ...f, fat: e.target.value })} error={errors.fat} />
      </div>
      <Button type="submit" loading={busy} className="w-full">Add</Button>
    </form>
  );
}

/** Choose how much: number of servings, or an amount in g/ml for measurable units. Live preview. */
export function AmountStep({
  food,
  meal,
  busy,
  error,
  onBack,
  onAdd,
  submitLabel,
  initialQuantity = 1,
}: {
  food: Pick<Food, "name" | "serving_size" | "serving_unit" | "calories_kcal" | "protein_g" | "carbs_g" | "fat_g">;
  meal?: MealCategory;
  busy: boolean;
  error: string | null;
  onBack?: () => void;
  onAdd: (quantity: number) => Promise<void>;
  submitLabel?: string;
  initialQuantity?: number;
}) {
  const measurable = isMeasurableUnit(food.serving_unit);
  const [mode, setMode] = useState<"servings" | "amount">(measurable && food.serving_size !== 1 ? "amount" : "servings");
  const [text, setText] = useState(() => String(mode === "amount" ? +(initialQuantity * food.serving_size).toFixed(2) : initialQuantity));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const parsed = parseDecimal(text);
  const quantity = parsed.ok && parsed.value != null ? (mode === "amount" ? servingsFromAmount(parsed.value, food.serving_size) : parsed.value) : null;
  const preview = quantity && quantity > 0 ? { ...food, quantity } : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const check = quantity == null ? { success: false as const } : quantitySchema.safeParse(quantity);
    if (!parsed.ok) return setFieldError(parsed.error);
    if (!check.success) return setFieldError("Enter an amount greater than 0");
    setFieldError(null);
    await onAdd(quantity!).catch(() => {});
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-sm text-muted">1 serving = {food.serving_size} {food.serving_unit}</p>
      {measurable && (
        <SegmentedRadio
          legend="Enter as"
          name="amount-mode"
          value={mode}
          onChange={(m) => {
            const q = quantity;
            setMode(m);
            if (q) setText(String(m === "amount" ? +(q * food.serving_size).toFixed(2) : +q.toFixed(3)));
          }}
          options={[
            { value: "amount", label: `Amount (${food.serving_unit})` },
            { value: "servings", label: "Servings" },
          ]}
        />
      )}
      <TextField
        label={mode === "amount" ? `Amount in ${food.serving_unit}` : "Servings"}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={fieldError}
        suffix={mode === "amount" ? food.serving_unit : undefined}
        data-autofocus
      />
      <dl aria-live="polite" className="grid grid-cols-4 gap-2 text-center text-xs">
        {(["calories_kcal", "protein_g", "carbs_g", "fat_g"] as const).map((k) => (
          <div key={k} className="rounded-lg bg-surface-2 px-1 py-2">
            <dt className="text-muted">{{ calories_kcal: "kcal", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" }[k]}</dt>
            <dd className="font-semibold tabular-nums">{preview ? fmtNutrient(entryAmount(preview, k), k, k !== "calories_kcal") : "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onBack && (
          <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        )}
        <Button type="submit" loading={busy}>{submitLabel ?? `Add to ${meal ? mealLabel(meal) : "diary"}`}</Button>
      </div>
    </form>
  );
}
