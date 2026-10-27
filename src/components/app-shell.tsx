"use client";

import { Dumbbell, Home, LineChart, UserRound, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: Home },
  { href: "/workouts", label: "Workouts", Icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", Icon: UtensilsCrossed },
  { href: "/progress", label: "Progress", Icon: LineChart },
  { href: "/profile", label: "Profile", Icon: UserRound },
] as const;

type NavVariant = "sidebar" | "tabbar";

/** Nav links; `pathname` is null while it streams in (no item marked current yet). */
function NavItems({ variant, pathname }: { variant: NavVariant; pathname: string | null }) {
  const isActive = (href: string) => pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
  if (variant === "sidebar") {
    return (
      <ul className="space-y-1">
        {NAV.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                isActive(href) ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-5">
      {NAV.map(({ href, label, Icon }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cx(
              "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              isActive(href) ? "text-accent" : "text-muted hover:text-text",
            )}
          >
            <Icon aria-hidden className="size-5" />
            <span>{label}</span>
            {/* Non-colour indicator of the current tab */}
            <span aria-hidden className={cx("h-0.5 w-6 rounded-full", isActive(href) ? "bg-accent" : "bg-transparent")} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActiveNavItems({ variant }: { variant: NavVariant }) {
  return <NavItems variant={variant} pathname={usePathname()} />;
}

/** usePathname() must sit inside Suspense so dynamic routes can still prerender their shell. */
function Nav({ variant }: { variant: NavVariant }) {
  return (
    <Suspense fallback={<NavItems variant={variant} pathname={null} />}>
      <ActiveNavItems variant={variant} />
    </Suspense>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-accent px-3 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Sidebar: tablet landscape and desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link href="/dashboard" className="mb-6 px-3 text-lg">
          <Logo />
        </Link>
        <nav aria-label="Main">
          <Nav variant="sidebar" />
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phone header */}
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-bg/95 px-4 backdrop-blur md:hidden">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 outline-none md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <Nav variant="tabbar" />
      </nav>
    </div>
  );
}
