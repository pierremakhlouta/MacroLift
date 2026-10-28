"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EstimateDetailsForm } from "@/components/estimate-details-form";
import { MaintenanceCard } from "@/components/nutrition/maintenance-card";
import { signOut, useAuth } from "@/components/providers";
import { Alert, Button, Card, PageHeader, QueryState, SegmentedRadio, TextField } from "@/components/ui";
import { authErrorMessage } from "@/lib/auth-errors";
import { useLatestWeight, useProfile, useSaveEstimateDetails, useUpdateProfile } from "@/lib/queries/profile";
import { getSupabase } from "@/lib/supabase/client";
import type { UnitSystem } from "@/lib/units";
import { firstError, passwordSchema, profileUpdateSchema } from "@/lib/validation/profile";

export default function ProfilePage() {
  const { user } = useAuth();
  const profile = useProfile();
  const latestWeight = useLatestWeight();
  const saveEstimateDetails = useSaveEstimateDetails();
  const [estimateSaved, setEstimateSaved] = useState(false);

  if (!profile.data) {
    return (
      <>
        <PageHeader title="Profile" />
        <QueryState isPending={profile.isPending} error={profile.error} onRetry={() => profile.refetch()} />
      </>
    );
  }

  const usesPassword = user?.app_metadata?.providers?.includes("email") ?? user?.app_metadata?.provider === "email";

  return (
    <>
      <PageHeader title="Profile" description={user?.email} />
      <div className="space-y-5">
        <Card aria-labelledby="prefs-heading">
          <h2 id="prefs-heading" className="mb-4 text-lg font-semibold">Preferences</h2>
          <div className="space-y-5">
            <DisplayNameForm initial={profile.data.display_name ?? ""} />
            <UnitsControl initial={profile.data.unit_system} />
          </div>
        </Card>

        <Card aria-labelledby="estimate-heading">
          <h2 id="estimate-heading" className="text-lg font-semibold">Maintenance estimate details</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Optional. Used only to show a maintenance calorie estimate. It never changes your calorie target.
          </p>
          {estimateSaved && <Alert tone="success" className="mb-4">Details saved.</Alert>}
          <EstimateDetailsForm
            key={`${profile.data.updated_at}-${profile.data.unit_system}-${latestWeight.data?.id ?? "none"}`}
            profile={profile.data}
            units={profile.data.unit_system}
            latestWeightKg={latestWeight.data?.weight_kg ?? null}
            submitLabel="Save details"
            onSubmit={async (values) => {
              setEstimateSaved(false);
              await saveEstimateDetails.mutateAsync({ values });
              setEstimateSaved(true);
            }}
          />
        </Card>

        <MaintenanceCard units={profile.data.unit_system} showEditLink={false} />

        {usesPassword && <ChangePasswordCard />}

        <Card aria-labelledby="account-heading">
          <h2 id="account-heading" className="mb-3 text-lg font-semibold">Account</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => signOut()}>
              <LogOut aria-hidden className="size-4" /> Sign out
            </Button>
            <Link href="/privacy" className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">
              Privacy notice
            </Link>
          </div>
        </Card>

        <DeleteAccountCard />
      </div>
    </>
  );
}

function UnitsControl({ initial }: { initial: UnitSystem }) {
  const updateProfile = useUpdateProfile();
  // Local state so the radio reflects the choice immediately; the server save follows.
  const [units, setUnits] = useState(initial);
  return (
    <>
      <SegmentedRadio
        legend="Units"
        name="unit_system"
        value={units}
        onChange={(unit_system) => {
          setUnits(unit_system);
          updateProfile.mutate({ unit_system }, { onError: () => setUnits(initial) });
        }}
        options={[
          { value: "metric", label: "Metric", description: "kg, cm" },
          { value: "imperial", label: "Imperial", description: "lb, ft/in" },
        ]}
      />
      {updateProfile.isError && <Alert tone="error">Couldn&apos;t save units: {updateProfile.error.message}</Alert>}
    </>
  );
}

function DisplayNameForm({ initial }: { initial: string }) {
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const value = name.trim() === "" ? null : name;
    const err = firstError(profileUpdateSchema.safeParse({ display_name: value }));
    setError(err);
    if (err) return;
    try {
      await updateProfile.mutateAsync({ display_name: value });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex items-end gap-3">
      <TextField
        className="flex-1"
        label="Display name (optional)"
        autoComplete="nickname"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        error={error}
        hint={saved ? "Saved." : undefined}
      />
      <Button type="submit" variant="secondary" loading={updateProfile.isPending} className={error || saved ? "mb-6" : ""}>
        Save
      </Button>
    </form>
  );
}

function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = firstError(passwordSchema.safeParse(password));
    setError(err);
    if (err) return;
    setStatus("saving");
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      setError(authErrorMessage(error));
      setStatus("idle");
    } else {
      setPassword("");
      setStatus("saved");
    }
  }

  return (
    <Card aria-labelledby="password-heading">
      <h2 id="password-heading" className="mb-3 text-lg font-semibold">Change password</h2>
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        {status === "saved" && <Alert tone="success">Password updated.</Alert>}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with letters and numbers."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <Button type="submit" variant="secondary" loading={status === "saving"}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

function DeleteAccountCard() {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    if (confirmText !== "DELETE") {
      setError('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    setError(null);
    const { error } = await getSupabase().rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      setError(error.message);
      return;
    }
    await signOut({ redirectTo: "/login?deleted=1" });
  }

  return (
    <Card aria-labelledby="delete-heading" className="border-danger/40">
      <h2 id="delete-heading" className="text-lg font-semibold text-danger">Delete account</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Permanently deletes your account and all of your workouts, routines, custom exercises and foods, meals, diary,
        targets, and body records. This can&apos;t be undone.
      </p>
      <form onSubmit={onDelete} noValidate className="space-y-3">
        <TextField
          label='Type "DELETE" to confirm'
          autoComplete="off"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          error={error}
        />
        <Button type="submit" variant="danger" loading={deleting} disabled={confirmText !== "DELETE"}>
          Delete my account
        </Button>
      </form>
    </Card>
  );
}
