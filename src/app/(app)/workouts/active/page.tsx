"use client";

import { ArrowDown, ArrowUp, Dumbbell, MessageSquarePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNow } from "@/lib/hooks/use-now";
import { Dialog } from "@/components/dialog";
import { ExercisePicker } from "@/components/exercises/exercise-picker";
import { UndoToast, type UndoAction } from "@/components/undo-toast";
import { Alert, Button, ButtonLink, Card, EmptyState, Spinner, TextAreaField, TextField } from "@/components/ui";
import { SetRow, weightColumnLabel } from "@/components/workouts/set-row";
import { SyncStatusBadge, syncDetail } from "@/components/workouts/sync-status";
import { useUnitSystem } from "@/lib/queries/profile";
import { formatTarget } from "@/lib/routines/targets";
import { distanceUnitLabel, formatDistance, formatSeconds, formatWeight, weightUnitLabel } from "@/lib/units";
import { activeWorkoutStore, useActiveWorkout } from "@/lib/workouts/active-store";
import { formatDuration, workoutSummary } from "@/lib/workouts/summary";
import { setsFor, sortedExercises, type ActiveWorkout, type LocalExercise } from "@/lib/workouts/sync-core";

function summarize(w: ActiveWorkout, completedAt: string) {
  return workoutSummary({
    started_at: w.session.started_at,
    completed_at: completedAt,
    exercises: sortedExercises(w).map((e) => ({ load_type_snapshot: e.load_type_snapshot, sets: setsFor(w, e.id) })),
  });
}

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { loaded, workout, status, error, finishedSessionId, notice, generation } = useActiveWorkout();
  const units = useUnitSystem();
  const now = useNow();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const undoSeq = useRef(0);
  const clearUndo = useCallback(() => setUndo(null), []);

  // Once a finished workout is fully saved, show its summary in history.
  useEffect(() => {
    if (finishedSessionId) {
      activeWorkoutStore.dismissFinished();
      router.replace(`/workouts/history/${finishedSessionId}?finished=1`);
    }
  }, [finishedSessionId, router]);

  if (!loaded && !workout) return <Spinner label="Loading your workout" />;

  if (!workout) {
    return (
      <>
        {notice && (
          <Alert tone="info" className="mb-4" action={<Button variant="secondary" onClick={() => activeWorkoutStore.dismissNotice()}>OK</Button>}>
            {notice}
          </Alert>
        )}
        <EmptyState
          icon={<Dumbbell aria-hidden className="size-8" />}
          title="No workout in progress"
          action={<ButtonLink href="/workouts">Start a workout</ButtonLink>}
        >
          Start a blank workout or one of your routines.
        </EmptyState>
      </>
    );
  }

  const exercises = sortedExercises(workout);
  const finishedLocally = workout.session.status === "completed";
  const elapsed = formatDuration(now - Date.parse(workout.session.started_at));
  const preview = summarize(workout, new Date(now).toISOString());

  if (finishedLocally) {
    // Finished on this device but not yet confirmed by the server (e.g. offline).
    return (
      <>
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Workout finished</h1>
          <SyncStatusBadge status={status} />
        </header>
        <Alert tone="warning" title="Waiting to upload">
          Your finished workout is saved on this device and will upload automatically when the connection returns. Keep
          this tab open or come back later.
        </Alert>
        {error && <Alert tone="error" className="mt-3">{error}</Alert>}
        <Card className="mt-4">
          <p className="text-sm text-muted">
            {preview.loggedSets} sets · {preview.totalReps} reps
            {preview.volumeKg != null && ` · ${formatWeight(preview.volumeKg, units, 0)} volume`}
          </p>
        </Card>
        <Button className="mt-4" variant="secondary" onClick={() => void activeWorkoutStore.flush()}>
          Try uploading now
        </Button>
      </>
    );
  }

  function removeExercise(ex: LocalExercise) {
    const removed = activeWorkoutStore.removeExercise(ex.id);
    if (removed) setUndo({ id: ++undoSeq.current, message: `${ex.exercise_name_snapshot} removed`, undo: () => activeWorkoutStore.restoreExercise(removed) });
  }

  return (
    <div className="pb-28 md:pb-4">
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            <span className="sr-only">Elapsed time: </span>
            {elapsed}
            {workout.session.routine_name_snapshot && <> · from {workout.session.routine_name_snapshot}</>}
          </p>
          {/* Compact: the offline explanation is shown as visible text below. */}
          <SyncStatusBadge status={status} compact />
        </div>
        <h1 className="sr-only">Active workout</h1>
        <WorkoutNameField key={`${workout.session.id}-${generation}`} initial={workout.session.name ?? ""} />
        {status === "offline" && <p className="text-xs text-warn">{syncDetail("offline")}</p>}
        {status === "error" && error && (
          <Alert tone="warning" title="Not synced yet" action={<Button variant="secondary" onClick={() => void activeWorkoutStore.flush()}>Retry now</Button>}>
            {/one_active/.test(error)
              ? "Another workout is already in progress (perhaps on another device). Discard this one, or finish the other first."
              : `${error}. Your changes are kept on this device.`}
          </Alert>
        )}
      </header>

      <ConflictDialog workout={workout} />

      {exercises.length === 0 ? (
        <EmptyState title="No exercises yet">Add your first exercise to start logging sets.</EmptyState>
      ) : (
        <ol className="space-y-4">
          {exercises.map((ex, i) => (
            <li key={`${ex.id}-${generation}`}>
              <ExerciseCard
                exercise={ex}
                workout={workout}
                index={i}
                count={exercises.length}
                units={units}
                onRemove={() => removeExercise(ex)}
                onRemoveSet={(setId, setNumber) => {
                  const removed = activeWorkoutStore.removeSet(setId);
                  if (removed)
                    setUndo({ id: ++undoSeq.current, message: `Set ${setNumber} removed`, undo: () => activeWorkoutStore.restoreSet(removed) });
                }}
              />
            </li>
          ))}
        </ol>
      )}

      <Button variant="secondary" className="mt-4 w-full" onClick={() => setPickerOpen(true)}>
        <Plus aria-hidden className="size-4" /> Add exercise
      </Button>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="danger" onClick={() => setConfirmDiscard(true)}>
          Discard workout
        </Button>
        <Button onClick={() => setConfirmFinish(true)}>Finish workout</Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(e) => activeWorkoutStore.addExercise({ id: e.id, name: e.name, load_type: e.load_type })}
      />

      <Dialog
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title="Finish workout?"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmFinish(false)}>
              Keep logging
            </Button>
            <Button
              onClick={() => {
                setConfirmFinish(false);
                activeWorkoutStore.finish();
              }}
            >
              Finish workout
            </Button>
          </div>
        }
      >
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Duration" value={elapsed} />
          <Stat label="Sets logged" value={String(preview.loggedSets)} />
          <Stat label="Reps" value={String(preview.totalReps)} />
          <Stat label="Volume" value={preview.volumeKg == null ? "—" : formatWeight(preview.volumeKg, units, 0)} />
          {preview.cardioSeconds != null && <Stat label="Cardio time" value={formatSeconds(preview.cardioSeconds)} />}
          {preview.cardioDistanceM != null && <Stat label="Distance" value={formatDistance(preview.cardioDistanceM, units)} />}
        </dl>
        {preview.loggedSets === 0 && (
          <Alert tone="warning" className="mt-3">
            No sets logged yet. Sets count once reps are entered, or for cardio a time or distance.
          </Alert>
        )}
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this workout?"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDiscard(false);
                activeWorkoutStore.discard();
                router.replace("/workouts");
              }}
            >
              Discard workout
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">Everything logged in this workout will be deleted. It won&apos;t appear in your history.</p>
      </Dialog>

      <UndoToast action={undo} onDone={clearUndo} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function WorkoutNameField({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  return (
    <TextField
      label="Workout name"
      placeholder="e.g. Upper body"
      maxLength={100}
      value={name}
      onChange={(e) => {
        setName(e.target.value);
        activeWorkoutStore.updateSession({ name: e.target.value.trim() || null });
      }}
    />
  );
}

function ExerciseCard({
  exercise,
  workout,
  index,
  count,
  units,
  onRemove,
  onRemoveSet,
}: {
  exercise: LocalExercise;
  workout: ActiveWorkout;
  index: number;
  count: number;
  units: ReturnType<typeof useUnitSystem>;
  onRemove: () => void;
  onRemoveSet: (setId: string, setNumber: number) => void;
}) {
  const sets = setsFor(workout, exercise.id);
  const target = formatTarget(exercise.target_sets, { min: exercise.target_reps_min, max: exercise.target_reps_max });
  const [showNotes, setShowNotes] = useState(Boolean(exercise.notes));
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const name = exercise.exercise_name_snapshot;

  return (
    <Card className="p-3 sm:p-4" aria-label={`${index + 1}. ${name}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{name}</h2>
          {target && <p className="text-xs text-muted">Target {target}</p>}
          {exercise.load_type_snapshot === "bodyweight" && <p className="text-xs text-muted">Bodyweight · weight is optional added load</p>}
          {exercise.load_type_snapshot === "assisted" && <p className="text-xs text-muted">Assisted · weight is assistance</p>}
          {exercise.load_type_snapshot === "cardio" && <p className="text-xs text-muted">Cardio · time as minutes or mm:ss</p>}
        </div>
        <div className="-mr-1 flex shrink-0">
          <IconButton label={`Move ${name} up`} disabled={index === 0} onClick={() => activeWorkoutStore.moveExercise(exercise.id, -1)}>
            <ArrowUp aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={`Move ${name} down`} disabled={index === count - 1} onClick={() => activeWorkoutStore.moveExercise(exercise.id, 1)}>
            <ArrowDown aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={`Remove ${name}`} onClick={onRemove}>
            <Trash2 aria-hidden className="size-4" />
          </IconButton>
        </div>
      </div>

      <div aria-hidden className="mt-3 grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>Set</span>
        {exercise.load_type_snapshot === "cardio" ? (
          <>
            <span>Distance ({distanceUnitLabel(units)})</span>
            <span>Time</span>
          </>
        ) : (
          <>
            <span>
              {weightColumnLabel(exercise.load_type_snapshot)} ({weightUnitLabel(units)})
            </span>
            <span>Reps</span>
          </>
        )}
        <span />
        <span />
      </div>
      <ol className="mt-1 space-y-2" aria-label={`${name} sets`}>
        {sets.map((s, i) => (
          <SetRow
            key={`${s.id}-${units}`}
            set={s}
            index={i}
            units={units}
            loadType={exercise.load_type_snapshot}
            exerciseName={name}
            onChange={(patch) => activeWorkoutStore.updateSet(s.id, patch)}
            onRemove={() => onRemoveSet(s.id, i + 1)}
          />
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => activeWorkoutStore.addSet(exercise.id)} aria-label={`Add set to ${name}`}>
          <Plus aria-hidden className="size-4" /> Add set
        </Button>
        {!showNotes && (
          <Button variant="ghost" onClick={() => setShowNotes(true)} aria-label={`Add note to ${name}`}>
            <MessageSquarePlus aria-hidden className="size-4" /> Note
          </Button>
        )}
      </div>
      {showNotes && (
        <TextAreaField
          className="mt-3"
          label={`Notes for ${name}`}
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            activeWorkoutStore.updateExercise(exercise.id, { notes: e.target.value.trim() || null });
          }}
        />
      )}
    </Card>
  );
}

function IconButton({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
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

function ConflictDialog({ workout }: { workout: ActiveWorkout }) {
  const [busy, setBusy] = useState<"server" | "mine" | null>(null);
  const open = workout.conflicts.length > 0;
  const deleted = workout.conflicts.some((c) => c.reason !== "modified");

  async function run(which: "server" | "mine") {
    setBusy(which);
    if (which === "server") await activeWorkoutStore.useServerVersion();
    else await activeWorkoutStore.keepThisVersion();
    setBusy(null);
  }

  return (
    <Dialog
      open={open}
      onClose={() => {}}
      title="This workout changed somewhere else"
      size="sm"
      dismissible={false}
      footer={
        <div className="flex flex-col gap-3">
          <Button loading={busy === "mine"} onClick={() => run("mine")}>
            Keep this device&apos;s version
          </Button>
          <Button variant="secondary" loading={busy === "server"} onClick={() => run("server")}>
            Use the saved version
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted">
        {deleted
          ? "Part of this workout was removed or finished on another device or tab after your last save."
          : "It was edited on another device or tab after your last save."}{" "}
        Nothing has been overwritten. Choose which version to keep.
      </p>
      <p className="mt-2 text-sm text-muted">
        {workout.conflicts.length} {workout.conflicts.length === 1 ? "item differs" : "items differ"}.
      </p>
    </Dialog>
  );
}
