// Calendar-date helpers. Diary days and weigh-ins are local calendar dates ("YYYY-MM-DD"),
// not instants, so they are built from local date parts rather than toISOString().

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const todayIsoDate = () => toLocalIsoDate(new Date());

/** Strictly validate "YYYY-MM-DD", including real calendar days (no Feb 30). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Whole years between a birth date and `on` (both "YYYY-MM-DD"). Null if invalid or in the future. */
export function ageInYears(birthDate: string, on: string = todayIsoDate()): number | null {
  if (!isValidIsoDate(birthDate) || !isValidIsoDate(on)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [oy, om, od] = on.split("-").map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age -= 1;
  return age < 0 ? null : age;
}
