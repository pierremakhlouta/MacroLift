"use client";

import { Pencil, Plus, Target } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { BackLink } from "@/components/back-link";
import { Dialog } from "@/components/dialog";
import { fmtNutrient } from "@/components/nutrition/format";
import { MaintenanceCard } from "@/components/nutrition/maintenance-card";
import { formatDay } from "@/components/progress/weight-section";
import { UndoToast, type UndoAction } from "@/components/undo-toast";
import { Alert, Button, Card, cx, EmptyState, PageHeader, QueryState, TextField } from "@/components/ui";
import { useToday } from "@/lib/hooks/use-today";
import { kcalFromMacros } from "@/lib/nutrition/maintenance";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, type NutrientKey } from "@/lib/nutrition/totals";
import { useUnitSystem } from "@/lib/queries/profile";
import { useDeleteTarget, useRestoreTarget, useSaveTarget, useTargets, type NutritionTarget } from "@/lib/queries/nutrition";
import { parseDecimal } from "@/lib/units";
import { targetSchema } from "@/lib/validation/target";

type Status = "current" | "scheduled" | "past";

/** The row in effect on `today` is the latest effective_from <= today (rows are newest first). */
function statuses(targets: NutritionTarget[], today: string): Map<string, Status> {
  const map = new Map<string, Status>();
  let currentFound = false;
  for (const t of targets) {
    if (t.effective_from > today) map.set(t.id, "scheduled");
    else if (!currentFound) {
      map.set(t.id, "current");
      currentFound = true;
    } else map.set(t.id, "past");
  }
  return map;
}

const STATUS_LABEL: Record<Status, string> = { current: "In effect today", scheduled: "Scheduled", past: "Earlier" };

function valuesSummary(t: NutritionTarget) {
  const parts = NUTRIENT_KEYS.filter((k) => t[k] != null).map((k) => `${NUTRIENT_LABELS[k].label} ${fmtNutrient(t[k], k)}`);
  return parts.length ? parts.join(" · ") : "No target (all values blank)";
}

export default function TargetsPage() {
  const units = useUnitSystem();
  return (
    <>
      <BackLink href="/nutrition" label="Nutrition" />
      <PageHeader title="Targets" description="Your own daily calorie and macro targets, and a separate maintenance estimate." />
      <div className="space-y-5">
        <TargetsSection />
        <MaintenanceCard units={units} />
      </div>
    </>
  );
}

