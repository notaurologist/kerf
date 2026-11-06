import { describe, expect, it } from 'vitest';
import { element } from '../element.ts';
import { element3, localStiffness3, release, rotation } from './element.ts';
import type { Section3, Vec3 } from './model.ts';
import {
  FIGURE_9_9_PHI,
  SOUTHERN_PINE_SHEAR_RATIOS,
  shearRatio,
  torsionConstant,
} from './torsion.ts';

// Round numbers so each term can be checked by hand: E = 1,000,000, G = 400,000, A = 10, Iy = 50,
// Iz = 100, J = 20, L = 100.
const S: Section3 = { e: 1_000_000, g: 400_000, area: 10, iy: 50, iz: 100, j: 20 };
const L = 100;

const near = (actual: number | undefined, expected: number, within: number) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(within);
};

describe('localStiffness3', () => {
  it('is Eq. 4.34 term for term', () => {
    // EA/L = 100,000; GJ/L = 80,000. About z (Iz = 100): 12EI/L³ = 1,200, 6EI/L² = 60,000,
    // 4EI/L = 4,000,000, 2EI/L = 2,000,000. About y (Iy = 50): 600, 30,000, 2,000,000, 1,000,000.
    const a = 100_000;
    const t = 80_000;
    expect(localStiffness3(S, L).rows()).toEqual([
      [a, 0, 0, 0, 0, 0, -a, 0, 0, 0, 0, 0],
      [0, 1200, 0, 0, 0, 60_000, 0, -1200, 0, 0, 0, 60_000],
      [0, 0, 600, 0, -30_000, 0, 0, 0, -600, 0, -30_000, 0],
      [0, 0, 0, t, 0, 0, 0, 0, 0, -t, 0, 0],
      [0, 0, -30_000, 0, 2_000_000, 0, 0, 0, 30_000, 0, 1_000_000, 0],
      [0, 60_000, 0, 0, 0, 4_000_000, 0, -60_000, 0, 0, 0, 2_000_000],
      [-a, 0, 0, 0, 0, 0, a, 0, 0, 0, 0, 0],
      [0, -1200, 0, 0, 0, -60_000, 0, 1200, 0, 0, 0, -60_000],
      [0, 0, -600, 0, 30_000, 0, 0, 0, 600, 0, 30_000, 0],
      [0, 0, 0, -t, 0, 0, 0, 0, 0, t, 0, 0],
      [0, 0, -30_000, 0, 1_000_000, 0, 0, 0, 30_000, 0, 2_000_000, 0],
      [0, 60_000, 0, 0, 0, 2_000_000, 0, -60_000, 0, 0, 0, 4_000_000],
    ]);
  });
});

describe('rotation', () => {
  // Example 5.5 (p. 107): a member along (10, 5, 3), with y vertical. Its printed [γ], read from
  // the page image, after a 30° turn about the member, and its factors [γχ] and [γρ].
  const along = { x: 10, y: 5, z: 3 };
  const printed: [Vec3, Vec3, Vec3] = [
    { x: 0.8638, y: 0.4319, z: 0.2591 },
    { x: -0.5019, y: 0.7811, z: 0.3714 },
    { x: -0.042, y: -0.451, z: 0.8915 },
  ];

  it("reproduces Example 5.5's [γ] when the reference vector is its local y", () => {
    const g = rotation(along, printed[1]);
    g.forEach((row, i) => {
      for (const c of ['x', 'y', 'z'] as const) near(row[c], (printed[i] as Vec3)[c], 1.5e-4);
    });
  });

  it('with the vertical as reference, gives [γχ]·[γρ], the axes before the 30° turn', () => {
    // [γχ]·[γρ] from the printed factors cos χ = 0.9019, sin χ = 0.4319, cos ρ = 0.9578,
    // sin ρ = −0.2873: rows (cos χ cos ρ, sin χ, −cos χ sin ρ), (−sin χ cos ρ, cos χ, sin χ sin ρ),
    // (sin ρ, 0, cos ρ) = (0.8638, 0.4319, 0.2591), (−0.4137, 0.9019, −0.1241), (−0.2873, 0, 0.9578).
    const g = rotation(along, { x: 0, y: 1, z: 0 });
    const expected = [
      [0.8638, 0.4319, 0.2591],
      [-0.4137, 0.9019, -0.1241],
      [-0.2873, 0, 0.9578],
    ];
    g.forEach((row, i) => {
      [row.x, row.y, row.z].forEach((v, j) => {
        near(v, (expected[i] as number[])[j] as number, 1.5e-4);
      });
    });
  });

  it('gives orthogonal unit rows (Eqs. 5.4 and 5.5)', () => {
    const g = rotation({ x: 1, y: -2, z: 0.5 }, { x: 0, y: 0, z: 1 });
    for (const a of g)
      for (const b of g) {
        const d = a.x * b.x + a.y * b.y + a.z * b.z;
        near(d, a === b ? 1 : 0, 1e-12);
      }
  });

  it('refuses a reference vector along the member', () => {
    expect(() => rotation({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -1 })).toThrow(/parallel/);
  });
});

