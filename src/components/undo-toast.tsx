"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export type UndoAction = { id: number; message: string; undo: () => void };

/** Short-lived "Removed · Undo" bar above the phone tab bar. */
export function UndoToast({ action, onDone, timeoutMs = 7000 }: { action: UndoAction | null; onDone: () => void; timeoutMs?: number }) {
  useEffect(() => {
    if (!action) return;
    const t = setTimeout(onDone, timeoutMs);
    return () => clearTimeout(t);
  }, [action, onDone, timeoutMs]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
      {action && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border-strong bg-surface-2 px-4 py-2 shadow-lg">
          <p className="flex-1 text-sm">{action.message}</p>
          <Button
            variant="ghost"
            className="text-accent"
            onClick={() => {
              action.undo();
              onDone();
            }}
          >
            Undo
          </Button>
        </div>
      )}
    </div>
  );
}
