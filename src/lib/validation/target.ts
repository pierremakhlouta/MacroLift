import { z } from "zod";
import { isValidIsoDate } from "@/lib/dates";

// Mirrors the nutrition_targets CHECK constraints. Every value is optional: blank = no target for it.
const grams = (max: number) => z.number().finite("Enter a valid number").min(0, "Can't be negative").max(max, `Use ${max.toLocaleString()} g or less`).nullable();

export const targetSchema = z.object({
  effective_from: z
    .string()
    .refine(isValidIsoDate, "Enter a valid date")
    .refine((d) => d >= "1900-01-01" && d <= "2200-01-01", "Enter a realistic date"),
  calories_kcal: z.number().finite("Enter a valid number").gt(0, "Must be more than 0").max(20000, "Use 20,000 kcal or less").nullable(),
  protein_g: grams(2000),
  carbs_g: grams(5000),
  fat_g: grams(2000),
  fiber_g: grams(500),
});

export type TargetInput = z.infer<typeof targetSchema>;
