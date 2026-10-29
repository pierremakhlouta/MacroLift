import type { Enums } from "@/lib/supabase/database.types";

export type MuscleGroup = Enums<"muscle_group">;
export type Equipment = Enums<"equipment_type">;
export type LoadType = Enums<"load_type">;

/** Display label plus everyday words people search with ("back", "legs", "arms", "core"). */
export const MUSCLES: Record<MuscleGroup, { label: string; aliases: string[] }> = {
  chest: { label: "Chest", aliases: ["pecs", "pectorals"] },
  upper_back: { label: "Upper back", aliases: ["back", "rhomboids", "mid back"] },
  lats: { label: "Lats", aliases: ["back", "latissimus"] },
  lower_back: { label: "Lower back", aliases: ["back", "erectors", "spinal erectors"] },
  traps: { label: "Traps", aliases: ["back", "trapezius"] },
  shoulders: { label: "Shoulders", aliases: ["delts", "deltoids"] },
  biceps: { label: "Biceps", aliases: ["arms"] },
  triceps: { label: "Triceps", aliases: ["arms"] },
  forearms: { label: "Forearms", aliases: ["arms", "grip"] },
  abs: { label: "Abs", aliases: ["core", "abdominals"] },
  obliques: { label: "Obliques", aliases: ["core"] },
  quads: { label: "Quads", aliases: ["legs", "quadriceps", "thighs"] },
  hamstrings: { label: "Hamstrings", aliases: ["legs", "hams"] },
  glutes: { label: "Glutes", aliases: ["legs", "hips", "butt"] },
  calves: { label: "Calves", aliases: ["legs"] },
  adductors: { label: "Adductors", aliases: ["legs", "inner thigh"] },
  abductors: { label: "Abductors", aliases: ["legs", "outer hip"] },
  neck: { label: "Neck", aliases: [] },
  full_body: { label: "Full body", aliases: ["total body"] },
  cardio: { label: "Cardio", aliases: ["conditioning"] },
};

export const MUSCLE_GROUPS = Object.keys(MUSCLES) as MuscleGroup[];

/** Grouping for the custom-exercise muscle picker. */
export const MUSCLE_REGIONS: { label: string; muscles: MuscleGroup[] }[] = [
  { label: "Upper body", muscles: ["chest", "shoulders", "upper_back", "lats", "traps", "lower_back"] },
  { label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { label: "Core", muscles: ["abs", "obliques"] },
  { label: "Lower body", muscles: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { label: "Other", muscles: ["neck", "full_body", "cardio"] },
];

export const EQUIPMENT: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  band: "Band",
  smith_machine: "Smith machine",
  ez_bar: "EZ bar",
  trap_bar: "Trap bar",
  other: "Other",
};

export const LOAD_TYPES: Record<LoadType, { label: string; description: string }> = {
  external: { label: "Weight lifted", description: "Log the weight you move (barbell, dumbbell, machine)." },
  bodyweight: { label: "Bodyweight", description: "Weight is optional and means extra load added (belt, vest)." },
  assisted: { label: "Assisted", description: "Weight means assistance (counterweight), so lower is harder." },
  cardio: { label: "Time and distance", description: "For cardio like a treadmill, bike or rowing machine. No weight or reps." },
};

export const muscleLabel = (m: MuscleGroup) => MUSCLES[m]?.label ?? m;
export const musclesText = (ms: readonly MuscleGroup[]) => ms.map(muscleLabel).join(", ");
