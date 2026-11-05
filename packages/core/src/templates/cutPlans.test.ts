import { describe, expect, it, vi } from 'vitest';
import { materialBound, relaxation } from '../cutting/bounds.ts';
import { planProblems } from '../cutting/check.ts';
import { solveExact } from '../cutting/exact.ts';
import { firstFitDecreasing } from '../cutting/firstFit.ts';
import { type CutInstance, measure } from '../cutting/instance.ts';
import { isBoardStock, isPanel, isStripGlueUp } from '../lumber/partStock.ts';
import { stripBoardsFor } from '../lumber/strips.ts';
import type { Part } from '../model/types.ts';
import { DEFAULT_BOARD_OPTIONS, planLumber } from '../outputs/shoppingList.ts';
import { TEMPLATES } from './index.ts';

// The exact cut planner on every template's examples: one instance per stock, grouped as the
// shopping list groups them.

interface Stock {
  nominal: string;
  instance: CutInstance;
}

/** Each stock's pieces, in the order `planLumber` adds them, with the lengths it is sold in. */
function stocksOf(parts: readonly Part[]): Stock[] {
  const groups = new Map<string, { lengths: number[]; pieces: number[] }>();
  const add = (nominal: string, feet: readonly number[], length: number, count: number) => {
    const group = groups.get(nominal) ?? { lengths: [...feet].sort((a, b) => a - b), pieces: [] };
    for (let i = 0; i < count; i++) group.pieces.push(length);
    groups.set(nominal, group);
  };
  for (const part of parts) {
    const { stock } = part;
    if (isPanel(stock)) {
      add(
        stock.board.nominal,
        stock.board.buyableFeet,
        stock.boardLength,
        part.quantity * stock.boards,
      );
    } else if (isStripGlueUp(stock)) {
      add(
        stock.board.nominal,
        stock.board.buyableFeet,
        stock.stripLength,
        stripBoardsFor(stock, part.quantity),
      );
    } else {
      const feet = isBoardStock(stock) ? stock.buyableFeet : DEFAULT_BOARD_OPTIONS.buyableFeet;
      add(stock.nominal, feet, part.length, part.quantity);
    }
  }
  return [...groups].map(([nominal, group]) => ({
    nominal,
    instance: {
      ...group,
      kerf: DEFAULT_BOARD_OPTIONS.kerf,
      trimPerEnd: DEFAULT_BOARD_OPTIONS.trimPerEnd,
    },
  }));
}

const EXAMPLES = TEMPLATES.flatMap((template) =>
  template.examples.map((example) => {
    const made = template.generate(
      template.params.parse(example.params),
      template.structuralInputs.parse(example.structuralInputs),
    );
    if (!made.ok) throw new Error(`${template.id} / ${example.name} makes no plan.`);
    const { parts } = (made.output as { design: { parts: readonly Part[] } }).design;
    return { source: `${template.id} / ${example.name}`, parts };
  }),
);

const STOCKS = EXAMPLES.flatMap(({ source, parts }) =>
  stocksOf(parts).map((stock) => ({ source: `${source}, ${stock.nominal}`, ...stock })),
);

function stock(source: string): CutInstance {
  const found = STOCKS.find((s) => s.source.startsWith(source));
  if (!found) throw new Error(`No stock ${source}.`);
  return found.instance;
}

describe('first-fit decreasing on the examples', () => {
  it.each(EXAMPLES.map((e) => [e.source, e.parts] as const))(
    'matches the shopping list board for board: %s',
    (_, parts) => {
      const planned = stocksOf(parts).flatMap(({ nominal, instance }) =>
        firstFitDecreasing(instance).boards.map((board) => ({
          nominal,
          feet: board.feet,
          pieces: board.pieces.map((i) => instance.pieces[i]),
        })),
      );
      const shopping = planLumber(parts).boards.map((board) => ({
        nominal: board.nominal,
        feet: board.feet,
        pieces: board.pieces.map((p) => p.length),
      }));
      expect(planned).toEqual(shopping);
    },
  );
});

describe('bounds on every example stock', () => {
  it.each(STOCKS.map((s) => [s.source, s.instance] as const))('%s', (_, instance) => {
    const first = measure(firstFitDecreasing(instance)).feet;
    const lp = relaxation(instance);
    // A bound above a plan that exists would be wrong.
    expect(materialBound(instance)).toBeLessThanOrEqual(first);
    expect(lp.bound).toBeLessThanOrEqual(first);
    // The relaxation's boards cover every piece and cost its value.
    lp.types.forEach((type, i) => {
      const cut = lp.patterns.reduce(
        (sum, p, j) => sum + (p.counts[i] ?? 0) * (lp.boards[j] ?? 0),
        0,
      );
      expect(cut).toBeGreaterThanOrEqual(type.demand - 1e-6);
    });
    const cost = lp.patterns.reduce((sum, p, j) => sum + p.feet * (lp.boards[j] ?? 0), 0);
    expect(cost).toBeCloseTo(lp.value, 6);
    // No pattern is worth more than its feet at the final prices, and the prices value the
    // pieces at the same total (strong duality).
    for (const p of lp.patterns) {
      const worth = p.counts.reduce((sum, n, i) => sum + n * (lp.prices[i] ?? 0), 0);
      expect(worth).toBeLessThanOrEqual(p.feet + 1e-6);
    }
    const priced = lp.types.reduce((sum, t, i) => sum + t.demand * (lp.prices[i] ?? 0), 0);
    expect(priced).toBeCloseTo(lp.value, 6);
  });
});

describe('the exact method on every example stock', () => {
  it.each(STOCKS.map((s) => [s.source, s.instance] as const))('%s', (_, instance) => {
    const solved = solveExact(instance, { workLimit: 3e6 });
    expect(planProblems(instance, solved.plan)).toEqual([]);
    expect(solved.feet).toBe(measure(solved.plan).feet);
    expect(solved.feet).toBeLessThanOrEqual(measure(firstFitDecreasing(instance)).feet);
    expect(solved.feet).toBeGreaterThanOrEqual(solved.bound);
  });

  // The plans the cut optimization exploration reported for the worked examples, at the chosen
  // work limit: 6 ft less cherry on the record cabinet and 10 ft less on the workbench, each
  // proven, since each meets its relaxation's bound.
  it.each([
    ['record-cabinet / Worked example, every input entered, 13/16" x 5-1/2"', 100, 94],
    ['workbench / Worked example, every input entered, 13/16" x 5-1/2"', 386, 376],
  ])('%s: %i ft by first-fit decreasing, %i ft by the exact method', (source, first, exact) => {
    const instance = stock(source);
    expect(measure(firstFitDecreasing(instance)).feet).toBe(first);
    const solved = solveExact(instance);
    expect(solved).toMatchObject({ feet: exact, bound: exact, proven: true });
    expect(planProblems(instance, solved.plan)).toEqual([]);
  });

  // A workbench stock the search cannot prove within this limit, so the plan is the one found when
  // the work ran out. Neither the clock nor the run before it changes where that is.
  it('gives the same plan on repeated runs and whatever the clock reads', () => {
    const tallest = stock('workbench / Edge of range: the tallest bench');
    const first = solveExact(tallest, { workLimit: 2e6 });
    expect(first.proven).toBe(false);
    expect(solveExact(tallest, { workLimit: 2e6 })).toEqual(first);
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => {
      now += 1e6 * Math.random();
      return now;
    });
    try {
      expect(solveExact(tallest, { workLimit: 2e6 })).toEqual(first);
    } finally {
      clock.mockRestore();
    }
  });
});
