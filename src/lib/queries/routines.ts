"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { getSupabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export type RoutineItem = Tables<"routine_exercises"> & {
  exercise: Pick<Tables<"exercises">, "id" | "name" | "muscles" | "equipment" | "load_type" | "archived_at" | "owner_id"> | null;
};
export type Routine = Tables<"routines"> & { items: RoutineItem[] };

const ROUTINE_SELECT =
  "*, items:routine_exercises(*, exercise:exercises(id, name, muscles, equipment, load_type, archived_at, owner_id))";

const sortItems = (r: Routine): Routine => ({ ...r, items: [...r.items].sort((a, b) => a.position - b.position) });

export function useRoutines() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["routines", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Routine[]> => {
      const { data, error } = await getSupabase()
        .from("routines")
        .select(ROUTINE_SELECT)
        .is("archived_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Routine[]).map(sortItems);
    },
  });
}

export function useRoutine(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["routines", user?.id, id],
    enabled: Boolean(user && id),
    queryFn: async (): Promise<Routine | null> => {
      const { data, error } = await getSupabase().from("routines").select(ROUTINE_SELECT).eq("id", id!).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? sortItems(data as Routine) : null;
    },
  });
}

export type RoutineDraftItem = {
  id: string;
  exercise_id: string;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  notes: string | null;
};

/** Atomic, idempotent save of a routine and its ordered exercises (see save_routine()). */
export function useSaveRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: { id: string; name: string; notes: string; items: RoutineDraftItem[] }) => {
      const { error } = await getSupabase().rpc("save_routine", {
        p_id: draft.id,
        p_name: draft.name,
        p_notes: draft.notes,
        p_items: draft.items,
      });
      if (error) throw new Error(error.message);
      return draft.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routines"] }),
  });
}

/** Deleting a routine never touches workout history: sessions keep a snapshot of its name. */
export function useDeleteRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("routines").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routines"] }),
  });
}
