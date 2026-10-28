// Body-weight and measurement trends. Values are canonical (kg / cm); dates are "YYYY-MM-DD".
// No BMI is calculated anywhere.

export type DatedValue = { date: string; value: number };

export const sortByDate = <T extends { date: string }>(points: T[]) => [...points].sort((a, b) => a.date.localeCompare(b.date));

/** Points on or after `from` (inclusive). */
export const since = <T extends { date: string }>(points: T[], from: string) => points.filter((p) => p.date >= from);

export function isoDaysAgo(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y, m - 1, d - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type Change = { delta: number; from: DatedValue; to: DatedValue };

/** Change between the first and last point. Null with fewer than two points. */
export function changeOver(points: DatedValue[]): Change | null {
  if (points.length < 2) return null;
  const sorted = sortByDate(points);
  const from = sorted[0];
  const to = sorted[sorted.length - 1];
  return { delta: to.value - from.value, from, to };
}

/** "Nice" axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.02);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** Days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
