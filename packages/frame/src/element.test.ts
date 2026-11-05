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

describe('Example 5.3 of McGuire, Gallagher and Ziemian, 2nd edition (p. 103)', () => {
  // E = 200,000 MPa. Member ab: A = 4 × 10³ mm², I = 50 × 10⁶ mm⁴, 5 m vertical. Member bc:
  // A = 6 × 10³ mm², I = 200 × 10⁶ mm⁴, 8 m long rising 3 m (sin φ = 0.375). The text prints each
  // global [k] as 200 times a matrix in kN and mm, to four or five significant figures. Here forces
  // are in N, so each printed entry is multiplied by 200 × 1,000 and compared to within one unit of
  // its last printed digit. One unit, not half: the text's 17.381 for 6EI/L²·cos φ is 18.75 × 0.927,
  // cos φ rounded to three places (7.416 m / 8 m in its figure); exactly, it is 17.3817.
  function matches(actual: number[][], printed: [number, number][][]): void {
    printed.forEach((row, i) => {
      row.forEach(([value, decimals], j) => {
        const ours = (actual[i]?.[j] ?? Number.NaN) / 200_000;
        expect(Math.abs(ours - value), `row ${i + 1}, column ${j + 1}`).toBeLessThanOrEqual(
          10 ** -decimals + 1e-12,
        );
      });
    });
  }
  // [value, decimals printed]; the text prints the upper triangle, so rows are completed by symmetry.
  const symmetric = (upper: [number, number][][]): [number, number][][] =>
    upper.map((row, i) =>
      Array.from({ length: 6 }, (_, j) =>
        j >= i ? (row[j - i] as [number, number]) : (upper[j]?.[i - j] as [number, number]),
      ),
    );

  it('member ab, vertical', () => {
    const el = element(
      { id: 'ab', start: 'a', end: 'b', section: { e: 200_000, area: 4_000, inertia: 50e6 } },
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 5_000 },
    );
    matches(
      el.global.rows(),
      symmetric([
        [
          [0.0048, 4],
          [0, 4],
          [-12, 2],
          [-0.0048, 4],
          [0, 4],
          [-12, 2],
        ],
        [
          [0.8, 3],
          [0, 4],
          [0, 4],
          [-0.8, 3],
          [0, 4],
        ],
        [
          [0.4e5, -4],
          [12, 2],
          [0, 4],
          [0.2e5, -4],
        ],
        [
          [0.0048, 4],
          [0, 4],
          [12, 2],
        ],
        [
          [0.8, 3],
          [0, 4],
        ],
        [[0.4e5, -4]],
      ]),
    );
  });

  it('member bc, sloped', () => {
    const el = element(
      { id: 'bc', start: 'b', end: 'c', section: { e: 200_000, area: 6_000, inertia: 200e6 } },
      { id: 'b', x: 0, y: 0 },
      { id: 'c', x: Math.sqrt(8_000 ** 2 - 3_000 ** 2), y: 3_000 },
    );
    matches(
      el.global.rows(),
      symmetric([
        [
          [0.6452, 4],
          [0.2591, 4],
          [-7.0313, 4],
          [-0.6452, 4],
          [-0.2591, 4],
          [-7.0313, 4],
        ],
        [
          [0.1095, 4],
          [17.381, 3],
          [-0.2591, 4],
          [-0.1095, 4],
          [17.381, 3],
        ],
        [
          [1e5, -5],
          [7.0313, 4],
          [-17.381, 3],
          [0.5e5, -4],
        ],
        [
          [0.6452, 4],
          [0.2591, 4],
          [7.0313, 4],
        ],
        [
          [0.1095, 4],
          [-17.381, 3],
        ],
        [[1e5, -5]],
      ]),
    );
  });
});

describe('rigid offsets (Section 13.5.2, Eqs. 13.38 and 13.40, pp. 400–401)', () => {
  it('gives [T]·Γᵀ·k′·Γ·[T]ᵀ with [T] written as Eq. 13.38 prints it', () => {
    // A member from offset point i to offset point j, its joints 1 and 2 off its ends. The book's
    // e_i runs from joint 1 to i, and its e_j from j to joint 2 (Example 13.8, p. 401).
    const joint1 = { id: '1', x: 0, y: 0 };
    const joint2 = { id: '2', x: 120, y: 90 };
    const start = { x: 5, y: -8 };
    const end = { x: -12, y: 6 };
    const el = element(
      {
        id: 'm',
        start: '1',
        end: '2',
        section: { e: E, area: A, inertia: I },
        offsets: { start, end },
      },
      joint1,
      joint2,
    );
    // The member runs from (5, −8) to (108, 96).
    expect(el.geometry.length).toBeCloseTo(Math.hypot(103, 104), 12);
    const [exi, eyi] = [start.x, start.y];
    const [exj, eyj] = [-end.x, -end.y];
    const T = [
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [-eyi, exi, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 1, 0],
      [0, 0, 0, eyj, -exj, 1],
    ];
    const plain = el.local.congruent(el.gamma);
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        let sum = 0;
        for (let a = 0; a < 6; a++)
          for (let b = 0; b < 6; b++)
            sum += (T[r]?.[a] as number) * plain.get(a, b) * (T[c]?.[b] as number);
        expect(el.global.get(r, c)).toBeCloseTo(sum, 6);
      }
  });

  it('is the plain element with no offsets', () => {
    const plain = element(
      { id: 'm', start: 'a', end: 'b', section: { e: E, area: A, inertia: I } },
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 60, y: 80 },
    );
    expect(plain.global.rows()).toEqual(plain.local.congruent(plain.gamma).rows());
  });
});
