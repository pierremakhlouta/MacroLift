import { LineChart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progress" />
      <EmptyState icon={<LineChart aria-hidden className="size-8" />} title="Coming soon">
        Weight trends and body measurements are coming in a later build phase.
      </EmptyState>
    </>
  );
}
