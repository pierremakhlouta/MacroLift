import Link from "next/link";
import { Logo } from "@/components/logo";
import { APP_TAGLINE } from "@/lib/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8 sm:py-16">
      <div className="mb-8">
        <Logo className="text-xl" />
        <p className="mt-2 text-sm text-muted">{APP_TAGLINE}</p>
      </div>
      <div className="flex-1">{children}</div>
      <footer className="mt-10 text-center text-xs text-muted">
        <Link href="/privacy" className="underline underline-offset-4 hover:text-text">
          Privacy notice
        </Link>
      </footer>
    </main>
  );
}
