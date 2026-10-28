// A simply supported span with point loads between its supports (DOMAIN.md, Structural checks,
// Beam model). Results come from superposing the single-load case, AWC Design Aid No. 6,
// Figure 8 ("Simple Beam - Concentrated Load at Any Point"). Positions are measured from the left
// support; loads act downward and are positive.

export interface SpanLoad {
  /** Distance from the left support, 0 < a < L. */
  a: number;
  /** Load, pounds, downward. */
  P: number;
}

export interface Reactions {
  left: number;
  right: number;
}

/** R1 = Σ P·b / L, R2 = Σ P·a / L, with b = L − a. */
export function reactions(L: number, loads: readonly SpanLoad[]): Reactions {
  let left = 0;
  let right = 0;
  for (const { a, P } of loads) {
    left += (P * (L - a)) / L;
    right += (P * a) / L;
  }
  return { left, right };
}

/** Bending moment at x: R1·x minus each load to the left of x times its distance from x. */
export function momentAt(L: number, loads: readonly SpanLoad[], x: number): number {
  let M = reactions(L, loads).left * x;
  for (const { a, P } of loads) if (a < x) M -= P * (x - a);
  return M;
}

/**
 * Largest moment and where it occurs. With point loads only, the moment diagram is straight
 * between loads, so the maximum is under one of them.
 */
export function maxMoment(L: number, loads: readonly SpanLoad[]): { M: number; x: number } {
  let best = { M: 0, x: 0 };
  for (const { a } of loads) {
    const M = momentAt(L, loads, a);
    if (M > best.M) best = { M, x: a };
  }
  return best;
}

/** Largest shear: the larger support reaction, since every load acts downward between supports. */
export function maxShear(L: number, loads: readonly SpanLoad[]): number {
  const { left, right } = reactions(L, loads);
  return Math.max(left, right);
}

/**
 * Deflection times EI at x, as the cubic c3·x³ + c2·x² + c1·x + c0 valid on the stretch of span
 * that contains x. For one load P at a (b = L − a), DA6 Figure 8 gives:
 *   x ≤ a: P·b·x·(L² − b² − x²) / (6·EI·L)
 *   x ≥ a: P·a·(L − x)·(2·L·x − x² − a²) / (6·EI·L),
 * and (L − x)·(2Lx − x² − a²) = x³ − 3L·x² + (2L² + a²)·x − a²·L.
 */
function cubicOn(
  L: number,
  loads: readonly SpanLoad[],
  x: number,
): [number, number, number, number] {
  const c: [number, number, number, number] = [0, 0, 0, 0];
  for (const { a, P } of loads) {
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
  return c;
}

function evaluate(c: [number, number, number, number], x: number): number {
  return ((c[3] * x + c[2]) * x + c[1]) * x + c[0];
}

/** Deflection at x times EI (lb·in³), downward positive. Divide by E·I for inches. */
export function deflectionTimesEIAt(L: number, loads: readonly SpanLoad[], x: number): number {
  return evaluate(cubicOn(L, loads, x), x);
}

/**
 * Largest deflection times EI, and where. Between consecutive loads the deflection is one cubic,
 * so its maximum is at an end of the stretch or where its slope, a quadratic, is zero. This finds
 * the maximum exactly rather than by sampling.
 */
export function maxDeflectionTimesEI(
  L: number,
  loads: readonly SpanLoad[],
): { deltaEI: number; x: number } {
  const breaks = [0, ...loads.map((l) => l.a).sort((p, q) => p - q), L];
  let best = { deltaEI: 0, x: L / 2 };
  const consider = (x: number) => {
    const deltaEI = deflectionTimesEIAt(L, loads, x);
    if (deltaEI > best.deltaEI) best = { deltaEI, x };
  };
  for (let i = 1; i < breaks.length; i++) {
    const x0 = breaks[i - 1] as number;
    const x1 = breaks[i] as number;
    if (x1 <= x0) continue;
    consider(x0);
    consider(x1);
    const c = cubicOn(L, loads, (x0 + x1) / 2);
    for (const root of quadraticRoots(3 * c[3], 2 * c[2], c[1])) {
      if (root > x0 && root < x1) consider(root);
    }
  }
  return best;
}

function quadraticRoots(A: number, B: number, C: number): number[] {
  if (Math.abs(A) < 1e-12) return Math.abs(B) < 1e-12 ? [] : [-C / B];
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [(-B - s) / (2 * A), (-B + s) / (2 * A)];
}
