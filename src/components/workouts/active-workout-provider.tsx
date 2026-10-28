"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/providers";
import { activeWorkoutStore } from "@/lib/workouts/active-store";

/** Loads the signed-in account's active workout and keeps the sync engine running app-wide. */
export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  useEffect(() => {
    if (!ready) return;
    if (user) void activeWorkoutStore.init(user.id);
    else activeWorkoutStore.reset();
  }, [user, ready]);
  return children;
}
