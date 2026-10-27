"use client";

import { Dumbbell, LineChart, UtensilsCrossed } from "lucide-react";
import { Alert, ButtonLink, Card, PageHeader, QueryState } from "@/components/ui";
import { useLatestWeight, useProfile, useUnitSystem } from "@/lib/queries/profile";
import { formatWeight } from "@/lib/units";

export default function DashboardPage() {
  const profile = useProfile();
  const latestWeight = useLatestWeight();
  const units = useUnitSystem();

  const greeting = profile.data?.display_name ? `Hi, ${profile.data.display_name}` : "Dashboard";
  const missingEstimateDetails =
    profile.data &&
    (!profile.data.birth_date || !profile.data.height_cm || !profile.data.activity_level || !profile.data.estimate_sex);

  return (
    <>
      <PageHeader title={greeting} />
      <div className="space-y-4">
        <QueryState isPending={profile.isPending} error={profile.error} onRetry={() => profile.refetch()} />

        {profile.data && !profile.data.onboarding_completed_at && (
          <Alert tone="info" title="Finish setting up" action={<ButtonLink href="/onboarding" variant="secondary">Continue setup</ButtonLink>}>
            Choose your units and, optionally, add details for a maintenance estimate.
          </Alert>
        )}

        <Card aria-labelledby="today-workout">
          <div className="flex items-center gap-3">
            <Dumbbell aria-hidden className="size-5 text-accent" />
            <h2 id="today-workout" className="text-lg font-semibold">Today&apos;s workout</h2>
          </div>
          <p className="mt-2 text-sm text-muted">Workout logging arrives in the next build phase.</p>
        </Card>

        <Card aria-labelledby="today-nutrition">
          <div className="flex items-center gap-3">
            <UtensilsCrossed aria-hidden className="size-5 text-accent" />
            <h2 id="today-nutrition" className="text-lg font-semibold">Nutrition today</h2>
          </div>
          <p className="mt-2 text-sm text-muted">Your diary totals will appear here once nutrition logging is built.</p>
        </Card>

        <Card aria-labelledby="recent-progress">
          <div className="flex items-center gap-3">
            <LineChart aria-hidden className="size-5 text-accent" />
            <h2 id="recent-progress" className="text-lg font-semibold">Recent progress</h2>
          </div>
          {latestWeight.data ? (
            <p className="mt-2 text-sm">
              Latest weigh-in: <strong>{formatWeight(latestWeight.data.weight_kg, units)}</strong>{" "}
              <span className="text-muted">on {latestWeight.data.measured_on}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">{latestWeight.isPending ? "Loading…" : "No weigh-ins yet."}</p>
          )}
        </Card>

        {profile.data?.onboarding_completed_at && missingEstimateDetails && (
          <Alert tone="info" title="Want a maintenance estimate?" action={<ButtonLink href="/profile" variant="secondary">Add details</ButtonLink>}>
            Add your details in Profile. The estimate is shown separately and never changes your target.
          </Alert>
        )}
      </div>
    </>
  );
}
