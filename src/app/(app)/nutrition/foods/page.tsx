"use client";

import { Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BackLink } from "@/components/back-link";
import { Dialog } from "@/components/dialog";
import { filterFoods } from "@/components/nutrition/add-food-dialog";
import { FoodForm } from "@/components/nutrition/food-form";
import { fmtNutrient } from "@/components/nutrition/format";
import { Alert, Button, EmptyState, PageHeader, QueryState, TextField } from "@/components/ui";
import { useFoods, useSetFoodArchived, type Food } from "@/lib/queries/nutrition";

type Editing = { mode: "create"; name: string } | { mode: "edit"; food: Food } | null;

export default function FoodsPage() {
  const foods = useFoods();
  const setArchived = useSetFoodArchived();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

  const all = foods.data ?? [];
  const archived = all.filter((f) => f.archived_at);
  const shown = useMemo(() => filterFoods(foods.data ?? [], query, showArchived), [foods.data, query, showArchived]);

  return (
    <>
      <BackLink href="/nutrition" label="Nutrition" />
      <PageHeader
        title="Saved foods"
        description="Foods you can log quickly. Nutrition is per serving; blank values are unknown."
        actions={
          <Button onClick={() => setEditing({ mode: "create", name: query.trim() })}>
            <Plus aria-hidden className="size-4" /> New food
          </Button>
        }
      />
      {setArchived.error && <Alert tone="error" className="mb-3">{setArchived.error.message}</Alert>}
      <QueryState isPending={foods.isPending} error={foods.error} onRetry={() => foods.refetch()} loadingLabel="Loading foods" />

      {foods.isSuccess && (
        <div className="space-y-3">
          <TextField label="Search foods" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
          {shown.length === 0 ? (
            <EmptyState title={all.length ? "No matching food" : "No saved foods yet"}>
              Add foods from their nutrition labels, or import them from USDA in the diary&apos;s Add food screen (when enabled).
            </EmptyState>
          ) : (
            <ul aria-label="Saved foods" className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {shown.map((f) => (
                <li key={f.id} className="flex min-h-14 items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 font-medium">
                      {f.name}
                      {f.source === "usda" && <span className="rounded-md border border-info/50 px-1.5 text-[11px] text-info">USDA</span>}
                      {f.archived_at && <span className="rounded-md border border-warn/50 px-1.5 text-[11px] text-warn">Archived</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[f.brand, `${f.serving_size} ${f.serving_unit}`, fmtNutrient(f.calories_kcal, "calories_kcal"), `P ${fmtNutrient(f.protein_g, "protein_g", false)} · C ${fmtNutrient(f.carbs_g, "carbs_g", false)} · F ${fmtNutrient(f.fat_g, "fat_g", false)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {f.owner_id ? (
                    <button type="button" onClick={() => setEditing({ mode: "edit", food: f })} aria-label={`Edit ${f.name}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text">
                      <Pencil aria-hidden className="size-4" />
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-muted">Built-in</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {archived.length > 0 && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Show archived ({archived.length})
            </label>
          )}
        </div>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.mode === "edit" ? "Edit food" : "New food"}>
        {editing && (
          <div className="space-y-6">
            <FoodForm
              food={editing.mode === "edit" ? editing.food : undefined}
              initialName={editing.mode === "create" ? editing.name : ""}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
            {editing.mode === "edit" && (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm text-muted">
                  {editing.food.archived_at
                    ? "Restore this food so it shows up when adding food."
                    : "Archiving hides it when adding food. Your diary and saved meals keep working."}
                </p>
                <Button
                  variant={editing.food.archived_at ? "secondary" : "danger"}
                  loading={setArchived.isPending}
                  onClick={async () => {
                    await setArchived.mutateAsync({ id: editing.food.id, archived: !editing.food.archived_at });
                    setEditing(null);
                  }}
                >
                  {editing.food.archived_at ? "Restore food" : "Archive food"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
