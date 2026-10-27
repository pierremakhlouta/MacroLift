"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { googleAuthEnabled } from "@/lib/supabase/env";
import { authErrorMessage } from "@/lib/auth-errors";

export function GoogleButton({ next, onError }: { next: string; onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  if (!googleAuthEnabled()) return null;

  async function signIn() {
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setLoading(false);
      onError(authErrorMessage(error));
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" className="w-full" loading={loading} onClick={signIn}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-4">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
