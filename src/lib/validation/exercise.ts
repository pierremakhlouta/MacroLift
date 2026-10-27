import { z } from "zod";
import { EQUIPMENT, LOAD_TYPES, MUSCLE_GROUPS, type Equipment, type LoadType, type MuscleGroup } from "@/lib/exercises/catalog";

// Mirrors the exercises / routines CHECK constraints.

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100, "Use 100 characters or fewer"),
  muscles: z
    .array(z.enum(MUSCLE_GROUPS as [MuscleGroup, ...MuscleGroup[]]))
    .min(1, "Choose at least one muscle group")
    .max(10, "Choose up to 10 muscle groups"),
  equipment: z.enum(Object.keys(EQUIPMENT) as [Equipment, ...Equipment[]]).nullable(),
  load_type: z.enum(Object.keys(LOAD_TYPES) as [LoadType, ...LoadType[]]),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const routineNameSchema = z.string().trim().min(1, "Enter a routine name").max(100, "Use 100 characters or fewer");
export const routineNotesSchema = z.string().max(2000, "Use 2000 characters or fewer");
export const itemNotesSchema = z.string().max(1000, "Use 1000 characters or fewer");
