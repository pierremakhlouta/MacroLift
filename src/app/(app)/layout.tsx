import { AppShell } from "@/components/app-shell";
import { ActiveWorkoutProvider } from "@/components/workouts/active-workout-provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ActiveWorkoutProvider>
      <AppShell>{children}</AppShell>
    </ActiveWorkoutProvider>
  );
}
