// The length of through-bolt to buy (#449). A bolt is long enough when it passes through the grip,
// its washers, and its nut, and short enough when it stands no farther past the nut than the
// template allows. Kerf takes each fitting at its largest size in the standard, so the shortest
// length is never short for a fitting at the thick end of its tolerance.

/**
 * Largest thickness of a USS flat washer (ASME B18.21.1-2009) and height of a nylon-insert
 * locknut (ASME B18.16.6-2008, Table 1, height D), by bolt diameter, inches. Sources in
 * `design-values/sources.ts`.
 */
const FITTINGS: ReadonlyMap<number, { washer: number; lockingNut: number }> = new Map([
  [0.375, { washer: 0.104, lockingNut: 0.468 }],
  [0.5, { washer: 0.132, lockingNut: 0.609 }],
  [0.625, { washer: 0.16, lockingNut: 0.765 }],
  [0.75, { washer: 0.177, lockingNut: 0.89 }],
]);

export interface BoltLength {
  /** Grip, washers, and nut: the shortest bolt that goes through all of them. */
  min: number;
  /** As far past the nut as the template allows: the longest bolt that fits. */
  max: number;
  /**
   * The length to buy: the shortest half inch in the range, or quarter inch if no half inch is.
   * Absent when neither is.
   */
  length?: number;
}

/**
 * The lengths that fit a through-bolt with `washers` USS flat washers and a nylon-insert locknut,
 * standing at most `pastNut` beyond the nut, or undefined for a diameter or nut whose sizes Kerf
 * does not have.
 */
export function boltLength(
  diameter: number,
  grip: number,
  washers: number,
  nut: 'locking' | 'standard',
  pastNut: number,
): BoltLength | undefined {
  const fittings = FITTINGS.get(diameter);
  if (!fittings || nut !== 'locking') return undefined;
  const min = grip + washers * fittings.washer + fittings.lockingNut;
  const max = min + pastNut;
  const eps = 1e-9;
  const length = [0.5, 0.25]
    .map((step) => Math.ceil(min / step - eps) * step)
    .find((l) => l <= max + eps);
  return { min, max, ...(length === undefined ? {} : { length }) };
}
