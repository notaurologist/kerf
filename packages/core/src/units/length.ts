// Lengths are decimal inches everywhere in Kerf. Rounding to 1/16 inch happens only here, for
// display, and never feeds back into a calculation (DOMAIN.md, Units).

export const SIXTEENTHS_PER_INCH = 16;

export type LengthStyle = 'inches' | 'feet-inches';

function assertLength(inches: number): void {
  if (!Number.isFinite(inches)) {
    throw new RangeError(`Length must be a finite number, got ${inches}`);
  }
  if (inches < 0) {
    throw new RangeError(`Length must not be negative, got ${inches}`);
  }
}

/** Nearest whole number of sixteenths. Exact halves round up. */
export function toSixteenths(inches: number): number {
  assertLength(inches);
  return Math.round(inches * SIXTEENTHS_PER_INCH);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** "3/16", "1/2", or "" for a whole number of inches. */
function fraction(sixteenths: number): string {
  if (sixteenths === 0) return '';
  const divisor = gcd(sixteenths, SIXTEENTHS_PER_INCH);
  return `${sixteenths / divisor}/${SIXTEENTHS_PER_INCH / divisor}`;
}

/**
 * Whole inches plus a fraction: "12", "3/16", "100-3/16". After a feet value, a fraction keeps
 * its zero ("0-1/2") so `12' 0-1/2"` can't be misread.
 */
function inchesText(totalSixteenths: number, keepZero = false): string {
  const whole = Math.floor(totalSixteenths / SIXTEENTHS_PER_INCH);
  const frac = fraction(totalSixteenths % SIXTEENTHS_PER_INCH);
  if (frac === '') return `${whole}`;
  if (whole === 0 && !keepZero) return frac;
  return `${whole}-${frac}`;
}

/**
 * Formats a length rounded to the nearest 1/16 inch.
 *
 * - `inches` (cut lists): `100-3/16"`
 * - `feet-inches` (shopping lists, layout): `8' 4-3/16"`
 *
 * Rounding happens once, on the total, so 95.99 shows as `8' 0"`, never `7' 12"`.
 */
export function formatLength(inches: number, style: LengthStyle = 'inches'): string {
  const total = toSixteenths(inches);
  if (style === 'inches') return `${inchesText(total)}"`;

  const perFoot = 12 * SIXTEENTHS_PER_INCH;
  const feet = Math.floor(total / perFoot);
  if (feet === 0) return `${inchesText(total)}"`;
  return `${feet}' ${inchesText(total % perFoot, true)}"`;
}

export interface RoundedSum {
  /** The exact sum, rounded once. This is the total to display. */
  totalSixteenths: number;
  /** What a reader gets by adding up the displayed parts. */
  sumOfRoundedPartsSixteenths: number;
  /** True when the two differ, so the display must say so. */
  differs: boolean;
}

/**
 * Compares a rounded total with the sum of its rounded parts. A total is always rounded from the
 * exact sum; when that differs from adding up the displayed parts, the display has to say so
 * rather than show numbers that silently disagree (DOMAIN.md, Units).
 */
export function compareRoundedSum(parts: readonly number[]): RoundedSum {
  const exact = parts.reduce((sum, part) => {
    assertLength(part);
    return sum + part;
  }, 0);
  const totalSixteenths = toSixteenths(exact);
  const sumOfRoundedPartsSixteenths = parts.reduce((sum, part) => sum + toSixteenths(part), 0);
  return {
    totalSixteenths,
    sumOfRoundedPartsSixteenths,
    differs: totalSixteenths !== sumOfRoundedPartsSixteenths,
  };
}
