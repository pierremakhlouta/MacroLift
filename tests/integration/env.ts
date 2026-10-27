// Integration tests run against the LOCAL Supabase stack only (`npx supabase start`).
// The local secret key is used solely to create/confirm test users; app code never sees it.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

function readLocalStatus(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return Object.fromEntries(
    out
      .split("\n")
      .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim()))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => [m[1], m[2]]),
  );
}

const status = readLocalStatus();
export const API_URL = status.API_URL;
export const PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
const SECRET_KEY = status.SECRET_KEY;

if (!API_URL?.startsWith("http://127.0.0.1") && !API_URL?.startsWith("http://localhost")) {
  throw new Error(`Refusing to run integration tests against non-local Supabase: ${API_URL}`);
}

export type Db = SupabaseClient<Database>;

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };

export const anonClient = (): Db => createClient<Database>(API_URL, PUBLISHABLE_KEY, noPersist);
const adminClient = () => createClient<Database>(API_URL, SECRET_KEY, noPersist);

export type TestUser = { id: string; email: string; password: string; db: Db };

/** Create a confirmed user and return a client signed in as them (publishable key + JWT). */
export async function createSignedInUser(label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID()}@test.local`;
  const password = "testpass123";
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const db = anonClient();
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, password, db };
}

export async function deleteUser(id: string) {
  await adminClient().auth.admin.deleteUser(id);
}
