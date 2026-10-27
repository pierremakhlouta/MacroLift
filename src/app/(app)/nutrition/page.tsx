import { UtensilsCrossed } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Nutrition" };

export default function NutritionPage() {
  return (
    <>
      <PageHeader title="Nutrition" />
      <EmptyState icon={<UtensilsCrossed aria-hidden className="size-8" />} title="Coming soon">
        Your food diary, saved foods, and meals are coming in a later build phase.
      </EmptyState>
    </>
  );
}
