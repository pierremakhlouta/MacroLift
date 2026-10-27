"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

export type TypedSupabaseClient = SupabaseClient<Database>;

let browserClient: TypedSupabaseClient | undefined;

/** Singleton browser client. All data access is enforced by Row Level Security. */
export function getSupabase(): TypedSupabaseClient {
  browserClient ??= createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
  return browserClient;
}
