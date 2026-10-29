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

// Cardio distance is stored in metres and shown in km or miles.
export const M_PER_MILE = 1609.344;

export const distanceUnitLabel = (system: UnitSystem) => (system === "imperial" ? "mi" : "km");

/** Convert a displayed distance (km or mi) to canonical metres. */
export const distanceToM = (value: number, system: UnitSystem) => value * (system === "imperial" ? M_PER_MILE : 1000);
export const distanceFromM = (m: number, system: UnitSystem) => m / (system === "imperial" ? M_PER_MILE : 1000);

export function distanceInputValue(m: number | null | undefined, system: UnitSystem, decimals = 2): string {
  if (m == null || !Number.isFinite(m)) return "";
  return String(roundTo(distanceFromM(m, system), decimals));
}

export function formatDistance(m: number | null | undefined, system: UnitSystem, decimals = 2): string {
  if (m == null || !Number.isFinite(m)) return "—";
  return `${roundTo(distanceFromM(m, system), decimals).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  })} ${distanceUnitLabel(system)}`;
}

/**
 * Parse a typed duration into seconds. Blank -> null. Accepts minutes ("30", "12.5"),
 * "mm:ss" ("25:30") and "h:mm:ss" ("1:05:00").
 */
export function parseDuration(input: string | null | undefined): ParseResult {
  const raw = (input ?? "").trim();
  if (raw === "") return { ok: true, value: null };
  if (raw.includes(":")) {
    const parts = raw.split(":");
    if (parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) return { ok: false, error: "Use minutes or mm:ss" };
    const nums = parts.map(Number);
    // Every part after the first is minutes or seconds, so it must be under 60.
    if (nums.slice(1).some((n) => n >= 60)) return { ok: false, error: "Use minutes or mm:ss" };
    const [h, m, s] = nums.length === 3 ? nums : [0, ...nums];
    return { ok: true, value: h * 3600 + m * 60 + s };
  }
  const r = parseDecimal(raw);
  if (!r.ok) return { ok: false, error: "Use minutes or mm:ss" };
  return { ok: true, value: Math.round(r.value! * 60) };
}

/** Seconds as an editable value: "25:30", "1:05:00", or "" when unknown. */
export function durationInputValue(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Seconds for display: "25 min", "25 min 30 s", "1 h 05 min", or "—". */
export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m && s) return `${m} min ${s} s`;
  return m ? `${m} min` : `${s} s`;
}
