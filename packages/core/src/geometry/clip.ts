// Sutherland–Hodgman clipping of a convex polygon by a half-space, for any point type. `side`
// gives a signed distance; the part where it is ≥ 0 is kept.

export function clipPolygon<P>(
  points: readonly P[],
  side: (p: P) => number,
  lerp: (a: P, b: P, t: number) => P,
): P[] {
  const out: P[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as P;
    const b = points[(i + 1) % points.length] as P;
    const da = side(a);
    const db = side(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) out.push(lerp(a, b, da / (da - db)));
  }
  return out;
}

/** Twice the signed area of a 2D polygon: positive when counterclockwise in x-right, y-up. */
export function signedArea2(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as { x: number; y: number };
    const b = points[(i + 1) % points.length] as { x: number; y: number };
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}
