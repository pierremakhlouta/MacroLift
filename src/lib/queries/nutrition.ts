"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { getSupabase } from "@/lib/supabase/client";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import type { UsdaFood } from "@/lib/nutrition/usda";
import { foodSchema, type FoodInput } from "@/lib/validation/food";

export type Food = Tables<"foods">;
export type DiaryEntry = Tables<"diary_entries">;
export type MealCategory = Enums<"meal_category">;
export type MealTemplate = Tables<"meal_templates"> & {
  items: (Tables<"meal_template_items"> & { food: Food | null })[];
};
export type NutritionTarget = Tables<"nutrition_targets">;

export const MEALS: { meal: MealCategory; label: string }[] = [
  { meal: "breakfast", label: "Breakfast" },
  { meal: "lunch", label: "Lunch" },
  { meal: "dinner", label: "Dinner" },
  { meal: "snack", label: "Snacks" },
];
export const mealLabel = (m: MealCategory) => MEALS.find((x) => x.meal === m)?.label ?? m;

// ---------------------------------------------------------------------------- foods

export function useFoods() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["foods", user?.id],
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Food[]> => {
      const { data, error } = await getSupabase().from("foods").select("*").order("name").limit(5000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

function friendlyFoodError(error: { code?: string; message: string }) {
  return new Error(error.code === "23505" ? "This food is already in your saved foods." : error.message);
}

export function useSaveFood() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: FoodInput }): Promise<Food> => {
      const values = foodSchema.parse(input);
      const supabase = getSupabase();
      const { data, error } = id
        ? await supabase.from("foods").update(values).eq("id", id).select("*").single()
        : await supabase.from("foods").insert({ ...values, owner_id: user!.id }).select("*").single();
      if (error) throw friendlyFoodError(error);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["foods"] }),
  });
}

export function useSetFoodArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await getSupabase().from("foods").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw friendlyFoodError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["foods"] }),
  });
}

/** Copy a USDA result into the user's saved foods (or reuse the earlier copy). */
export function useImportUsdaFood() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (f: UsdaFood): Promise<Food> => {
      const supabase = getSupabase();
      const existing = await supabase
        .from("foods")
        .select("*")
        .eq("source", "usda")
        .eq("source_ref", f.fdcId)
        .is("archived_at", null)
        .maybeSingle();
      if (existing.data) return existing.data;
      const { data, error } = await supabase
        .from("foods")
        .insert({
          owner_id: user!.id,
          source: "usda",
          source_ref: f.fdcId,
          name: f.name,
          brand: f.brand,
          serving_size: f.serving_size,
          serving_unit: f.serving_unit,
          calories_kcal: f.calories_kcal,
          protein_g: f.protein_g,
          carbs_g: f.carbs_g,
          fat_g: f.fat_g,
          fiber_g: f.fiber_g,
          sugar_g: f.sugar_g,
          sodium_mg: f.sodium_mg,
        })
        .select("*")
        .single();
      if (error) throw friendlyFoodError(error);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["foods"] }),
  });
}

export function useUsdaStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["usda-status", user?.id],
    enabled: Boolean(user),
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<boolean> => {
      const res = await fetch("/api/usda/status");
      if (!res.ok) return false;
      return Boolean((await res.json()).enabled);
    },
  });
}

export async function searchUsda(q: string, kind: "generic" | "branded"): Promise<UsdaFood[]> {
  const res = await fetch(`/api/usda/search?q=${encodeURIComponent(q)}&kind=${kind}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "USDA search failed");
  return body.foods as UsdaFood[];
}

// ---------------------------------------------------------------------------- diary

export function useDiaryDay(date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["diary", user?.id, date],
    enabled: Boolean(user),
    queryFn: async (): Promise<DiaryEntry[]> => {
      const { data, error } = await getSupabase()
        .from("diary_entries")
        .select("*, day:nutrition_days!inner(day)")
        .eq("day.day", date)
        .order("position");
      if (error) throw new Error(error.message);
      return (data as (DiaryEntry & { day: unknown })[]).map(({ day: _day, ...e }) => e);
    },
  });
}

export type NewDiaryItem =
  | { id: string; quantity: number; food_id: string; meal_template_id?: string | null }
  | {
      id: string;
      quantity: number;
      food_name: string;
      serving_size: number;
      serving_unit: string;
      calories_kcal: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      fiber_g?: number | null;
    };

export function useAddDiaryEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, meal, items }: { date: string; meal: MealCategory; items: NewDiaryItem[] }) => {
      const { error } = await getSupabase().rpc("add_diary_entries", { p_day: date, p_meal: meal, p_items: items as never });
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["diary"] }),
  });
}

export function useUpdateDiaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity, meal }: { id: string; quantity?: number; meal?: MealCategory }) => {
      const { error } = await getSupabase().from("diary_entries").update({ quantity, meal }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["diary"] }),
  });
}

export function useDeleteDiaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("diary_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["diary"] }),
  });
}

/** Undo for a deleted entry: put the exact snapshot back with the same id. */
export function useRestoreDiaryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: DiaryEntry) => {
      const { created_at: _c, updated_at: _u, ...row } = entry;
      const { error } = await getSupabase().from("diary_entries").upsert(row);
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["diary"] }),
  });
}

// ---------------------------------------------------------------------------- meal templates

export function useMealTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["meal-templates", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<MealTemplate[]> => {
      const { data, error } = await getSupabase()
        .from("meal_templates")
        .select("*, items:meal_template_items(*, food:foods(*))")
        .is("archived_at", null)
        .order("name");
      if (error) throw new Error(error.message);
      return (data as MealTemplate[]).map((t) => ({ ...t, items: [...t.items].sort((a, b) => a.position - b.position) }));
    },
  });
}

export function useSaveMealTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id: string; name: string; notes: string; items: { id: string; food_id: string; quantity: number }[] }) => {
      const { error } = await getSupabase().rpc("save_meal_template", { p_id: t.id, p_name: t.name, p_notes: t.notes, p_items: t.items });
      if (error) throw new Error(error.message);
      return t.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-templates"] }),
  });
}

export function useDeleteMealTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("meal_templates").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-templates"] }),
  });
}

// ---------------------------------------------------------------------------- targets

/** The user's own target in effect on `date` (latest effective_from on or before it). */
export function useTargetForDate(date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["targets", user?.id, date],
    enabled: Boolean(user),
    queryFn: async (): Promise<NutritionTarget | null> => {
      const { data, error } = await getSupabase()
        .from("nutrition_targets")
        .select("*")
        .lte("effective_from", date)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
