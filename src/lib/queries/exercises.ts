"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { getSupabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { exerciseSchema, type ExerciseInput } from "@/lib/validation/exercise";

export type Exercise = Tables<"exercises">;

export const exercisesKey = (userId: string | undefined) => ["exercises", userId] as const;

/** Built-in plus the user's own exercises (RLS returns exactly these), including archived ones. */
export function useExercises() {
  const { user } = useAuth();
  return useQuery({
    queryKey: exercisesKey(user?.id),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await getSupabase().from("exercises").select("*").order("name").limit(2000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export const isCustom = (e: Pick<Exercise, "owner_id">) => e.owner_id !== null;

function friendlyExerciseError(error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error("You already have an exercise with this name.");
  return new Error(error.message);
}

export function useSaveExercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ExerciseInput }): Promise<Exercise> => {
      const values = exerciseSchema.parse(input);
      const supabase = getSupabase();
      const { data, error } = id
        ? await supabase.from("exercises").update(values).eq("id", id).select("*").single()
        : await supabase.from("exercises").insert({ ...values, owner_id: user!.id }).select("*").single();
      if (error) throw friendlyExerciseError(error);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

/** Archive hides a custom exercise from pickers; history and routines keep working. */
export function useSetExerciseArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await getSupabase()
        .from("exercises")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw friendlyExerciseError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  });
}
