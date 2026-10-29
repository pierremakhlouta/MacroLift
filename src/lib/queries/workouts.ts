"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { getSupabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export type HistorySet = Pick<Tables<"workout_sets">, "id" | "position" | "reps" | "weight_kg" | "duration_seconds" | "distance_m" | "is_warmup" | "notes">;
export type HistoryExercise = Pick<
  Tables<"session_exercises">,
  "id" | "exercise_name_snapshot" | "load_type_snapshot" | "position" | "notes" | "target_sets" | "target_reps_min" | "target_reps_max"
> & { sets: HistorySet[] };
export type HistoryWorkout = Pick<
  Tables<"workout_sessions">,
  "id" | "name" | "routine_name_snapshot" | "started_at" | "completed_at" | "notes"
> & { exercises: HistoryExercise[] };

const HISTORY_SELECT =
  "id, name, routine_name_snapshot, started_at, completed_at, notes, " +
  "exercises:session_exercises(id, exercise_name_snapshot, load_type_snapshot, position, notes, target_sets, target_reps_min, target_reps_max, " +
  "sets:workout_sets(id, position, reps, weight_kg, duration_seconds, distance_m, is_warmup, notes))";

const PAGE_SIZE = 15;

function sortWorkout(w: HistoryWorkout): HistoryWorkout {
  return {
    ...w,
    exercises: [...w.exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({ ...e, sets: [...e.sets].sort((a, b) => a.position - b.position) })),
  };
}

/** Completed workouts, newest first, paginated. History rows hold snapshots, never live routine/exercise data. */
export function useWorkoutHistory() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["workout-history", user?.id],
    enabled: Boolean(user),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<HistoryWorkout[]> => {
      const { data, error } = await getSupabase()
        .from("workout_sessions")
        .select(HISTORY_SELECT)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      return (data as unknown as HistoryWorkout[]).map(sortWorkout);
    },
    getNextPageParam: (last, pages) => (last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
  });
}

export function useWorkout(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workout", user?.id, id],
    enabled: Boolean(user && id),
    queryFn: async (): Promise<HistoryWorkout | null> => {
      const { data, error } = await getSupabase()
        .from("workout_sessions")
        .select(HISTORY_SELECT)
        .eq("id", id!)
        .eq("status", "completed")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? sortWorkout(data as unknown as HistoryWorkout) : null;
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("workout_sessions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workout-history"] });
      void queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}
