"use client";

import { toLocalIsoDate } from "@/lib/dates";
import { useNow } from "./use-now";

/** Today's local date ("YYYY-MM-DD"), or "" while prerendering. */
export function useToday(): string {
  const now = useNow();
  return now ? toLocalIsoDate(new Date(now)) : "";
}
