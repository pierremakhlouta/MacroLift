"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, TextField } from "@/components/ui";
import { authErrorMessage } from "@/lib/auth-errors";
import { getSupabase } from "@/lib/supabase/client";
import { emailSchema, firstError } from "@/lib/validation/profile";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err = firstError(emailSchema.safeParse(email));
    setFieldError(err);
    if (err) return;
    setLoading(true);
    const { error } = await getSupabase().auth.resetPasswordForEmail(emailSchema.parse(email), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) setError(authErrorMessage(error));
    else setSent(true);
  }

  return (
    <Card>
      <h1 className="mb-2 text-xl font-bold">Reset your password</h1>
      {sent ? (
        <Alert tone="success" title="Check your email">
          If an account exists for that address, we&apos;ve sent a reset link. Open it in this browser.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <p className="text-sm text-muted">We&apos;ll email you a link to choose a new password.</p>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-accent underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
