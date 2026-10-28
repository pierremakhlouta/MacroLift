import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The signed-in user's id from a verified session cookie, or null. */
export async function requireUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}
