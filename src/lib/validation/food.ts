import { z } from "zod";

// Mirrors the foods / diary CHECK constraints. Nutrients are optional: null = unknown.
const nutrient = (max: number) => z.number().finite("Enter a valid number").min(0, "Can't be negative").max(max, "Too large").nullable();

export const foodSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120, "Use 120 characters or fewer"),
  brand: z.string().trim().max(120, "Use 120 characters or fewer").nullable(),
  serving_size: z.number().finite("Enter a valid number").gt(0, "Must be more than 0").max(100000, "Too large"),
  serving_unit: z.string().trim().min(1, "Enter a unit, e.g. g or scoop").max(30, "Use 30 characters or fewer"),
  calories_kcal: nutrient(100000),
  protein_g: nutrient(10000),
  carbs_g: nutrient(10000),
  fat_g: nutrient(10000),
  fiber_g: nutrient(10000),
  sugar_g: nutrient(10000),
  sodium_mg: nutrient(1000000),
});

export type FoodInput = z.infer<typeof foodSchema>;

export const quantitySchema = z.number().finite("Enter a valid number").gt(0, "Must be more than 0").max(10000, "Too large");

export const mealNameSchema = z.string().trim().min(1, "Enter a meal name").max(100, "Use 100 characters or fewer");
