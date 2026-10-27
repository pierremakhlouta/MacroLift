"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { clearAllLocalData, noteActiveUser } from "@/lib/local-store";
import { matchesPath, PUBLIC_PATHS } from "@/lib/routes";

type AuthState = { user: User | null; ready: boolean };

// Set while an intentional sign-out (sign out, password reset, account deletion) navigates away,
// so the listeners below don't race it with their own redirect.
let intentionalSignOut = false;
const AuthContext = createContext<AuthState>({ user: null, ready: false });

export const useAuth = () => useContext(AuthContext);

export function useRequiredUser(): User | null {
  return useAuth().user;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();
    let lastUserId: string | null | undefined;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      if (lastUserId !== undefined && lastUserId !== (user?.id ?? null)) {
        // Account switch or sign-out: drop cached data from the previous account.
        queryClient.clear();
      }
      lastUserId = user?.id ?? null;
      noteActiveUser(user?.id ?? null);
      setState({ user, ready: true });

      if (event === "SIGNED_OUT") {
        clearAllLocalData();
        queryClient.clear();
        if (!intentionalSignOut && !matchesPath(window.location.pathname, PUBLIC_PATHS)) {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <AuthContext.Provider value={state}>
      {/* Reads the URL, so it sits in Suspense to keep dynamic routes prerenderable. */}
      <Suspense>
        <RedirectWhenSignedOut state={state} />
      </Suspense>
      {children}
    </AuthContext.Provider>
  );
}

/** Expired/revoked session while on a protected page (e.g. refresh token rejected). */
function RedirectWhenSignedOut({ state }: { state: AuthState }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (state.ready && !state.user && !intentionalSignOut && !matchesPath(pathname, PUBLIC_PATHS)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state, pathname, router]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Sign out, wipe local recovery data, and do a full page load to `redirectTo` so no in-memory
 * state from this account survives. `scope: "global"` also revokes the account's other sessions.
 */
export async function signOut({ redirectTo = "/login", scope = "local" }: { redirectTo?: string; scope?: "local" | "global" } = {}) {
  intentionalSignOut = true;
  clearAllLocalData();
  await getSupabase().auth.signOut({ scope });
  window.location.replace(redirectTo);
}
