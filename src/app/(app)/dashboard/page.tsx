"use client";

import { NutritionTodayCard, RecentProgressCard } from "@/components/dashboard-cards";
import { StartWorkoutCard } from "@/components/workouts/start-workout-card";
import { Alert, ButtonLink, PageHeader, QueryState } from "@/components/ui";
import { useProfile, useUnitSystem } from "@/lib/queries/profile";

export default function DashboardPage() {
  const profile = useProfile();
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

        <StartWorkoutCard />

        <NutritionTodayCard />
        <RecentProgressCard units={units} />

        {profile.data?.onboarding_completed_at && missingEstimateDetails && (
          <Alert tone="info" title="Want a maintenance estimate?" action={<ButtonLink href="/profile" variant="secondary">Add details</ButtonLink>}>
            Add your details in Profile. The estimate is shown separately and never changes your target.
          </Alert>
        )}
      </div>
    </>
  );
}
