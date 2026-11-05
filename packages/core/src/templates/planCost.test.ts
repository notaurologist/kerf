import { describe, expect, it, vi } from 'vitest';
import type * as cache from '../cutting/cache.ts';
import { solveCached } from '../cutting/cache.ts';
import { TEMPLATES } from './index.ts';

// What generating each worked example costs. The exact cut planner counts its work in units and
// stops at a limit of them (decision 0021), so the work each stock's search spends is the same on
// every machine and can be asserted exactly: a change that makes the search do more work fails
// here, and its new counts show up in review. Time per unit is not fixed, so one coarse timing
// test watches that.

/** Each stock search the shopping list asks for: its number of pieces and the work it spent. */
const searches: [pieces: number, work: number][] = [];
vi.mock('../cutting/cache.ts', async (actual) => {
  const real = await actual<typeof cache>();
  const counted = (...args: Parameters<typeof real.solveCached>) => {
    const solved = real.solveCached(...args);
    searches.push([args[0].pieces.length, solved.work]);
    return solved;
  };
  return { ...real, solveCached: Object.assign(counted, { clear: real.solveCached.clear }) };
});

const EXAMPLES = TEMPLATES.flatMap((t) =>
  t.examples.map((e) => ({
    source: `${t.id} / ${e.name}`,
    generate: () =>
      t.generate(t.params.parse(e.params), t.structuralInputs.parse(e.structuralInputs)),
  })),
);

function generate(source: string): void {
  const example = EXAMPLES.find((e) => e.source === source);
  if (!example) throw new Error(`No example ${source}.`);
  if (!example.generate().ok) throw new Error(`${source} makes no plan.`);
}

// The slowest example: its one stock's search spends the whole work limit without proving its plan.
// Measured with nothing cached, as a new server instance generates it (decision 0021, Measured
// cost). The budgets catch a slowdown of a few times, not a small one, so a busy machine does not
// fail them.
const SLOWEST = 'workbench / Edge of range: the tallest bench, with a 4" top';
const BUDGET_MS = process.env.CI ? 5000 : 3000;

describe('generating the slowest worked example with nothing cached', () => {
  it(`takes under ${BUDGET_MS / 1000} s`, () => {
    solveCached.clear();
    const started = performance.now();
    generate(SLOWEST);
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });
});

// In the order the shopping list plans them.
const SPENT: Record<string, [pieces: number, work: number][]> = {
  'swing-set-a-frame / Worked example, every input entered': [
    [1, 24],
    [4, 68],
    [2, 41],
    [2, 43],
  ],
  'swing-set-a-frame / Worked example, no structural inputs': [
    [1, 24],
    [4, 68],
    [2, 41],
    [2, 43],
  ],
  'swing-set-a-frame / Two-ply 2x6 beam on pads, level ground, footprint depth': [
    [4, 79],
    [4, 29],
    [2, 43],
  ],
  'record-cabinet / Worked example, every input entered': [
    [45, 4_353_072],
    [4, 26],
  ],
  'record-cabinet / Worked example, no structural inputs': [
    [45, 4_353_072],
    [4, 26],
  ],
  'record-cabinet / Edge of range: two bays, 1" walnut panels': [
    [23, 29_764],
    [4, 7],
  ],
  'workbench / Worked example, every input entered': [[164, 35_896_819]],
  'workbench / Worked example, no structural inputs': [[164, 35_896_819]],
  'workbench / Edge of range: the tallest bench, with a 4" top': [[176, 40_000_362]],
};

describe('the work each stock search spends', () => {
  it('has counts for every worked example', () => {
    expect(Object.keys(SPENT).sort()).toEqual(EXAMPLES.map((e) => e.source).sort());
  });

  it.each(EXAMPLES.map((e) => e.source))('%s', (source) => {
    searches.length = 0;
    generate(source);
    expect(searches).toEqual(SPENT[source]);
  });
});
