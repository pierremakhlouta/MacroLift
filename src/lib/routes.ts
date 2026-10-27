// Route classification shared by the proxy and auth pages.

/** Pages reachable without a session. */
export const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/privacy", "/auth/callback"];

/** Signed-in users are bounced from these to the app. */
export const AUTH_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

export const DEFAULT_APP_PATH = "/dashboard";

export const matchesPath = (pathname: string, paths: string[]) =>
  paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Only allow same-site relative redirects ("/x"), never "//evil.com" or absolute URLs,
 * so `?next=` cannot be used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_APP_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://placeholder.local");
    if (url.origin !== "http://placeholder.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
