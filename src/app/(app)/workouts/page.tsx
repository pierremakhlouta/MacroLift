import { Dumbbell } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Workouts" };

export default function WorkoutsPage() {
  return (
    <>
      <PageHeader title="Workouts" />
      <EmptyState icon={<Dumbbell aria-hidden className="size-8" />} title="Coming soon">
        Routines, live workout logging, and history are coming in the next build phases.
      </EmptyState>
    </>
  );
}
