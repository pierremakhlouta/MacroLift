import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { AUTH_ONLY_PATHS, DEFAULT_APP_PATH, matchesPath, PUBLIC_PATHS } from "@/lib/routes";

// Refreshes the Supabase session cookie on every navigation and performs optimistic
// redirects. This is not the security boundary: Row Level Security protects all data.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() validates the JWT; do not run code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    const [p, q] = path.split("?");
    url.pathname = p;
    url.search = q ? `?${q}` : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (pathname === "/") return redirectTo(signedIn ? DEFAULT_APP_PATH : "/login");

  if (!signedIn && !matchesPath(pathname, PUBLIC_PATHS)) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }

  if (signedIn && matchesPath(pathname, AUTH_ONLY_PATHS)) return redirectTo(DEFAULT_APP_PATH);

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
