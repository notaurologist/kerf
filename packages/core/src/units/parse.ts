// Reading lengths and angles typed the way a plan or a tape writes them (#67, the entry standard
// in docs/design/entry.html). Values are kept exactly as typed; nothing here rounds (DOMAIN.md,
// Units). Messages follow the content guide (docs/design/content.md): say what to enter.

import { formatLength, SIXTEENTHS_PER_INCH } from './length.ts';

export type Parsed =
  | { ok: true; value: number }
  | { ok: false; problem: ParseProblem; message: string };

export type ParseProblem =
  | 'empty'
  | 'metric'
  | 'negative'
  | 'unmarked-feet'
  | 'denominator'
  | 'improper'
  | 'decimal-with-fraction'
  | 'minutes'
  | 'unread';

const LENGTH_MESSAGES: Record<ParseProblem, string> = {
  empty: 'Enter a length.',
  metric: 'Kerf works in inches. Enter the length in inches, or feet and inches.',
  negative: 'A length cannot be negative.',
  'unmarked-feet': `Mark feet with ': such as 11' 6". A number on its own is inches.`,
  denominator:
    'Use a fraction a tape reads: halves, quarters, eighths, sixteenths, 32nds or 64ths.',
  improper: 'The fraction should be less than 1, such as 3/8.',
  'decimal-with-fraction': 'Use a decimal or a fraction, not both.',
  minutes: 'Enter decimal degrees, such as 20.5.',
  unread: `Kerf cannot read this as a length. Enter inches, such as 138-3/8, or feet and inches, such as 11' 6-3/8".`,
};

const fail = (problem: ParseProblem, messages = LENGTH_MESSAGES): Parsed => ({
  ok: false,
  problem,
  message: messages[problem],
});

/** Denominators a tape measure reads. A third or a tenth is more likely a slip. */
const TAPE_DENOMINATORS = new Set([2, 4, 8, 16, 32, 64]);

/**
 * The text with the marks people actually type turned into ' and ": curly quotes from a phone's
 * smart punctuation, primes, two apostrophes for inches, and the words ft and in.
 */
