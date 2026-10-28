import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/routes";

// Work and school mail scanners often open links before the user does. That uses up the one-time
// link but still confirms the email, so point people to signing in rather than signing up again.
const USED_LINK_MESSAGE =
  "That link has already been used or has expired. If it was a confirmation email, your email is probably confirmed: try signing in. Otherwise, request a new link.";

// Completes Google OAuth, email confirmation, and password-recovery links (PKCE code flow).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    const message = /expired|invalid/i.test(providerError) ? USED_LINK_MESSAGE : providerError;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing sign-in code.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    const message = `${USED_LINK_MESSAGE} Links also need to be opened in the browser that requested them.`;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  // First sign-in (including Google): send new users through setup unless they are resetting a password.
  if (next !== "/reset-password") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && !profile.onboarding_completed_at) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
