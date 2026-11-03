import { describe, expect, it } from 'vitest';
import { netSection } from './netSection.ts';

// Net sections at a bored hole (NDS 2024 3.1.2.1), computed by hand.

const S = (r: ReturnType<typeof netSection>) => {
  if (typeof r === 'string') throw new Error(r);
  return r.S;
};

describe('a hole down through the depth', () => {
  it('takes the hole from the breadth: 4x6 with a 9/16" hole, (3.5 − 0.5625)·5.5²/6 = 14.8099', () => {
    expect(
      S(netSection(3.5, 5.5, 1, { kind: 'through-depth', diameter: 0.5625, center: 1.75 })),
    ).toBeCloseTo(14.809896, 5);
  });

  it('splits a hole on the seam of two plies: each loses 0.28125 of 1.5', () => {
    const r = netSection(1.5, 5.5, 2, { kind: 'through-depth', diameter: 0.5625, center: 1.5 });
    expect(S(r)).toBeCloseTo((1.21875 * 5.5 ** 2) / 6, 9);
  });

  it('takes the whole hole from the middle ply of three', () => {
    const r = netSection(1.5, 5.5, 3, { kind: 'through-depth', diameter: 0.5625, center: 2.25 });
    expect(S(r)).toBeCloseTo((0.9375 * 5.5 ** 2) / 6, 9);
  });

  it('refuses a hole past the side', () => {
    expect(netSection(3.5, 5.5, 1, { kind: 'through-depth', diameter: 0.5, center: 0.2 })).toBe(
      'The hole reaches past the side of the member.',
    );
  });
});

describe('a hole across the breadth', () => {
  // At mid-depth the neutral axis stays put: I = 3.5·(5.5³ − 0.5625³)/12 = 48.4741, S = I/2.75.
  it('at mid-depth removes only the band: S = 17.6270 against 17.6458', () => {
    expect(
      S(netSection(3.5, 5.5, 1, { kind: 'through-breadth', diameter: 0.5625, height: 2.75 })),
    ).toBeCloseTo(17.627, 4);
  });

  // b = 1.5, D = 0.4375, h = 1.5: ȳ = 2.858025, I = 19.672403, c = ȳ, S = 6.883217.
  it('below mid-depth moves the neutral axis up and takes S to the top face', () => {
    expect(
      S(netSection(1.5, 5.5, 2, { kind: 'through-breadth', diameter: 0.4375, height: 1.5 })),
    ).toBeCloseTo(6.883217, 5);
  });

  it('refuses a hole past the top or bottom', () => {
    expect(netSection(3.5, 5.5, 1, { kind: 'through-breadth', diameter: 0.5, height: 5.4 })).toBe(
      'The hole reaches past the top or bottom of the member.',
    );
  });
});
