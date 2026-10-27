"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Card, TextField } from "@/components/ui";
import { authErrorMessage } from "@/lib/auth-errors";
import { getSupabase } from "@/lib/supabase/client";
import { firstError, passwordSchema } from "@/lib/validation/profile";
import { signOut } from "@/components/providers";

// Reached via the recovery link (/auth/callback?next=/reset-password), which signs the user in.
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = {
      password: firstError(passwordSchema.safeParse(password)),
      confirm: password === confirm ? null : "Passwords don't match",
    };
    setFieldErrors(errs);
    if (errs.password || errs.confirm) return;

    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(authErrorMessage(error));
      return;
    }
    // Revoke other sessions after a reset, then sign in fresh.
    await signOut({ scope: "global", redirectTo: "/login?reset=1" });
  }

  return (
    <Card>
      <h1 className="mb-4 text-xl font-bold">Choose a new password</h1>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with letters and numbers."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