function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[‘’′´`]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/''/g, '"')
    .replace(/\s*(?:feet|foot|ft)\.?(?![a-z])/g, "'")
    .replace(/\s*(?:inches|inch|in)\.?(?![a-z])/g, '"')
    .replace(/\s+/g, ' ');
}

const NUMBER = String.raw`(?:\d+(?:\.\d*)?|\.\d+)`;
// Inches: a number with an optional fraction joined by a hyphen or space, or a fraction alone.
const INCHES = String.raw`(?:(${NUMBER})(?:(?:\s+|\s*-\s*)(\d+)\/(\d+))?|(\d+)\/(\d+))`;
// Optional feet marked with ', an optional hyphen after them (the drafting style), then inches.
const LENGTH = new RegExp(String.raw`^(?:(${NUMBER})\s*'\s*(?:-\s*)?)?(?:${INCHES})?\s*(")?$`);

/** A fraction's value, or the problem with it. */
function fraction(numerator: string, denominator: string): number | ParseProblem {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!TAPE_DENOMINATORS.has(d)) return 'denominator';
  if (n >= d) return 'improper';
  return n / d;
}

/**
 * Reads a length in inches from text such as `138`, `138.4`, `138-3/8`, `138 3/8`, `3/8`,
 * `11'`, `11' 6-3/8"`, `11'6-3/8`, `11'-6"`, or `11 ft 6 in`. A number on its own is inches.
 * Two numbers with no marks (`11 6`) are refused rather than guessed.
 */
export function parseLength(text: string): Parsed {
  const t = normalize(text);
  if (t === '') return fail('empty');
  if (/\d\s*(?:mm|cm|m|meters?|metres?)$/.test(t)) return fail('metric');
  if (t.startsWith('-')) return fail('negative');
  if (/^\d+(?:\.\d+)? \d+(?:\.\d+)?"?$/.test(t)) return fail('unmarked-feet');
  const m = LENGTH.exec(t);
  if (!m) {
    return fail(/^\d+\.\d+[ -]\d+\/\d+/.test(t) ? 'decimal-with-fraction' : 'unread');
  }
  const [, feet, whole, n1, d1, n2, d2] = m;
  if (feet === undefined && whole === undefined && n2 === undefined) return fail('unread');
  let inches = (feet ? Number(feet) * 12 : 0) + (whole ? Number(whole) : 0);
  const numerator = n1 ?? n2;
  const denominator = d1 ?? d2;
  if (numerator !== undefined && denominator !== undefined) {
    if (whole?.includes('.')) return fail('decimal-with-fraction');
    const f = fraction(numerator, denominator);
    if (typeof f === 'string') return fail(f);
    inches += f;
  }
  return { ok: true, value: inches };
}

const ANGLE_MESSAGES: Record<ParseProblem, string> = {
  ...LENGTH_MESSAGES,
  empty: 'Enter an angle.',
  unread: 'Kerf cannot read this as an angle. Enter degrees, such as 20 or 20.5.',
};

const ANGLE = new RegExp(String.raw`^(-?${NUMBER})\s*(?:°|º|deg|degrees?)?$`);

/** Reads decimal degrees: `20`, `20.5`, `20°`, `20 deg`. Degrees and minutes are refused. */
export function parseAngle(text: string): Parsed {
  const t = text.trim().toLowerCase();
  if (t === '') return fail('empty', ANGLE_MESSAGES);
  if (/['’′"]/.test(t)) return fail('minutes', ANGLE_MESSAGES);
  const m = ANGLE.exec(t);
  if (!m?.[1]) return fail('unread', ANGLE_MESSAGES);
  return { ok: true, value: Number(m[1]) };
}

const NUMBER_MESSAGES: Record<ParseProblem, string> = {
  ...LENGTH_MESSAGES,
  empty: 'Enter a number.',
  unread: 'Enter a number, such as 1, 0.25, or 1/4.',
};

const SIGNED = new RegExp(String.raw`^(-)?\s*(?:(${NUMBER})|(?:(\d+)[\s-]+)?(\d+)\/(\d+))$`);

/**
 * Reads a number that may be written as a tape fraction, such as a slope of `1/4` or `1 1/2`
 * inches per foot. May be negative.
 */
export function parseFractionalNumber(text: string): Parsed {
  const t = text.trim();
  if (t === '') return fail('empty', NUMBER_MESSAGES);
  const m = SIGNED.exec(t);
  if (!m) return fail('unread', NUMBER_MESSAGES);
  const [, minus, decimal, whole, numerator, denominator] = m;
  let value: number;
  if (decimal !== undefined) value = Number(decimal);
  else {
    const f = fraction(numerator ?? '', denominator ?? '');
    if (typeof f === 'string') return fail(f, NUMBER_MESSAGES);
    value = Number(whole ?? 0) + f;
  }
  return { ok: true, value: minus ? -value : value };
}

/** True when a length is a whole number of sixteenths, so the display shows it exactly. */
export function isExactInSixteenths(inches: number): boolean {
  return Number.isInteger(inches * SIXTEENTHS_PER_INCH);
}

/**
 * What a length reads as, for the line under the field: feet and inches, then inches, and a
 * note when the display is rounded. `138.4` reads as `11' 6-3/8" · 138-3/8"` shown to the
 * nearest 1/16, with 138.4 kept.
 */
export function describeLength(inches: number): string {
  const feetInches = formatLength(inches, 'feet-inches');
  const plain = formatLength(inches);
  const shown = feetInches === plain ? plain : `${feetInches} · ${plain}`;
  if (isExactInSixteenths(inches)) return shown;
  return `${shown} to the nearest 1/16; Kerf keeps ${inches} exactly`;
}

/**
 * A stored length written back into a field so saving it again changes nothing: core's inches
 * format without the mark when it is a whole number of sixteenths (`138-3/8`), and the decimal
 * otherwise (`138.4`), never rounded.
 */
export function lengthForEntry(inches: number): string {
  if (!isExactInSixteenths(inches) || inches < 0) return String(inches);
  // A whole number of sixteenths, so formatLength shows the value itself, unrounded.
  return formatLength(inches).replace(/"$/, '');
}
