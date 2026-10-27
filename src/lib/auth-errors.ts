// Friendly, non-enumerating messages for Supabase Auth errors.

export function authErrorMessage(error: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (code === "weak_password" || msg.includes("password should")) {
    return "That password is too weak. Use at least 8 characters with letters and numbers.";
  }
  if (code === "same_password") return "Choose a password different from your current one.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (code === "email_address_not_authorized" || msg.includes("not authorized")) {
    return "Email sending isn't configured for this address yet. Ask the app owner to set up email delivery.";
  }
  if (code === "reauthentication_needed") return "Please sign in again before changing your password.";
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return error.message || "Something went wrong. Please try again.";
}
