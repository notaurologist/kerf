import { describe, expect, it } from 'vitest';
import { condense, END_ROTATION, element, localStiffness, START_ROTATION } from './element.ts';

const E = 1_000_000;
const L = 100;
const I = 100;
const A = 10;

describe('localStiffness', () => {
  it('has the Euler–Bernoulli terms for E = 1,000,000 psi, A = 10 in², I = 100 in⁴, L = 100 in', () => {
    // EA/L = 100,000; 12EI/L³ = 1,200; 6EI/L² = 60,000; 4EI/L = 4,000,000; 2EI/L = 2,000,000.
    expect(localStiffness(E, A, I, L).rows()).toEqual([
      [100_000, 0, 0, -100_000, 0, 0],
      [0, 1_200, 60_000, 0, -1_200, 60_000],
      [0, 60_000, 4_000_000, 0, -60_000, 2_000_000],
      [-100_000, 0, 0, 100_000, 0, 0],
      [0, -1_200, -60_000, 0, 1_200, -60_000],
      [0, 60_000, 2_000_000, 0, -60_000, 4_000_000],
    ]);
  });
});

describe('condense', () => {
  it('releasing the end rotation leaves 3EI/L³, 3EI/L², and 3EI/L', () => {
    // 3EI/L³ = 300, 3EI/L² = 30,000, 3EI/L = 3,000,000: a member pinned at its end.
    const k = condense(localStiffness(E, A, I, L), [END_ROTATION]).rows();
    expect(k[1]).toEqual([0, 300, 30_000, 0, -300, 0]);
    expect(k[2]).toEqual([0, 30_000, 3_000_000, 0, -30_000, 0]);
    expect(k[4]).toEqual([0, -300, -30_000, 0, 300, 0]);
    expect(k[5]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(k[0]).toEqual([100_000, 0, 0, -100_000, 0, 0]);
  });

  it('releasing both rotations leaves an axial member', () => {
    const k = condense(localStiffness(E, A, I, L), [START_ROTATION, END_ROTATION]).rows();
    expect(k.map((row) => row.map((v) => v + 0))).toEqual([
      [100_000, 0, 0, -100_000, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [-100_000, 0, 0, 100_000, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]);
  });
});

describe('element', () => {
  const section = { e: E, area: A, inertia: I };

  it('a vertical member puts its axial stiffness on global y and its bending on global x', () => {
    const el = element(
      { id: 'leg', start: 'a', end: 'b', section },
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: L },
    );
    const k = el.global;
    expect(k.get(1, 1)).toBeCloseTo(100_000, 9);
    expect(k.get(0, 0)).toBeCloseTo(1_200, 9);
    // Local v points to global −x for a member along +y, so the coupling changes sign.
    expect(k.get(0, 2)).toBeCloseTo(-60_000, 9);
    expect(k.get(2, 2)).toBeCloseTo(4_000_000, 9);
  });

  it('turns a member 30° without changing its stiffness along and across it', () => {
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    const el = element(
      { id: 'brace', start: 'a', end: 'b', section },
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: L * c, y: L * s },
    );
    // A unit stretch along the member, (c, s) at the end, takes EA/L along the member.
    const f = el.global.times([0, 0, 0, c, s, 0]);
    expect(f[3]).toBeCloseTo(100_000 * c, 6);
    expect(f[4]).toBeCloseTo(100_000 * s, 6);
  });

  it('refuses a member without a positive section or length', () => {
    const a = { id: 'a', x: 0, y: 0 };
    expect(() =>
      element({ id: 'm', start: 'a', end: 'b', section: { ...section, inertia: 0 } }, a, {
        id: 'b',
        x: 1,
        y: 0,
      }),
    ).toThrow('positive moment of inertia');
    expect(() => element({ id: 'm', start: 'a', end: 'b', section }, a, { ...a, id: 'b' })).toThrow(
      'no length',
    );
  });
});
