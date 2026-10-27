import { APP_NAME } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className ?? ""}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="size-7 shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M7 21V11l4.5 6L16 11v10M20 11v10h5" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{APP_NAME}</span>
    </span>
  );
}
