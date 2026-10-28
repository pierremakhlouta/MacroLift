"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { GoogleButton } from "@/components/google-button";
import { Alert, Button, Card, TextField } from "@/components/ui";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/routes";
import { getSupabase } from "@/lib/supabase/client";
import { emailSchema, firstError } from "@/lib/validation/profile";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const emailError = firstError(emailSchema.safeParse(email));
    const passwordError = password ? null : "Enter your password";
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoading(true);
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: emailSchema.parse(email),
      password,
    });
    if (error) {
      setLoading(false);
      setError(authErrorMessage(error));
      return;
    }
    const { data: profile } = await getSupabase()
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", data.user.id)
      .maybeSingle();
    router.replace(profile && !profile.onboarding_completed_at ? "/onboarding" : next);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="mb-4 text-xl font-bold">Sign in</h1>
      <div className="space-y-4">
        {params.get("deleted") && <Alert tone="success">Your account and its data were deleted.</Alert>}
        {params.get("reset") && <Alert tone="success">Password updated. Sign in with your new password.</Alert>}
        {params.get("confirmed") && <Alert tone="success">Your email is confirmed. Sign in to continue.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <GoogleButton next={next} onError={setError} />
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="text-accent underline underline-offset-4">
            Forgot password?
          </Link>
          <Link href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent underline underline-offset-4">
            Create an account
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
