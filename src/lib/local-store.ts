"use client";

// Account-scoped browser storage for basic recovery (e.g. an in-progress workout).
// Every key is prefixed with the user id, and everything is wiped on sign-out or account switch.

const PREFIX = "macrolift:";
const LAST_USER_KEY = `${PREFIX}last-user`;

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const userKey = (userId: string, name: string) => `${PREFIX}u:${userId}:${name}`;

export function readJson<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    storage()?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** Remove every MacroLift key (all accounts) from this browser. */
export function clearAllLocalData() {
  const s = storage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Call whenever the signed-in user is known. If a different account was last active in this
 * browser, clear the previous account's local recovery data first.
 */
export function noteActiveUser(userId: string | null) {
  const s = storage();
  if (!s) return;
  try {
    const last = s.getItem(LAST_USER_KEY);
    if (last && last !== userId) clearAllLocalData();
    if (userId) s.setItem(LAST_USER_KEY, userId);
  } catch {
    /* storage unavailable */
  }
}