describe('release', () => {
  const unitAt = (i: number) => Array.from({ length: 12 }, (_, j) => (j === i ? 1 : 0));

  it('with both moments released at end 2 (Eq. 13.36) leaves 3EI/L terms about both axes', () => {
    // Pinned at end 2 about z: 3EI/L³ = 300, 3EI/L² = 30,000, 3EI/L = 3,000,000 (Eq. 13.33);
    // about y with Iy = 50: 150, 15,000, 1,500,000. Axial and torsion are untouched.
    const k = release(localStiffness3(S, L), [unitAt(10), unitAt(11)]);
    near(k.get(1, 1), 300, 1e-9);
    near(k.get(1, 5), 30_000, 1e-9);
    near(k.get(5, 5), 3_000_000, 1e-6);
    near(k.get(2, 2), 150, 1e-9);
    near(k.get(2, 4), -15_000, 1e-9);
    near(k.get(4, 4), 1_500_000, 1e-6);
    near(k.get(3, 3), 80_000, 1e-9);
    near(k.get(0, 0), 100_000, 1e-9);
    for (let j = 0; j < 12; j++) {
      near(k.get(10, j), 0, 1e-6);
      near(k.get(11, j), 0, 1e-6);
    }
  });

  it('about a global axis is the same as about the local axis it coincides with', () => {
    const member = { id: 'm', start: 'a', end: 'b', section: S, reference: { x: 0, y: 1, z: 0 } };
    const a = { id: 'a', x: 0, y: 0, z: 0 };
    const b = { id: 'b', x: 0, y: 0, z: L };
    // Along +z with reference +y: local x = +z, local y = +y, local z = x × y = −x.
    const byLocal = element3({ ...member, releases: { end: ['z'] } }, a, b).global;
    const byGlobal = element3(
      { ...member, releases: { end: [{ moment: { x: 1, y: 0, z: 0 } }] } },
      a,
      b,
    ).global;
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++) near(byGlobal.get(i, j), byLocal.get(i, j), 1e-6);
  });

  it('about an oblique axis carries no moment about it, and keeps the moment across it', () => {
    // A member along x, released at end 2 about (0, 1, 1)/√2. Turning end 2 about that axis
    // takes no moment; turning it about (0, 1, −1)/√2 still does.
    const el = element3(
      {
        id: 'm',
        start: 'a',
        end: 'b',
        section: S,
        reference: { x: 0, y: 1, z: 0 },
        releases: { end: [{ moment: { x: 0, y: 1, z: 1 } }] },
      },
      { id: 'a', x: 0, y: 0, z: 0 },
      { id: 'b', x: L, y: 0, z: 0 },
    );
    const r = Math.SQRT1_2;
    const along = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, r, r];
    const across = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, r, -r];
    const f1 = el.global.times(along);
    near((f1[10] as number) * r + (f1[11] as number) * r, 0, 1e-6);
    const f2 = el.global.times(across);
    expect(Math.abs((f2[10] as number) * r - (f2[11] as number) * r)).toBeGreaterThan(1e5);
  });

  it('of a force along the member leaves no axial stiffness', () => {
    const el = element3(
      {
        id: 'm',
        start: 'a',
        end: 'b',
        section: S,
        reference: { x: 0, y: 0, z: 1 },
        releases: { end: [{ force: { x: 2, y: 0, z: 0 } }] },
      },
      { id: 'a', x: 0, y: 0, z: 0 },
      { id: 'b', x: L, y: 0, z: 0 },
    );
    near(el.global.get(0, 0), 0, 1e-9);
    near(el.global.get(6, 6), 0, 1e-9);
    // Local y is global z here, so bending about local z (Iz = 100) moves the member along z.
    near(el.global.get(2, 2), 1200, 1e-9);
    near(el.global.get(1, 1), 600, 1e-9);
  });
});

