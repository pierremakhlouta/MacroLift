"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { ExerciseBadges } from "@/components/exercises/exercise-search";
import { ExercisePicker } from "@/components/exercises/exercise-picker";
import { Alert, Button, Card, EmptyState, TextAreaField, TextField } from "@/components/ui";
import { musclesText } from "@/lib/exercises/catalog";
import type { Exercise } from "@/lib/queries/exercises";
import { useDeleteRoutine, useSaveRoutine, type Routine, type RoutineItem } from "@/lib/queries/routines";
import { formatRepRange, parseRepRange, parseTargetSets } from "@/lib/routines/targets";
import { itemNotesSchema, routineNameSchema, routineNotesSchema } from "@/lib/validation/exercise";

type ItemExercise = NonNullable<RoutineItem["exercise"]>;

type DraftItem = {
  id: string;
  exercise: ItemExercise;
  sets: string;
  reps: string;
  notes: string;
};

type ItemErrors = { sets?: string; reps?: string; notes?: string };

const toDraft = (item: RoutineItem): DraftItem => ({
  id: item.id,
  exercise: item.exercise!,
  sets: item.target_sets == null ? "" : String(item.target_sets),
  reps: formatRepRange({ min: item.target_reps_min, max: item.target_reps_max }),
  notes: item.notes ?? "",
});

