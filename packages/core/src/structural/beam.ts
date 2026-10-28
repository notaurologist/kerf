// A simply supported span with point loads between its supports and an optional uniform load
// over the whole span (DOMAIN.md, Structural checks, Beam model). Results come from superposing
// the single-load cases in AWC Design Aid No. 6: Figure 8 ("Simple Beam - Concentrated Load at
// Any Point") and Figure 1 ("Simple Beam - Uniformly Distributed Load"). Positions are measured
// from the left support; loads act downward and are positive.

export interface SpanLoad {
  /** Distance from the left support, 0 < a < L. */
  a: number;
  /** Load, pounds, downward. */
  P: number;
}

export interface SpanLoads {
  points: readonly SpanLoad[];
  /** Uniform load over the whole span, pounds per inch, downward. 0 for none. */
  w: number;
}

export interface Reactions {
  left: number;
  right: number;
}

/** R1 = Σ P·b / L + w·L / 2, R2 = Σ P·a / L + w·L / 2, with b = L − a. */
export function reactions(L: number, loads: SpanLoads): Reactions {
  let left = (loads.w * L) / 2;
  let right = left;
  for (const { a, P } of loads.points) {
    left += (P * (L - a)) / L;
    right += (P * a) / L;
  }
  return { left, right };
}

/** Bending moment at x: R1·x − w·x²/2, minus each point load left of x times its distance from x. */
export function momentAt(L: number, loads: SpanLoads, x: number): number {
  let M = reactions(L, loads).left * x - (loads.w * x * x) / 2;
  for (const { a, P } of loads.points) if (a < x) M -= P * (x - a);
  return M;
}

/**
 * Largest moment and where it occurs. The moment is greatest where the shear changes sign: under a
 * point load, or, with a uniform load, where the shear crosses zero between two point loads.
 */
export function maxMoment(L: number, loads: SpanLoads): { M: number; x: number } {
  const R1 = reactions(L, loads).left;
  const sorted = [...loads.points].sort((p, q) => p.a - q.a);
  const candidates = sorted.map((l) => l.a);
  if (loads.w > 0) {
    // Between point loads, V(x) = R1 − (loads to the left) − w·x is zero at one x.
    let left = 0;
    const breaks = [0, ...candidates, L];
    for (let i = 1; i < breaks.length; i++) {
      const x = (R1 - left) / loads.w;
      if (x > (breaks[i - 1] as number) && x < (breaks[i] as number)) candidates.push(x);
      left += sorted[i - 1]?.P ?? 0;
    }
  }
  let best = { M: 0, x: 0 };
  for (const x of candidates) {
    const M = momentAt(L, loads, x);
    if (M > best.M) best = { M, x };
  }
  return best;
}

/** Largest shear: the larger support reaction, since every load acts downward between supports. */
export function maxShear(L: number, loads: SpanLoads): number {
  const { left, right } = reactions(L, loads);
  return Math.max(left, right);
}

type Quartic = [number, number, number, number, number];

/**
 * Deflection times EI at x, as c4·x⁴ + c3·x³ + c2·x² + c1·x + c0 on the stretch of span that
 * contains x. For one point load P at a (b = L − a), DA6 Figure 8 gives
 *   x ≤ a: P·b·x·(L² − b² − x²) / (6·EI·L)
 *   x ≥ a: P·a·(L − x)·(2·L·x − x² − a²) / (6·EI·L),
 * with (L − x)·(2Lx − x² − a²) = x³ − 3L·x² + (2L² + a²)·x − a²·L. For the uniform load, DA6
 * Figure 1 gives w·x·(L³ − 2·L·x² + x³) / (24·EI).
 */
function polynomialOn(L: number, loads: SpanLoads, x: number): Quartic {
  const c: Quartic = [0, 0, 0, 0, 0];
  for (const { a, P } of loads.points) {
    const b = L - a;
    if (x <= a) {
      const k = (P * b) / (6 * L);
      c[1] += k * (L * L - b * b);
      c[3] -= k;
    } else {
      const k = (P * a) / (6 * L);
      c[3] += k;
      c[2] -= 3 * L * k;
      c[1] += (2 * L * L + a * a) * k;
      c[0] -= a * a * L * k;
    }
  }
  const k = loads.w / 24;
  c[1] += k * L * L * L;
  c[3] -= 2 * k * L;
  c[4] += k;
  return c;
}

/** Deflection at x times EI (lb·in³), downward positive. Divide by E·I for inches. */
export function deflectionTimesEIAt(L: number, loads: SpanLoads, x: number): number {
  const c = polynomialOn(L, loads, x);
  return (((c[4] * x + c[3]) * x + c[2]) * x + c[1]) * x + c[0];
}

function slopeTimesEIAt(L: number, loads: SpanLoads, x: number): number {
  const c = polynomialOn(L, loads, x);
  return ((4 * c[4] * x + 3 * c[3]) * x + 2 * c[2]) * x + c[1];
}

/**
 * Largest deflection times EI, and where. With every load downward the moment is never negative,
 * so the slope of the deflection curve only decreases along the span; the maximum is where the
 * slope is zero, found by bisection to the limit of floating point rather than by sampling.
 */
export function maxDeflectionTimesEI(L: number, loads: SpanLoads): { deltaEI: number; x: number } {
  let lo = 0;
  let hi = L;
  for (let i = 0; i < 200 && hi - lo > 1e-12 * L; i++) {
    const mid = (lo + hi) / 2;
    if (slopeTimesEIAt(L, loads, mid) > 0) lo = mid;
    else hi = mid;
  }
  const x = (lo + hi) / 2;
  return { deltaEI: deflectionTimesEIAt(L, loads, x), x };
}
