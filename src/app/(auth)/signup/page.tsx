"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GoogleButton } from "@/components/google-button";
import { Alert, Button, Card, TextField } from "@/components/ui";
import { authErrorMessage } from "@/lib/auth-errors";
import { getSupabase } from "@/lib/supabase/client";
import { emailSchema, firstError, passwordSchema } from "@/lib/validation/profile";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = {
      email: firstError(emailSchema.safeParse(email)),
      password: firstError(passwordSchema.safeParse(password)),
      confirm: password === confirm ? null : "Passwords don't match",
    };
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setLoading(true);
    const normalizedEmail = emailSchema.parse(email);
    const { data, error } = await getSupabase().auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    if (data.session) {
      // Email confirmation disabled for this project: go straight to setup.
      router.replace("/onboarding");
      return;
    }
    setSentTo(normalizedEmail);
  }

  if (sentTo) {
    return (
      <Card>
        <MailCheck aria-hidden className="mb-3 size-8 text-accent" />
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          If <strong className="text-text">{sentTo}</strong> can be registered, we&apos;ve sent a confirmation link to it.
          Open the link in this browser to finish creating your account.
        </p>
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-4 text-xl font-bold">Create your account</h1>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <GoogleButton next="/onboarding" onError={setError} />
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with letters and numbers."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={fieldErrors.confirm}
            required
          />
          <p className="text-xs text-muted">
            By creating an account you agree to the{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-text">
              privacy notice
            </Link>
            .
          </p>
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </Card>
  );
}
