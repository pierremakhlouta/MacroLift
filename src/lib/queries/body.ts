"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { getSupabase } from "@/lib/supabase/client";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type WeightEntry = Pick<Tables<"weight_entries">, "id" | "measured_on" | "weight_kg" | "note">;
export type Measurement = Pick<Tables<"body_measurements">, "id" | "measured_on" | "site" | "value_cm">;
export type MeasurementSite = Enums<"measurement_site">;

export const MEASUREMENT_SITES: { site: MeasurementSite; label: string }[] = [
  { site: "waist", label: "Waist" },
  { site: "hips", label: "Hips" },
  { site: "chest", label: "Chest" },
  { site: "shoulders", label: "Shoulders" },
  { site: "neck", label: "Neck" },
  { site: "left_arm", label: "Left arm" },
  { site: "right_arm", label: "Right arm" },
  { site: "left_forearm", label: "Left forearm" },
  { site: "right_forearm", label: "Right forearm" },
  { site: "left_thigh", label: "Left thigh" },
  { site: "right_thigh", label: "Right thigh" },
  { site: "left_calf", label: "Left calf" },
  { site: "right_calf", label: "Right calf" },
];
export const siteLabel = (s: MeasurementSite) => MEASUREMENT_SITES.find((m) => m.site === s)?.label ?? s;

export function useWeightEntries() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["weight", user?.id, "all"],
    enabled: Boolean(user),
    queryFn: async (): Promise<WeightEntry[]> => {
      const { data, error } = await getSupabase()
        .from("weight_entries")
        .select("id, measured_on, weight_kg, note")
        .order("measured_on", { ascending: true })
        .limit(5000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** One weigh-in per day: saving a date that already has one replaces it. */
export function useSaveWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { measured_on: string; weight_kg: number; note: string | null }) => {
      const { error } = await getSupabase().from("weight_entries").upsert(v, { onConflict: "user_id,measured_on" });
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["weight"] }),
  });
}

export function useDeleteWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("weight_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["weight"] }),
  });
}

export function useMeasurements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["measurements", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Measurement[]> => {
      const { data, error } = await getSupabase()
        .from("body_measurements")
        .select("id, measured_on, site, value_cm")
        .order("measured_on", { ascending: true })
        .limit(10000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useSaveMeasurements() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { measured_on: string; site: MeasurementSite; value_cm: number }[]) => {
      if (rows.length === 0) return;
      const { error } = await getSupabase().from("body_measurements").upsert(rows, { onConflict: "user_id,measured_on,site" });
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["measurements"] }),
  });
}

export function useDeleteMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("body_measurements").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["measurements"] }),
  });
}