function TargetsSection() {
  const targets = useTargets();
  const today = useToday();
  const restore = useRestoreTarget();
  const [editing, setEditing] = useState<NutritionTarget | "new" | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const undoSeq = useRef(0);
  const clearUndo = useCallback(() => setUndo(null), []);

  if (!targets.data || !today) {
    return <QueryState isPending={targets.isPending || !today} error={targets.error} onRetry={() => targets.refetch()} loadingLabel="Loading targets" />;
  }
  const status = statuses(targets.data, today);
  const current = targets.data.find((t) => status.get(t.id) === "current") ?? null;

  return (
    <>
      <Card aria-labelledby="targets-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Target aria-hidden className="size-5 text-accent" />
            <h2 id="targets-heading" className="text-lg font-semibold">Your targets</h2>
          </div>
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-4" /> New target
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted">
          A target applies from its start date until the next one starts, so past days keep the target they had. You choose
          every value; nothing here is set automatically.
        </p>

        {targets.data.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No targets yet">Add one to see calories and macros left in your diary.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 space-y-2" aria-label="Targets, newest start date first">
            {targets.data.map((t) => {
              const s = status.get(t.id)!;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className={cx(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left hover:border-border-strong",
                      s === "current" ? "border-accent/60 bg-surface-2" : "border-border",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        <span className="sr-only">Edit target </span>
                        From {formatDay(t.effective_from)}
                      </span>
                      <span className="block text-sm text-muted">{valuesSummary(t)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={cx("rounded-full px-2 py-0.5 text-xs", s === "current" ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted")}>
                        {STATUS_LABEL[s]}
                      </span>
                      <Pencil aria-hidden className="size-4 text-muted" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {targets.data.length > 0 && !current && (
          <p className="mt-3 text-sm text-muted">No target is in effect today: your earliest target starts in the future.</p>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New target" : "Edit target"}>
        {editing && (
          <TargetForm
            key={editing === "new" ? "new" : editing.id}
            target={editing === "new" ? null : editing}
            today={today}
            existing={targets.data}
            onDone={() => setEditing(null)}
            onDeleted={(t) => {
              setEditing(null);
              setUndo({ id: ++undoSeq.current, message: `Target from ${formatDay(t.effective_from)} deleted`, undo: () => restore.mutate(t) });
            }}
          />
        )}
      </Dialog>
      <UndoToast action={undo} onDone={clearUndo} />
    </>
  );
}

const FIELDS: { key: NutrientKey; unit: string }[] = [
  { key: "calories_kcal", unit: "kcal" },
  { key: "protein_g", unit: "g" },
  { key: "carbs_g", unit: "g" },
  { key: "fat_g", unit: "g" },
  { key: "fiber_g", unit: "g" },
];

const str = (v: number | null | undefined) => (v == null ? "" : String(Number(v)));

function TargetForm({
  target,
  today,
  existing,
  onDone,
  onDeleted,
}: {
  target: NutritionTarget | null;
  today: string;
  existing: NutritionTarget[];
  onDone: () => void;
  onDeleted: (t: NutritionTarget) => void;
}) {
  const save = useSaveTarget();
  const del = useDeleteTarget();
  const [date, setDate] = useState(target?.effective_from ?? today);
  const [values, setValues] = useState<Record<NutrientKey, string>>(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, str(target?.[f.key])])) as Record<NutrientKey, string>,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parsed = Object.fromEntries(
    FIELDS.map((f) => {
      const r = parseDecimal(values[f.key]);
      return [f.key, r.ok ? r.value : null];
    }),
  ) as Record<NutrientKey, number | null>;
  const macroKcal = kcalFromMacros(parsed);
  const coversPast = target != null && target.effective_from < today;
  const clash = existing.find((t) => t.effective_from === date && t.id !== target?.id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const input: Record<string, unknown> = { effective_from: date };
    for (const f of FIELDS) {
      const r = parseDecimal(values[f.key]);
      if (!r.ok) errs[f.key] = r.error;
      input[f.key] = r.ok ? r.value : null;
    }
    const result = targetSchema.safeParse(input);
    if (!result.success) for (const issue of result.error.issues) errs[String(issue.path[0])] ??= issue.message;
    if (clash) errs.effective_from = "You already have a target starting on this date. Edit that one instead.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({ id: target?.id, input: result.data! });
      onDone();
    } catch {
      /* shown below */
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} noValidate className="space-y-4">
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        {coversPast && (
          <Alert tone="warning">
            This target already applies to past days, so changing it changes how those days compare. To change your target
            from today only, close this and choose New target.
          </Alert>
        )}
        <TextField
          label="Starts on"
          type="date"
          min="1900-01-01"
          max="2200-01-01"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.effective_from}
          hint="Applies from this day until your next target starts."
        />
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <TextField
              key={f.key}
              className={f.key === "calories_kcal" ? "col-span-2" : undefined}
              label={NUTRIENT_LABELS[f.key].label}
              inputMode="decimal"
              suffix={f.unit}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              error={errors[f.key]}
            />
          ))}
        </div>
        <p className="text-xs text-muted">Leave a value blank to have no target for it.</p>
        {macroKcal != null && (
          <p className="text-sm text-muted" aria-live="polite">
            Your macros add up to about {fmtNutrient(macroKcal, "calories_kcal")} (4 kcal/g protein and carbs, 9 kcal/g fat).
            {parsed.calories_kcal != null && Math.abs(macroKcal - parsed.calories_kcal) >= 50 && " That differs from your calorie target, which is fine if intended."}
          </p>
        )}
        <Button type="submit" loading={save.isPending} className="w-full">
          {target ? "Save changes" : "Save target"}
        </Button>
      </form>
      {target && (
        <div className="border-t border-border pt-4">
          {del.error && <Alert tone="error" className="mb-2">{del.error.message}</Alert>}
          <Button
            variant="danger"
            loading={del.isPending}
            onClick={async () => {
              try {
                await del.mutateAsync(target.id);
                onDeleted(target);
              } catch {
                /* shown above */
              }
            }}
          >
            Delete target
          </Button>
          <p className="mt-2 text-xs text-muted">Days it covered will use the previous target, if there is one.</p>
        </div>
      )}
    </div>
  );
}

