"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { getSupabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import type { UnitSystem } from "@/lib/units";
import { profileUpdateSchema, type ProfileUpdate } from "@/lib/validation/profile";
import { todayIsoDate } from "@/lib/dates";
import type { EstimateDetailsValues } from "@/components/estimate-details-form";

export type Profile = Tables<"profiles">;

export const profileKey = (userId: string | undefined) => ["profile", userId] as const;

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKey(user?.id),
    enabled: Boolean(user),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await getSupabase().from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useUnitSystem(): UnitSystem {
  return useProfile().data?.unit_system ?? "metric";
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: ProfileUpdate): Promise<Profile> => {
      const parsed = profileUpdateSchema.parse(update);
      const { data, error } = await getSupabase()
        .from("profiles")
        .update(parsed)
        .eq("id", user!.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    // Optimistic so toggles (e.g. units) respond instantly; rolled back if the server rejects.
    onMutate: async (update) => {
      const key = profileKey(user?.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, ...update } as Profile);
      return { previous };
    },
    onError: (_err, _update, context) => {
      if (context?.previous) queryClient.setQueryData(profileKey(user?.id), context.previous);
    },
    onSuccess: (profile) => queryClient.setQueryData(profileKey(user?.id), profile),
  });
}

/** Most recent weigh-in, used by the maintenance estimate and the dashboard. */
export function useLatestWeight() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["weight", "latest", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("weight_entries")
        .select("id, measured_on, weight_kg")
        .order("measured_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** Record (or replace) today's weigh-in, in kg. */
async function upsertTodayWeight(weightKg: number) {
  const { error } = await getSupabase()
    .from("weight_entries")
    .upsert({ measured_on: todayIsoDate(), weight_kg: weightKg }, { onConflict: "user_id,measured_on" });
  if (error) throw new Error(error.message);
}

/** Save estimate inputs: an optional weigh-in for today plus profile fields. */
export function useSaveEstimateDetails() {
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, extra = {} }: { values: EstimateDetailsValues; extra?: ProfileUpdate }) => {
      if (values.weightKg != null) await upsertTodayWeight(values.weightKg);
      return updateProfile.mutateAsync({ ...values.profile, ...extra });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["weight"] }),
  });
}
