import { firstFitDecreasing } from './baseline.ts';
import {
  materialBound,
  OutOfTime,
  type PieceType,
  pieceTypes,
  relaxation,
  type SeedPattern,
  step,
} from './bounds.ts';
import { measure } from './check.ts';
import { type CutPlan, fitsNoLength, type Instance } from './instance.ts';

// Branch-and-bound over boards. Each node holds the pieces still to place, as a count of each
// piece length. A node branches on the longest length left: some board must hold one of those
// pieces, so it tries every board that does, cut from the shortest buyable length that holds it,
// with nothing more that fits on that length (a piece that still fits could move there from its
// own board at no cost, so the search loses no plan by skipping such boards). A node is pruned
// when its feet so far plus a lower bound on what is left cannot beat the best plan found: the
// material bound first, as it is cheap, then the linear relaxation. The search starts from the
// baseline's plan, and stops early when that plan meets the root's bound or the time runs out.
//
// Branch-and-price was the alternative: branching inside column generation, so each node's
// relaxation stays exact. It needs branching rules the knapsack can respect (Vance, Barnhart,
// Johnson and Nemhauser, "Solving binary cutting stock problems by column generation and
// branch-and-bound", Computational Optimization and Applications 3, 1994). The instances here
// have at most a few hundred pieces in a few dozen lengths, so branching on boards is simpler,
// and the relaxation of each residual node still prunes with the full strength of column
// generation.

export interface Solved {
  plan: CutPlan;
  feet: number;
  /** The root's best lower bound. */
  bound: number;
  /** True when the search finished, so no plan buys fewer feet. */
  proven: boolean;
  /** Nodes searched. */
  nodes: number;
}

interface Board {
  feet: number;
  counts: number[];
}

const EPS = 1e-9;

/** The residual instance: `left[i]` pieces of each type. */
function residual(
  instance: Instance,
  types: readonly PieceType[],
  left: readonly number[],
): Instance {
  return {
    ...instance,
    pieces: types.flatMap((type, i) =>
      Array.from({ length: left[i] ?? 0 }, () => ({ partId: '', name: '', length: type.length })),
    ),
  };
}

/**
 * Every board holding at least one piece of type `first` from `left`, cut from the shortest length
 * that holds it, with no piece left over that would still fit on it. Most material per foot first,
 * so good plans are found early.
 */
function boardsFor(
  instance: Instance,
  types: readonly PieceType[],
  left: readonly number[],
  first: number,
): Board[] {
  const weight = types.map((t) => t.length + instance.kerf);
  const longest = (instance.lengths.at(-1) ?? 0) * 12 - 2 * instance.trimPerEnd;
  const out: Board[] = [];
  const counts = new Array<number>(types.length).fill(0);
  const visit = (i: number, used: number) => {
    if (i === types.length) {
      const feet = instance.lengths.find((f) => f * 12 - 2 * instance.trimPerEnd >= used - EPS);
      if (feet === undefined) return;
      const room = feet * 12 - 2 * instance.trimPerEnd - used;
      const more = types.some(
        (_, j) => (counts[j] ?? 0) < (left[j] ?? 0) && (weight[j] ?? 0) <= room + EPS,
      );
      if (!more) out.push({ feet, counts: [...counts] });
      return;
    }
    const min = i === first ? 1 : 0;
    const max = Math.min(left[i] ?? 0, Math.floor((longest - used + EPS) / (weight[i] ?? 1)));
    for (let k = max; k >= min; k--) {
      counts[i] = k;
      visit(i + 1, used + k * (weight[i] ?? 0));
    }
    counts[i] = 0;
  };
  visit(0, 0);
  const material = (b: Board) => b.counts.reduce((s, n, j) => s + n * (types[j]?.length ?? 0), 0);
  return out.sort((a, b) => material(b) / b.feet - material(a) / a.feet || a.feet - b.feet);
}