export function RoutineEditor({ routine, isNew }: { routine: Routine; isNew: boolean }) {
  const router = useRouter();
  const save = useSaveRoutine();
  const del = useDeleteRoutine();
  const [name, setName] = useState(routine.name);
  const [notes, setNotes] = useState(routine.notes ?? "");
  const [items, setItems] = useState<DraftItem[]>(() => routine.items.filter((i) => i.exercise).map(toDraft));
  const [nameError, setNameError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, ItemErrors>>({});
  const [dirty, setDirty] = useState(isNew);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // Stable client-generated id: created on the first save of a new routine and reused on
  // retries, so a repeated request updates the same routine instead of creating a duplicate.
  const idRef = useRef<string | null>(routine.id || null);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };
  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    edit(setItems)(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    edit(setItems)(next);
    setAnnouncement(`${next[target].exercise.name} moved to position ${target + 1} of ${next.length}`);
    // Keep keyboard focus on the same control after the move.
    requestAnimationFrame(() => document.getElementById(`move-${delta < 0 ? "up" : "down"}-${next[target].id}`)?.focus());
  }

  function remove(index: number) {
    const removed = items[index];
    edit(setItems)(items.filter((_, i) => i !== index));
    setAnnouncement(`${removed.exercise.name} removed`);
  }

  function addExercise(e: Exercise) {
    edit(setItems)([...items, { id: crypto.randomUUID(), exercise: e, sets: "", reps: "", notes: "" }]);
    setAnnouncement(`${e.name} added`);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const nameResult = routineNameSchema.safeParse(name);
    const notesResult = routineNotesSchema.safeParse(notes);
    setNameError(nameResult.success ? null : nameResult.error.issues[0].message);
    setNotesError(notesResult.success ? null : notesResult.error.issues[0].message);

    const errs: Record<string, ItemErrors> = {};
    const payload = items.map((it) => {
      const sets = parseTargetSets(it.sets);
      // Cardio is logged as time and distance, so it has no rep target.
      const reps = it.exercise.load_type === "cardio" ? parseRepRange("") : parseRepRange(it.reps);
      const itemNotes = itemNotesSchema.safeParse(it.notes);
      const err: ItemErrors = {};
      if (!sets.ok) err.sets = sets.error;
      if (!reps.ok) err.reps = reps.error;
      if (!itemNotes.success) err.notes = itemNotes.error.issues[0].message;
      if (Object.keys(err).length) errs[it.id] = err;
      return {
        id: it.id,
        exercise_id: it.exercise.id,
        target_sets: sets.ok ? sets.value : null,
        target_reps_min: reps.ok ? reps.value.min : null,
        target_reps_max: reps.ok ? reps.value.max : null,
        notes: it.notes.trim() || null,
      };
    });
    setItemErrors(errs);
    if (!nameResult.success || !notesResult.success || Object.keys(errs).length) return;

    const id = (idRef.current ??= crypto.randomUUID());
    try {
      await save.mutateAsync({ id, name: nameResult.data, notes, items: payload });
      setDirty(false);
      if (isNew) router.replace(`/workouts/routines/${id}`);
    } catch {
      /* shown via save.error */
    }
  }

  async function onDelete() {
    try {
      await del.mutateAsync(routine.id);
      setDirty(false);
      router.replace("/workouts");
    } catch {
      /* shown via del.error */
    }
  }

  return (
    <>
    <form onSubmit={onSave} noValidate className="space-y-4 pb-24 md:pb-0">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {save.error && <Alert tone="error" title="Couldn't save routine">{save.error.message}</Alert>}

      <Card className="space-y-4">
        <TextField label="Routine name" value={name} onChange={(e) => edit(setName)(e.target.value)} error={nameError} maxLength={100} placeholder="e.g. Push day" />
        <TextAreaField label="Notes (optional)" rows={2} maxLength={2000} value={notes} onChange={(e) => edit(setNotes)(e.target.value)} error={notesError} />
      </Card>

      <section aria-labelledby="routine-exercises-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="routine-exercises-heading" className="text-lg font-semibold">
            Exercises <span className="text-sm font-normal text-muted">({items.length})</span>
          </h2>
        </div>
        <p className="text-xs text-muted">Targets are optional. Leave them blank for no target. Reps can be a number (10) or a range (8–12).</p>

        {items.length === 0 ? (
          <EmptyState title="No exercises yet">Add exercises from the library or create your own.</EmptyState>
        ) : (
          <ol className="space-y-3">
            {items.map((it, index) => {
              const errs = itemErrors[it.id] ?? {};
              return (
                <li key={it.id}>
                  <Card className="space-y-3 p-3 sm:p-4" aria-label={`${index + 1}. ${it.exercise.name}`}>
                    <div className="flex items-start gap-2">
                      <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium">
                          {it.exercise.name}
                          <ExerciseBadges exercise={it.exercise as Exercise} />
                        </p>
                        <p className="truncate text-xs text-muted">{musclesText(it.exercise.muscles)}</p>
                      </div>
                      <div className="-mr-1 flex shrink-0">
                        <IconButton id={`move-up-${it.id}`} label={`Move ${it.exercise.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                          <ArrowUp aria-hidden className="size-4" />
                        </IconButton>
                        <IconButton id={`move-down-${it.id}`} label={`Move ${it.exercise.name} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                          <ArrowDown aria-hidden className="size-4" />
                        </IconButton>
                        <IconButton label={`Remove ${it.exercise.name}`} onClick={() => remove(index)}>
                          <Trash2 aria-hidden className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        label="Target sets"
                        inputMode="numeric"
                        placeholder="—"
                        value={it.sets}
                        onChange={(e) => updateItem(it.id, { sets: e.target.value })}
                        error={errs.sets}
                      />
                      {it.exercise.load_type === "cardio" ? (
                        <p className="self-end pb-3 text-xs text-muted">Cardio: log time and distance during the workout.</p>
                      ) : (
                        <TextField
                          label="Target reps"
                          placeholder="e.g. 8–12"
                          value={it.reps}
                          onChange={(e) => updateItem(it.id, { reps: e.target.value })}
                          error={errs.reps}
                        />
                      )}
                    </div>
                    <TextField
                      label="Note (optional)"
                      placeholder="e.g. pause at the bottom"
                      value={it.notes}
                      onChange={(e) => updateItem(it.id, { notes: e.target.value })}
                      error={errs.notes}
                      maxLength={1000}
                    />
                  </Card>
                </li>
              );
            })}
          </ol>
        )}

        <Button type="button" variant="secondary" className="w-full" onClick={() => setPickerOpen(true)}>
          <Plus aria-hidden className="size-4" /> Add exercise
        </Button>
      </section>

      {!isNew && (
        <div className="pt-2">
          <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden className="size-4" /> Delete routine
          </Button>
        </div>
      )}

      {/* Save bar: sits above the phone tab bar; inline on larger screens. */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          <p role="status" className="mr-auto text-sm text-muted">
            {save.isPending ? "Saving…" : dirty ? "Unsaved changes" : isNew ? "" : "All changes saved"}
          </p>
          <Button type="submit" loading={save.isPending} disabled={!dirty && !isNew}>
            Save routine
          </Button>
        </div>
      </div>
    </form>

      {/* Dialogs live outside the <form>: the picker contains its own form, and nested forms
          would bubble submit events into the routine save. */}
      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this routine?"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={del.isPending} onClick={onDelete}>
              Delete routine
            </Button>
          </div>
        }
      >
        {del.error && <Alert tone="error" className="mb-3">{del.error.message}</Alert>}
        <p className="text-sm text-muted">
          “{routine.name}” will be deleted. Workouts you already logged from it stay in your history unchanged.
        </p>
      </Dialog>
    </>
  );
}

function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
      {...rest}
    >
      {children}
    </button>
  );
}
