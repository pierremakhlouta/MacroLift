import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text">
      <ChevronLeft aria-hidden className="size-4" /> {label}
    </Link>
  );
}
