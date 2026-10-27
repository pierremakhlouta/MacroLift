import { z } from "zod";
import { isValidIsoDate, todayIsoDate } from "@/lib/dates";

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export const ESTIMATE_SEXES = ["male", "female"] as const;
export const ACTIVITY_LEVELS = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extra_active",
] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type EstimateSex = (typeof ESTIMATE_SEXES)[number];

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, { label: string; description: string }> = {
  sedentary: { label: "Sedentary", description: "Little or no exercise, mostly sitting" },
  lightly_active: { label: "Lightly active", description: "Light exercise 1–3 days a week" },
  moderately_active: { label: "Moderately active", description: "Moderate exercise 3–5 days a week" },
  very_active: { label: "Very active", description: "Hard exercise 6–7 days a week" },
  extra_active: { label: "Extra active", description: "Very hard exercise or a physical job" },
};

const birthDate = z
  .string()
  .refine(isValidIsoDate, "Enter a valid date")
  .refine((d) => d >= "1900-01-01", "Enter a date after 1900")
  .refine((d) => d <= todayIsoDate(), "Birth date can't be in the future");

/** Mirrors the database CHECK constraints so users get immediate, specific errors. */
export const profileUpdateSchema = z
  .object({
    display_name: z.string().trim().min(1, "Enter a name").max(80, "Use 80 characters or fewer").nullable(),
    unit_system: z.enum(UNIT_SYSTEMS),
    birth_date: birthDate.nullable(),
    height_cm: z.number().finite("Enter a valid height").gt(0, "Height must be above 0").lt(300, "Enter a realistic height").nullable(),
    estimate_sex: z.enum(ESTIMATE_SEXES).nullable(),
    activity_level: z.enum(ACTIVITY_LEVELS).nullable(),
    onboarding_completed_at: z.iso.datetime().nullable(),
  })
  .partial();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const bodyWeightKgSchema = z
  .number()
  .finite("Enter a valid weight")
  .gt(0, "Weight must be above 0")
  .lt(1000, "Enter a realistic weight");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

// Matches supabase/config.toml: minimum 8 characters, letters and digits.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export function firstError(result: { success: boolean; error?: z.ZodError }): string | null {
  return result.success ? null : (result.error?.issues[0]?.message ?? "Invalid value");
}
