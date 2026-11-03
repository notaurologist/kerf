import { describe, expect, it } from 'vitest';
import { netSection, shearSection } from './netSection.ts';

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

describe('the section that resists shear at a hole', () => {
  const A = (r: ReturnType<typeof shearSection>) => {
    if (typeof r === 'string') throw new Error(r);
    return r.A;
  };

  it('down through the depth is the net section: 4x6 with a 9/16" hole, 2.9375·5.5 = 16.15625', () => {
    expect(
      A(shearSection(3.5, 5.5, 1, { kind: 'through-depth', diameter: 0.5625, center: 1.75 })),
    ).toBeCloseTo(16.15625, 9);
  });

  it('down through the seam of two plies takes half the hole from each: 1.21875·5.5', () => {
    expect(
      A(shearSection(1.5, 5.5, 2, { kind: 'through-depth', diameter: 0.5625, center: 1.5 })),
    ).toBeCloseTo(6.703125, 9);
  });

  // NDS 2024 3.4.4.1, Figure 3E: with the load hanging from the bolts, the unloaded edge is the
  // top, so d_e = d − (d − h) = h.
  const hung = { kind: 'through-breadth', diameter: 0.5625, height: 2 } as const;

  it('across the breadth, at least 5d from the end: b·d_e = 3.5·2 = 7 (Eq. 3.4-9)', () => {
    expect(A(shearSection(3.5, 5.5, 1, hung, { fromEnd: 27.5 }))).toBeCloseTo(7, 9);
  });

  it('across the breadth, within 5d of the end: b·d_e·(d_e/d)² = 7·(2/5.5)² = 0.92562 (Eq. 3.4-8)', () => {
    expect(A(shearSection(3.5, 5.5, 1, hung, { fromEnd: 27.4 }))).toBeCloseTo(0.92562, 6);
  });

  it('is not worked out across the breadth where no load hangs from the hole', () => {
    expect(shearSection(3.5, 5.5, 1, hung)).toBe(
      'Kerf does not work out shear at a hole across the member that no load hangs from.',
    );
  });

  it('refuses a hole past the member, as the net section does', () => {
    expect(shearSection(3.5, 5.5, 1, { kind: 'through-depth', diameter: 0.5, center: 0.2 })).toBe(
      'The hole reaches past the side of the member.',
    );
  });
});