/** Turns boards of piece counts into a plan of piece indexes. */
function toPlan(
  instance: Instance,
  types: readonly PieceType[],
  boards: readonly Board[],
): CutPlan {
  const next = types.map(() => 0);
  return {
    boards: boards.map((board) => ({
      feet: board.feet,
      pieces: board.counts.flatMap((n, i) => {
        const type = types[i];
        if (!type) return [];
        const start = next[i] ?? 0;
        next[i] = start + n;
        return type.pieces.slice(start, start + n);
      }),
    })),
    unfit: instance.pieces.map((_, i) => i).filter((i) => fitsNoLength(instance, i)),
  };
}

export function solveExact(instance: Instance, { timeLimitMs = 2000 } = {}): Solved {
  const deadline = performance.now() + timeLimitMs;
  const baseline = firstFitDecreasing(instance);
  const by = step(instance);
  const types = pieceTypes(instance);
  const root = types.map((t) => t.demand);
  const material = materialBound(instance);
  let rootLp: ReturnType<typeof relaxation>;
  try {
    rootLp = relaxation(instance, { deadline });
  } catch (error) {
    if (!(error instanceof OutOfTime)) throw error;
    const { feet } = measure(baseline);
    return { plan: baseline, feet, bound: material, proven: feet <= material, nodes: 0 };
  }
  const bound = Math.max(material, rootLp.bound);
  // The root's patterns start every residual relaxation, which then needs few rounds.
  const seed: SeedPattern[] = rootLp.patterns.map((p) => ({
    feet: p.feet,
    pieces: new Map(rootLp.types.map((t, i) => [t.length, p.counts[i] ?? 0])),
  }));
  let best = { feet: measure(baseline).feet, boards: measure(baseline).boards, plan: baseline };
  let nodes = 0;
  let timedOut = false;

  const memo = new Map<string, number>();
  const lpMemo = new Map<string, number>();
  /** A lower bound on the feet `left` needs; the relaxation only when the material bound is at most `cutoff`. */
  const lowerBound = (left: readonly number[], cutoff: number): number => {
    const rest = residual(instance, types, left);
    const material = materialBound(rest);
    if (material > cutoff) return material;
    const key = left.join(',');
    let lp = lpMemo.get(key);
    if (lp === undefined) {
      lp = relaxation(rest, { seed, deadline }).bound;
      lpMemo.set(key, lp);
    }
    return Math.max(material, lp);
  };

  const chosen: Board[] = [];
  const search = (left: number[], feet: number) => {
    if (timedOut) return;
    nodes++;
    if (performance.now() > deadline) {
      timedOut = true;
      return;
    }
    const first = left.findIndex((n) => n > 0);
    if (first < 0) {
      const boards = chosen.length;
      if (feet < best.feet || (feet === best.feet && boards < best.boards)) {
        best = { feet, boards, plan: toPlan(instance, types, chosen) };
      }
      return;
    }
    const key = left.join(',');
    const seen = memo.get(key);
    if (seen !== undefined && seen <= feet) return;
    memo.set(key, feet);
    // Only a plan with fewer feet, by at least one step, is worth finding.
    const needed = best.feet - by - feet;
    let lower: number;
    try {
      lower = lowerBound(left, needed);
    } catch (error) {
      if (!(error instanceof OutOfTime)) throw error;
      timedOut = true;
      return;
    }
    if (lower > needed) return;
    for (const board of boardsFor(instance, types, left, first)) {
      if (feet + board.feet > best.feet - by) continue;
      chosen.push(board);
      search(
        left.map((n, i) => n - (board.counts[i] ?? 0)),
        feet + board.feet,
      );
      chosen.pop();
      if (best.feet <= bound || timedOut) return;
    }
  };

  if (best.feet > bound) search(root, 0);
  return {
    plan: best.plan,
    feet: best.feet,
    bound,
    proven: !timedOut,
    nodes,
  };
}
