// Public (browser-safe) Supabase settings. Secret / service-role keys must never be read here.

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local.");
  return url;
}

export function supabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. Copy .env.example to .env.local.");
  }
  if (key.startsWith("sb_secret_")) {
    throw new Error("A secret Supabase key was configured as the public key. Use the publishable key.");
  }
  return key;
}

export const googleAuthEnabled = () => process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
