"use client";

import { useSyncExternalStore } from "react";

// One shared clock that ticks every 15 s while anything is subscribed. Reading time through an
// external store keeps renders pure and lets prerendering use a fixed value (0).
const TICK_MS = 15_000;
const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => current || (current = Date.now());
const getServerSnapshot = () => 0;

/** Current time in ms, refreshed every 15 seconds. 0 during prerendering. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
