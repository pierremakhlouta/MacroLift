import { APP_NAME } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className ?? ""}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="size-7 shrink-0">
        <rect width="32" height="32" rx="7" fill="var(--accent)" />
        {/* Dumbbell with three plates a side, one for each macro. */}
        <g fill="var(--accent-ink)" transform="translate(16 16) scale(0.86) translate(-16 -16)">
          <rect x="10" y="14.6" width="12" height="2.8" rx="1.4" />
          <rect x="8" y="7.5" width="3.2" height="17" rx="1.5" />
          <rect x="4.6" y="10" width="3" height="12" rx="1.4" />
          <rect x="1.6" y="12.5" width="2.6" height="7" rx="1.2" />
          <rect x="20.8" y="7.5" width="3.2" height="17" rx="1.5" />
          <rect x="24.4" y="10" width="3" height="12" rx="1.4" />
          <rect x="27.8" y="12.5" width="2.6" height="7" rx="1.2" />
        </g>
      </svg>
      <span>{APP_NAME}</span>
    </span>
  );
}
