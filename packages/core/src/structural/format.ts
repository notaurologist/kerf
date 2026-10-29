import { formatLength } from '../units/length.ts';
import type { Quantity } from './types.ts';

// Numbers in a check's working, for display only (hard rule 4: never compute with the result).
// One rule for every check, so the web app does no rounding of its own. Lengths in the working
// also show their 1/16 fraction, so they can be matched against the cut list.

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Three significant figures, with no more than one decimal place at 100 and above, and thousands
 * grouped: 1,400,000; 7,208; 620.1; 17.6; 1.08; 0.0123. Exact integers stay whole.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Value must be a finite number, got ${value}`);
  // Adding 0 turns -0 into 0.
  const v = value + 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (Number.isInteger(v) || abs >= 1000) return sign + group(Math.round(abs).toString());
  if (abs >= 100) {
    const text = abs.toFixed(1).replace(/\.0$/, '');
    const [whole = '', frac] = text.split('.');
    return sign + group(whole) + (frac ? `.${frac}` : '');
  }
  if (abs === 0) return '0';
  // toPrecision can give exponent form below 1e-6; the working never holds values that small.
  return sign + Number(abs.toPrecision(3)).toString();
}

const NO_SPACE = new Set(['', '°', '%']);

/** A quantity's value with its unit: "1,400,000 psi", "92.5 in (92-1/2")", "20°", "2.00". */
export function formatQuantity(q: Pick<Quantity, 'value' | 'unit'>): string {
  const number = formatNumber(q.value);
  if (NO_SPACE.has(q.unit)) return `${number}${q.unit}`;
  const text = `${number} ${q.unit}`;
  // A length long enough to measure also shows the fraction the tape reads.
  if (q.unit === 'in' && q.value >= 0.5) return `${text} (${formatLength(q.value)})`;
  return text;
}
