// A seeded random source for sweeps, so a sweep that finds a case finds it again. Mulberry32, as
// core's `templates/sweep.ts` uses: small, fast, and well spread; not for anything that needs
// security.

export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max], on a 1/16" step half the time, as an owner would enter it. */
  between(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(options: readonly T[]): T;
  chance(p: number): boolean;
}

export function seeded(seed: number): Random {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between(min, max) {
      const value = min + next() * (max - min);
      if (next() < 0.5) return value;
      return Math.min(max, Math.max(min, Math.round(value * 16) / 16));
    },
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (options) => options[Math.floor(next() * options.length)] as (typeof options)[number],
    chance: (p) => next() < p,
  };
}
