// Optional routine targets. Blank always means "no target" (null), never zero.

export type RepRange = { min: number | null; max: number | null };

export type ParseRange = { ok: true; value: RepRange } | { ok: false; error: string };

const MAX_REPS = 1000;
const MAX_SETS = 50;

/** Parse "10", "8-12", "8–12" or "8 to 12". Blank -> no target. */
export function parseRepRange(input: string): ParseRange {
  const raw = input.trim();
  if (raw === "") return { ok: true, value: { min: null, max: null } };
  const match = /^(\d+)\s*(?:(?:-|–|—|to)\s*(\d+))?$/i.exec(raw);
  if (!match) return { ok: false, error: "Use a number like 10 or a range like 8–12" };
  const min = Number(match[1]);
  const max = match[2] === undefined ? min : Number(match[2]);
  if (min < 1 || max < 1) return { ok: false, error: "Reps must be at least 1" };
  if (min > MAX_REPS || max > MAX_REPS) return { ok: false, error: `Reps must be ${MAX_REPS} or fewer` };
  if (min > max) return { ok: false, error: "Put the lower number first, e.g. 8–12" };
  return { ok: true, value: { min, max } };
}

export function formatRepRange({ min, max }: RepRange): string {
  if (min == null && max == null) return "";
  if (min != null && max != null) return min === max ? String(min) : `${min}–${max}`;
  return String(min ?? max);
}

export type ParseSets = { ok: true; value: number | null } | { ok: false; error: string };

export function parseTargetSets(input: string): ParseSets {
  const raw = input.trim();
  if (raw === "") return { ok: true, value: null };
  if (!/^\d+$/.test(raw)) return { ok: false, error: "Enter a whole number" };
  const value = Number(raw);
  if (value < 1) return { ok: false, error: "Sets must be at least 1" };
  if (value > MAX_SETS) return { ok: false, error: `Sets must be ${MAX_SETS} or fewer` };
  return { ok: true, value };
}

/** Compact summary such as "3 × 8–12", "3 sets", "8–12 reps", or "" when no target. */
export function formatTarget(sets: number | null, reps: RepRange): string {
  const r = formatRepRange(reps);
  if (sets != null && r) return `${sets} × ${r}`;
  if (sets != null) return `${sets} ${sets === 1 ? "set" : "sets"}`;
  if (r) return `${r} reps`;
  return "";
}
