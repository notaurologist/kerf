import type { UV } from './outline.ts';

// Splits a simple polygon into convex pieces, for faces drawn in depth order: ear clipping into
// triangles, then merging neighbors while the result stays convex (Hertel and Mehlhorn 1983). Each
// piece says which of its edges are the polygon's own, so the diagonals between pieces aren't drawn.

export interface ConvexPiece {
  points: UV[];
  /** `edge[i]` is true when the edge from point i to the next is one of the polygon's edges. */
  edge: boolean[];
}

const EPS = 1e-12;

const cross = (o: UV, a: UV, b: UV) => (a.u - o.u) * (b.v - o.v) - (a.v - o.v) * (b.u - o.u);

/** True when every corner of a counterclockwise polygon turns left or runs straight. */
export function isConvex(points: readonly UV[]): boolean {
  const n = points.length;
  return points.every(
    (p, i) => cross(p, points[(i + 1) % n] as UV, points[(i + 2) % n] as UV) >= -EPS,
  );
}

function inTriangle(p: UV, a: UV, b: UV, c: UV): boolean {
  return cross(a, b, p) >= -EPS && cross(b, c, p) >= -EPS && cross(c, a, p) >= -EPS;
}

/** Convex pieces of a counterclockwise simple polygon; the polygon itself when it is convex. */
export function convexPieces(polygon: readonly UV[]): ConvexPiece[] {
  const n = polygon.length;
  if (isConvex(polygon)) return [{ points: [...polygon], edge: polygon.map(() => true) }];
  const at = (i: number) => polygon[i] as UV;
  const own = (i: number, j: number) => j === (i + 1) % n;

  // Ear clipping, by index into the polygon.
  const left = Array.from({ length: n }, (_, i) => i);
  const triangles: number[][] = [];
  while (left.length > 3) {
    const m = left.length;
    let clipped = false;
    for (let k = 0; k < m; k++) {
      const [i, j, l] = [left[(k + m - 1) % m], left[k], left[(k + 1) % m]] as [
        number,
        number,
        number,
      ];
      if (cross(at(i), at(j), at(l)) <= EPS) continue;
      const blocked = left.some(
        (o) => o !== i && o !== j && o !== l && inTriangle(at(o), at(i), at(j), at(l)),
      );
      if (blocked) continue;
      triangles.push([i, j, l]);
      left.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error('polygon is not simple, or not counterclockwise');
  }
  triangles.push(left);

  // Merge pieces across a shared diagonal while the result stays convex.
  const pieces = triangles;
  let merged = true;
  while (merged) {
    merged = false;
    search: for (let a = 0; a < pieces.length; a++) {
      const A = pieces[a] as number[];
      for (let e = 0; e < A.length; e++) {
        const p = A[e] as number;
        const q = A[(e + 1) % A.length] as number;
        if (own(p, q)) continue;
        for (let b = a + 1; b < pieces.length; b++) {
          const B = pieces[b] as number[];
          const f = B.findIndex((x, k) => x === q && B[(k + 1) % B.length] === p);
          if (f < 0) continue;
          // A from q round to p, then B's points strictly between p and q.
          const fromQ = [...A.slice(e + 1), ...A.slice(0, e + 1)];
          const fromP = [...B.slice((f + 1) % B.length), ...B.slice(0, (f + 1) % B.length)];
          const afterP = fromP.slice(1, -1);
          const joined = [...fromQ, ...afterP];
          if (!isConvex(joined.map(at))) continue;
          pieces[a] = joined;
          pieces.splice(b, 1);
          merged = true;
          break search;
        }
      }
    }
  }
  return pieces.map((idx) => ({
    points: idx.map(at),
    edge: idx.map((i, k) => own(i, idx[(k + 1) % idx.length] as number)),
  }));
}
