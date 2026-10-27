"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EstimateDetailsForm } from "@/components/estimate-details-form";
import { Logo } from "@/components/logo";
import { Alert, Button, Card, QueryState, SegmentedRadio } from "@/components/ui";
import { useLatestWeight, useProfile, useSaveEstimateDetails, useUpdateProfile } from "@/lib/queries/profile";
import type { UnitSystem } from "@/lib/units";

type Step = "units" | "estimate-intro" | "estimate" | "done";

const STEP_TITLES: Record<Step, string> = {
  units: "Choose your units",
  "estimate-intro": "Maintenance estimate (optional)",
  estimate: "Your details",
  done: "You're all set",
};

export default function OnboardingPage() {
  const router = useRouter();
  const profile = useProfile();
  const latestWeight = useLatestWeight();
  const updateProfile = useUpdateProfile();
  const saveEstimateDetails = useSaveEstimateDetails();
  const [step, setStep] = useState<Step>("units");
  const [chosenUnits, setUnits] = useState<UnitSystem | null>(null);
  const units: UnitSystem = chosenUnits ?? profile.data?.unit_system ?? "metric";
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new step heading for screen-reader and keyboard users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  async function finish(extra: Parameters<typeof updateProfile.mutateAsync>[0] = {}) {
    setError(null);
    try {
      await updateProfile.mutateAsync({ ...extra, onboarding_completed_at: new Date().toISOString() });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  }

  async function saveUnits() {
    setError(null);
    try {
      await updateProfile.mutateAsync({ unit_system: units });
      setStep("estimate-intro");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  }

  const stepIndex = (["units", "estimate-intro", "done"] as const).indexOf(step === "estimate" ? "estimate-intro" : step) + 1;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8">
      <Logo className="mb-6 text-lg" />
      <p className="mb-2 text-sm text-muted">Step {stepIndex} of 3</p>
      <Card>
        <h1 ref={headingRef} tabIndex={-1} className="mb-4 text-xl font-bold outline-none">
          {STEP_TITLES[step]}
        </h1>

        {error && <Alert tone="error" className="mb-4">{error}</Alert>}

        {(profile.isPending || profile.error) && (
          <QueryState isPending={profile.isPending} error={profile.error} onRetry={() => profile.refetch()} />
        )}

        {profile.data && step === "units" && (
          <div className="space-y-5">
            <SegmentedRadio
              legend="Units for weights and measurements"
              name="unit_system"
              value={units}
              onChange={setUnits}
              hint="You can change this any time. Your data is stored the same way either way."
              options={[
                { value: "metric", label: "Metric", description: "kg, cm" },
                { value: "imperial", label: "Imperial", description: "lb, ft/in" },
              ]}
            />
            <Button className="w-full" loading={updateProfile.isPending} onClick={saveUnits}>
              Continue
            </Button>
          </div>
        )}

        {profile.data && step === "estimate-intro" && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              {`MacroLift can show an estimate of the calories you'd need to maintain your current weight, using the Mifflin–St Jeor formula. It needs your date of birth, height, weight, activity level, and a formula coefficient.`}
            </p>
            <p className="text-muted">
              {`The estimate is shown separately and is never used to set your calorie target. You choose your own target. You can skip this and add details later in Profile.`}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="sm:flex-1" onClick={() => setStep("estimate")}>
                Add my details
              </Button>
              <Button variant="secondary" className="sm:flex-1" loading={updateProfile.isPending} onClick={() => finish()}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {profile.data && step === "estimate" && (
          <EstimateDetailsForm
            profile={profile.data}
            units={units}
            latestWeightKg={latestWeight.data?.weight_kg ?? null}
            submitLabel="Save and finish"
            secondaryAction={
              <Button type="button" variant="secondary" onClick={() => finish()}>
                Skip for now
              </Button>
            }
            onSubmit={async (values) => {
              await saveEstimateDetails.mutateAsync({
                values,
                extra: { onboarding_completed_at: new Date().toISOString() },
              });
              setStep("done");
            }}
          />
        )}

        {step === "done" && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-ok">
              <CheckCircle2 aria-hidden className="size-5" /> Setup saved.
            </p>
            <p className="text-sm text-muted">
              Next you can set your own calorie and macro targets, build routines, or start logging.
            </p>
            <Button className="w-full" onClick={() => router.replace("/dashboard")}>
              Go to dashboard
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
