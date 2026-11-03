import { describe, expect, it } from 'vitest';
import { crosses, letterColumn, letterRoom } from './letters.ts';
import type { Point2, Primitive } from './primitives.ts';

type Letter = Extract<Primitive, { kind: 'letter' }>;

const letter = (name: string, target: Point2): Letter => ({
  kind: 'letter',
  at: target,
  target,
  letter: name,
  part: { partId: name, instance: 0, letter: name },
});
const open = { top: -Infinity, bottom: Infinity };
const leaders = (column: readonly Letter[]) =>
  column.flatMap((a, i) =>
    column.slice(i + 1).flatMap((b) => (crosses(a.at, a.target, b.at, b.target) ? [a, b] : [])),
  );

describe('a column of part letters', () => {
  it('sets each letter at its part’s height when there is room', () => {
    const column = letterColumn(
      [letter('B', { x: 5, y: 20 }), letter('A', { x: 5, y: 0 })],
      -4,
      5,
      open,
    );
    expect(column.map((l) => [l.letter, l.at.x, l.at.y])).toEqual([
      ['A', -4, 0],
      ['B', -4, 20],
    ]);
  });

  it('moves up by half of what it runs past the lowest part', () => {
    // Targets at 0 and 2, 5 apart: places 0 and 5 run 3 past the lowest part, so both move up 1.5.
    const column = letterColumn(
      [letter('A', { x: 5, y: 0 }), letter('B', { x: 5, y: 2 })],
      -4,
      5,
      open,
    );
    expect(column.map((l) => l.at.y)).toEqual([-1.5, 3.5]);
  });

  it('keeps above dimensions below the drawing, and swaps letters whose leaders cross', () => {
    // A is a short leader to (2, 10), B a long one to (10, 11). Held above y = 0 the places are
    // −5 and 0; in order of height, A's leader from (0, −5) passes below B's from (0, 0) by x = 2,
    // so they cross, and swapping them leaves neither crossing.
    const a = letter('A', { x: 2, y: 10 });
    const b = letter('B', { x: 10, y: 11 });
    expect(crosses({ x: 0, y: -5 }, a.target, { x: 0, y: 0 }, b.target)).toBe(true);
    const column = letterColumn([a, b], 0, 5, { top: -Infinity, bottom: 0 });
    expect(column.map((l) => [l.letter, l.at.y])).toEqual([
      ['B', -5],
      ['A', 0],
    ]);
    expect(leaders(column)).toEqual([]);
  });

  it('centers a column too tall for its room', () => {
    const column = letterColumn(
      ['A', 'B', 'C'].map((n, i) => letter(n, { x: 5, y: i })),
      0,
      10,
      { top: 0, bottom: 10 },
    );
    expect(column.map((l) => l.at.y)).toEqual([-5, 5, 15]);
  });

  it('never leaves two leaders crossing', () => {
    // Made-up parts scattered over a 40 by 30 drawing, a column at x = −6, from a fixed seed.
    let seed = 7;
    const next = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(next() * 14);
      const parts = Array.from({ length: n }, (_, i) =>
        letter(String(i), { x: next() * 40, y: next() * 30 }),
      );
      const bottom = next() < 0.5 ? 30 : Infinity;
      const column = letterColumn(parts, -6, 1 + next() * 4, { top: -Infinity, bottom });
      expect(leaders(column)).toEqual([]);
      expect(column.map((l) => l.letter).sort()).toEqual(parts.map((l) => l.letter).sort());
    }
  });
});

describe('room for letters', () => {
  const model: Primitive = {
    kind: 'polygon',
    role: 'visible',
    fill: 1,
    points: [
      { x: 0, y: -10 },
      { x: 20, y: -10 },
      { x: 20, y: 0 },
      { x: 0, y: 0 },
    ],
  };
  const dimension = (from: Point2, to: Point2): Primitive => ({
    kind: 'line',
    role: 'dimension',
    points: [from, to],
    arrows: true,
  });

  it('leaves both sides open, at any height, with no dimensions', () => {
    expect(letterRoom([model])).toEqual({
      sides: ['left', 'right'],
      top: -Infinity,
      bottom: Infinity,
    });
  });

  it('closes a side a dimension runs along, and keeps letters level with the model above one below it', () => {
    const right = dimension({ x: 22, y: -10 }, { x: 22, y: 0 });
    const below = dimension({ x: 0, y: 2 }, { x: 20, y: 2 });
    expect(letterRoom([model, right, below])).toEqual({
      sides: ['left'],
      top: -Infinity,
      bottom: 0,
    });
    const above = dimension({ x: 0, y: -12 }, { x: 20, y: -12 });
    expect(letterRoom([model, above])).toEqual({
      sides: ['left', 'right'],
      top: -10,
      bottom: Infinity,
    });
  });

  it('uses both sides when dimensions take both', () => {
    const left = dimension({ x: -2, y: -10 }, { x: -2, y: 0 });
    const right = dimension({ x: 22, y: -10 }, { x: 22, y: 0 });
    expect(letterRoom([model, left, right]).sides).toEqual(['left', 'right']);
  });
});
