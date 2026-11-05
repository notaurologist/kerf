// Differences between two JSON values, as paths with the value before and after. Used to tell the
// owner what regenerating a project with the current template version would change (decision
// 0008), and wherever tests compare stored output with fresh output (0014). Generic: it knows
// nothing about what the values describe.

/**
 * How far apart two numbers may be and still count as the same output: 1e-6 absolute, plus 1e-12
 * of the larger for values past a million. ECMAScript leaves Math.sin, tan, atan, log, pow and the
 * like implementation-approximated, and they differ in the last bits between macOS arm64, Linux
 * arm64, and Linux x64 (decision 0014). Those differences are around 1e-15 of the value; a
 * sixty-fourth of an inch is 0.0156. Computation and stored values stay exact (hard rule 4).
 */
export function sameNumber(a: number, b: number): boolean {
  return a === b || Math.abs(a - b) <= 1e-6 + 1e-12 * Math.max(Math.abs(a), Math.abs(b));
}

/** Whether two JSON values are the same output: equal, with numbers compared by `sameNumber`. */
export const sameOutput = (a: unknown, b: unknown): boolean => !diff(a, b, 0).truncated;

export interface Change {
  /** Such as 'cutList[1].length'. */
  path: string;
  /** Absent when the path is new. */
  before?: unknown;
  /** Absent when the path is gone. */
  after?: unknown;
}

export interface Diff {
  changes: Change[];
  /** True when there were more changes than the limit. */
  truncated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function diff(before: unknown, after: unknown, limit = 100): Diff {
  const changes: Change[] = [];
  let truncated = false;

  const add = (change: Change) => {
    if (changes.length < limit) changes.push(change);
    else truncated = true;
  };

  const walk = (a: unknown, b: unknown, path: string, hasA: boolean, hasB: boolean) => {
    if (!hasA || !hasB) {
      add({ path, ...(hasA ? { before: a } : {}), ...(hasB ? { after: b } : {}) });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        walk(a[i], b[i], `${path}[${i}]`, i < a.length, i < b.length);
      }
      return;
    }
    if (isRecord(a) && isRecord(b)) {
      const keys = [...Object.keys(a), ...Object.keys(b).filter((k) => !Object.hasOwn(a, k))];
      for (const key of keys) {
        walk(
          a[key],
          b[key],
          path ? `${path}.${key}` : key,
          Object.hasOwn(a, key),
          Object.hasOwn(b, key),
        );
      }
      return;
    }
    if (typeof a === 'number' && typeof b === 'number' ? !sameNumber(a, b) : a !== b) {
      add({ path, before: a, after: b });
    }
  };

  walk(before, after, '', true, true);
  return { changes, truncated };
}
