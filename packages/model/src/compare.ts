// Compares two JSON values for the parity test (docs/explorations/joint-model.md, Parity test).
// Numbers agree within TOLERANCE, since computing a value another way changes its last bits;
// everything else, including every string a plan shows, must match exactly.

/** In inches for lengths and degrees for angles: far below 1/16", so nothing shown can differ. */
export const TOLERANCE = 1e-9;

export interface Mismatch {
  /** Such as 'outputs.parts[0].length'. */
  path: string;
  /** Absent when the path is only in the candidate. */
  current?: unknown;
  /** Absent when the path is only in the current output. */
  candidate?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function compare(current: unknown, candidate: unknown, path = ''): Mismatch[] {
  const found: Mismatch[] = [];

  const walk = (a: unknown, b: unknown, at: string, hasA: boolean, hasB: boolean) => {
    if (!hasA || !hasB) {
      found.push({ path: at, ...(hasA ? { current: a } : {}), ...(hasB ? { candidate: b } : {}) });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        walk(a[i], b[i], `${at}[${i}]`, i < a.length, i < b.length);
      }
      return;
    }
    if (isRecord(a) && isRecord(b)) {
      const keys = [...Object.keys(a), ...Object.keys(b).filter((k) => !Object.hasOwn(a, k))];
      for (const key of keys) {
        walk(
          a[key],
          b[key],
          at ? `${at}.${key}` : key,
          Object.hasOwn(a, key),
          Object.hasOwn(b, key),
        );
      }
      return;
    }
    if (typeof a === 'number' && typeof b === 'number') {
      if (!(Math.abs(a - b) <= TOLERANCE) && !Object.is(a, b)) {
        found.push({ path: at, current: a, candidate: b });
      }
      return;
    }
    if (a !== b) found.push({ path: at, current: a, candidate: b });
  };

  walk(current, candidate, path, true, true);
  return found;
}
