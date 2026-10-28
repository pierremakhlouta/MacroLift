"use client";

import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { cx } from "@/components/ui";
import type { SyncStatus } from "@/lib/workouts/active-store";

const VIEW: Record<SyncStatus, { label: string; detail?: string; className: string; Icon: typeof CheckCircle2; spin?: boolean }> = {
  idle: { label: "Not started", className: "text-muted border-border", Icon: CheckCircle2 },
  saving: { label: "Saving…", className: "text-info border-info/40", Icon: Loader2, spin: true },
  saved: { label: "Saved", className: "text-ok border-ok/40", Icon: CheckCircle2 },
  offline: {
    label: "Not synced",
    detail: "You're offline. Changes are kept on this device and will upload when you reconnect.",
    className: "text-warn border-warn/50",
    Icon: CloudOff,
  },
  error: { label: "Not synced", detail: "Retrying…", className: "text-warn border-warn/50", Icon: RefreshCw },
  conflict: { label: "Needs your choice", className: "text-danger border-danger/50", Icon: AlertTriangle },
};

/** Save state with icon + text (never colour alone). Announced politely to screen readers. */
export function SyncStatusBadge({ status, compact }: { status: SyncStatus; compact?: boolean }) {
  const v = VIEW[status];
  return (
    <span role="status" aria-live="polite" className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", v.className)}>
      <v.Icon aria-hidden className={cx("size-3.5", v.spin && "animate-spin")} />
      {v.label}
      {!compact && v.detail && <span className="sr-only"> {v.detail}</span>}
    </span>
  );
}

export function syncDetail(status: SyncStatus): string | undefined {
  return VIEW[status].detail;
}
