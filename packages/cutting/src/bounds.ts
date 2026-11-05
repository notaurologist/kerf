import { fitsNoLength, type Instance } from './instance.ts';
import { knapsack } from './knapsack.ts';
import { maximize } from './simplex.ts';

// Lower bounds on the feet any plan must buy. Pieces no length holds are left out, as every plan
// leaves them out. Every buyable length here is a whole number of feet, so a plan's feet are a
// multiple of the lengths' greatest common divisor, and a bound rounds up to the next multiple.

const EPS = 1e-9;

/** One piece length and how many pieces have it. */
interface PieceType {
  length: number;
  demand: number;
  /** The pieces' indexes in the instance. */
  pieces: number[];
}

/** A way to cut one board: its length and how many of each piece type it holds. */
interface Pattern {
  feet: number;
  counts: number[];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The step every plan's total feet moves in: the greatest common divisor of the lengths. */
function step(instance: Instance): number {
  if (!instance.lengths.every(Number.isInteger)) {
    throw new Error('Buyable lengths must be whole feet.');
  }
  return instance.lengths.reduce(gcd, 0);
}

/** `value` rounded up to the next multiple of `by`, allowing for rounding error in `value`. */
function roundUp(value: number, by: number): number {
  return by * Math.ceil(value / by - EPS);
}

/** The pieces that fit some length, grouped by length, longest first. */
function pieceTypes(instance: Instance): PieceType[] {
  const byLength = new Map<number, number[]>();
  instance.pieces.forEach((piece, i) => {
    if (fitsNoLength(instance, i)) return;
    byLength.set(piece.length, [...(byLength.get(piece.length) ?? []), i]);
  });
  return [...byLength]
    .sort(([a], [b]) => b - a)
    .map(([length, pieces]) => ({ length, demand: pieces.length, pieces }));
}

/**
 * The material bound: the least total of buyable lengths whose room after trim covers every
 * piece and its kerf, ignoring how pieces divide among boards.
 */
export function materialBound(instance: Instance): number {
  const by = step(instance);
  const need = pieceTypes(instance).reduce(
    (sum, t) => sum + t.demand * (t.length + instance.kerf),
    0,
  );
  if (need === 0) return 0;
  // room[f]: the most room any set of boards totalling exactly f feet gives, or -1 if none does.
  const room: number[] = [0];
  for (let feet = by; ; feet += by) {
    let best = -1;
    for (const length of instance.lengths) {
      const before = room[feet - length];
      if (before === undefined || before < 0) continue;
      best = Math.max(best, before + length * 12 - 2 * instance.trimPerEnd);
    }
    room[feet] = best;
    if (best >= need - EPS) return feet;
  }
}

export interface Relaxation {
  /** The linear relaxation's optimum, in feet. */
  value: number;
  /** The relaxation's bound on a plan's feet: `value` rounded up to a multiple of the step. */
  bound: number;
  types: PieceType[];
  patterns: Pattern[];
  /** How many boards of each pattern the relaxation cuts, possibly fractions. */
  boards: number[];
  /** The value of one piece of each type at the optimum. */
  prices: number[];
  /** Patterns priced in after the first ones. */
  generated: number;
}

/** The most of one type a board of `feet` holds, and at most its demand. */
function most(instance: Instance, type: PieceType, feet: number): number {
  const room = feet * 12 - 2 * instance.trimPerEnd;
  return Math.min(type.demand, Math.floor((room + EPS) / (type.length + instance.kerf)));
}

/**
 * The linear relaxation of the cutting-stock problem with several stock lengths, by column
 * generation (Gilmore and Gomory, "A Linear Programming Approach to the Cutting-Stock Problem",
 * Operations Research 9(6), 1961, and Part II, 11(6), 1963): minimize the feet of the boards cut,
 * Σ feet(p)·x(p), subject to Σ counts(p, i)·x(p) ≥ demand(i) for each piece type i, x ≥ 0. It
 * starts from one pattern per type, as many of it as the longest length holds, and solves the
 * dual, max Σ demand(i)·price(i) subject to Σ counts(p, i)·price(i) ≤ feet(p), whose slack start
 * is feasible. For each length a knapsack finds the pattern worth most at those prices; a pattern
 * worth more than its feet enters, and when none does the prices are optimal.
 */
export function relaxation(instance: Instance, maxRounds = 500): Relaxation {
  const by = step(instance);
  const types = pieceTypes(instance);
  const longest = instance.lengths.at(-1) ?? 0;
  const patterns: Pattern[] = types.map((type, i) => ({
    feet: longest,
    counts: types.map((_, j) => (j === i ? most(instance, type, longest) : 0)),
  }));
  const initial = patterns.length;
  for (let round = 0; ; round++) {
    if (round > maxRounds) throw new Error('Column generation did not settle.');
    const lp = maximize(
      types.map((t) => t.demand),
      patterns.map((p) => p.counts),
      patterns.map((p) => p.feet),
    );
    const prices = lp.y;
    let added = 0;
    for (const feet of instance.lengths) {
      const packed = knapsack(
        types.map((type, i) => ({
          weight: type.length + instance.kerf,
          value: prices[i] ?? 0,
          limit: type.demand,
        })),
        feet * 12 - 2 * instance.trimPerEnd,
      );
      if (packed.value > feet + EPS) {
        patterns.push({ feet, counts: packed.counts });
        added++;
      }
    }
    if (added === 0) {
      return {
        value: lp.value,
        bound: roundUp(lp.value, by),
        types,
        patterns,
        boards: lp.dual,
        prices,
        generated: patterns.length - initial,
      };
    }
  }
}
