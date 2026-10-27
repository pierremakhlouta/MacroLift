// Unit conversion, parsing and display. Values are stored canonically in kg / cm and only
// rounded for display, never before storage.

export type UnitSystem = "metric" | "imperial";

export const LB_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;
export const INCHES_PER_FOOT = 12;

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;
export const cmToIn = (cm: number): number => cm / CM_PER_INCH;
export const inToCm = (inches: number): number => inches * CM_PER_INCH;

/** Round half away from zero to `decimals` places without binary-float surprises (1.005 -> 1.01). */
export function roundTo(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const rounded = Math.sign(value) * Math.round(Math.abs(value) * factor * (1 + Number.EPSILON)) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export type ParseResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/**
 * Parse a user-typed decimal. Blank input is `null` (unknown), never zero.
 * Accepts "." or "," as the decimal separator. Rejects non-finite and malformed input.
 */
export function parseDecimal(input: string | null | undefined): ParseResult {
  const raw = (input ?? "").trim();
  if (raw === "") return { ok: true, value: null };
  const normalized = raw.replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return { ok: false, error: "Enter a number" };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a finite number" };
  return { ok: true, value };
}

/** Parse a whole number (e.g. reps). Blank -> null. */
export function parseInteger(input: string | null | undefined): ParseResult {
  const raw = (input ?? "").trim();
  if (raw === "") return { ok: true, value: null };
  if (!/^[+-]?\d+$/.test(raw)) return { ok: false, error: "Enter a whole number" };
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return { ok: false, error: "Number is too large" };
  return { ok: true, value };
}

export const weightUnitLabel = (system: UnitSystem) => (system === "imperial" ? "lb" : "kg");
export const lengthUnitLabel = (system: UnitSystem) => (system === "imperial" ? "in" : "cm");

/** Convert a displayed weight (in the user's unit) to canonical kg. */
export const weightToKg = (value: number, system: UnitSystem) =>
  system === "imperial" ? lbToKg(value) : value;
/** Convert canonical kg to the user's unit (unrounded). */
export const weightFromKg = (kg: number, system: UnitSystem) =>
  system === "imperial" ? kgToLb(kg) : kg;

export const lengthToCm = (value: number, system: UnitSystem) =>
  system === "imperial" ? inToCm(value) : value;
export const lengthFromCm = (cm: number, system: UnitSystem) =>
  system === "imperial" ? cmToIn(cm) : cm;

/** Value for an editable input: converted and lightly rounded, or "" when unknown. */
export function weightInputValue(kg: number | null | undefined, system: UnitSystem, decimals = 2): string {
  if (kg == null || !Number.isFinite(kg)) return "";
  return String(roundTo(weightFromKg(kg, system), decimals));
}

export function lengthInputValue(cm: number | null | undefined, system: UnitSystem, decimals = 1): string {
  if (cm == null || !Number.isFinite(cm)) return "";
  return String(roundTo(lengthFromCm(cm, system), decimals));
}

export function formatWeight(kg: number | null | undefined, system: UnitSystem, decimals = 1): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  return `${roundTo(weightFromKg(kg, system), decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  })} ${weightUnitLabel(system)}`;
}

export function formatLength(cm: number | null | undefined, system: UnitSystem, decimals = 1): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  return `${roundTo(lengthFromCm(cm, system), decimals)} ${lengthUnitLabel(system)}`;
}

/** Split total inches into feet + inches for height display/input. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToIn(cm);
  let feet = Math.floor(totalInches / INCHES_PER_FOOT);
  let inches = roundTo(totalInches - feet * INCHES_PER_FOOT, 1);
  if (inches >= INCHES_PER_FOOT) {
    feet += 1;
    inches -= INCHES_PER_FOOT;
  }
  return { feet, inches };
}

export const feetInchesToCm = (feet: number, inches: number) =>
  inToCm(feet * INCHES_PER_FOOT + inches);

export function formatHeight(cm: number | null | undefined, system: UnitSystem): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  if (system === "metric") return `${roundTo(cm, 1)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet} ft ${inches} in`;
}