describe('element3 in a plane', () => {
  it('gives the plane element of step 1, offsets and a release included', () => {
    // A member from (0, 0) to (80, 60) with offsets at both ends and a pin at its start, in the
    // x-y plane. With the reference vector 90° counterclockwise from the member, local z is +z,
    // so local y is the plane element's v and the 3D element's x, y, θz terms are the 2D ones.
    const plane = element(
      {
        id: 'm',
        start: 'a',
        end: 'b',
        section: { e: S.e, area: S.area, inertia: S.iz },
        releases: { start: true },
        offsets: { start: { x: 3, y: -2 }, end: { x: -1, y: 4 } },
      },
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 80, y: 60 },
    ).global;
    const dx = 80 - 1 - 3;
    const dy = 60 + 4 + 2;
    const space = element3(
      {
        id: 'm',
        start: 'a',
        end: 'b',
        section: S,
        reference: { x: -dy, y: dx, z: 0 },
        releases: { start: ['z'] },
        offsets: { start: { x: 3, y: -2, z: 0 }, end: { x: -1, y: 4, z: 0 } },
      },
      { id: 'a', x: 0, y: 0, z: 0 },
      { id: 'b', x: 80, y: 60, z: 0 },
    ).global;
    const map = [0, 1, 5, 6, 7, 11];
    map.forEach((i3, i) => {
      map.forEach((j3, j) => {
        near(space.get(i3, j3), plane.get(i, j), 1e-6 * Math.max(1, Math.abs(plane.get(i, j))));
      });
    });
  });
});

describe('torsion constant (Wood Handbook Eq. 9–11 and Figure 9–9)', () => {
  it('takes φ from the figure at its readings', () => {
    // A square, b/h = 1: J = 3.5⁴ / 6.97 = 150.0625 / 6.97 = 21.530.
    near(torsionConstant(3.5, 3.5), 150.0625 / 6.97, 1e-9);
    // A 2x6, 1.5 by 5.5: b/h = 0.272727, φ = 3.38 + 0.727273·(3.66 − 3.38) = 3.583636;
    // J = 5.5·1.5³/φ = 18.5625/3.583636 = 5.179794.
    near(torsionConstant(1.5, 5.5), 5.179794, 1e-6);
    // A thin strip tends to h·b³/3.
    near(torsionConstant(100, 1) / (100 / 3), 3 / 3.014, 1e-9);
    expect(FIGURE_9_9_PHI).toHaveLength(11);
  });

  it('gives √(G_LR·G_LT)/E_L for the Southern Pine species Table 5–1 lists', () => {
    // Loblolly √(0.082·0.081) = 0.081498; longleaf √(0.071·0.060) = 0.065269;
    // slash √(0.055·0.053) = 0.053991.
    const [loblolly, longleaf, slash] = SOUTHERN_PINE_SHEAR_RATIOS.map(shearRatio);
    near(loblolly, 0.081498, 1e-6);
    near(longleaf, 0.065269, 1e-6);
    near(slash, 0.053991, 1e-6);
  });
});
