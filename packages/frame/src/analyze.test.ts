import { describe, expect, it } from 'vitest';
import { type Analysis, analyze } from './analyze.ts';
import type { Frame, Section } from './model.ts';

// Every example uses E = 1,000,000 psi and round lengths so the closed-form answers can be worked
// on paper; the working is in each test's comments.
const E = 1_000_000;
const SECTION: Section = { e: E, area: 10, inertia: 100 };

function solved(frame: Frame) {
  const result: Analysis = analyze(frame);
  if (result.kind !== 'solved') throw new Error(result.message);
  return result;
}

/** Within a relative tolerance of the closed-form value, or an absolute one near zero. */
function close(actual: number | null | undefined, expected: number, tolerance = 1e-9): void {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(
    tolerance * Math.max(1, Math.abs(expected)),
  );
}

describe('cantilever with an end load', () => {
  // L = 100 in, I = 100 in⁴, A = 10 in², P = 300 lb down and H = 1,000 lb along the member.
  // Tip deflection PL³/(3EI) = 300 × 1,000,000 / 300,000,000 = 1.0 in.
  // Tip rotation PL²/(2EI) = 300 × 10,000 / 200,000,000 = 0.015 rad, clockwise.
  // Axial stretch HL/(EA) = 1,000 × 100 / 10,000,000 = 0.01 in.
  // Fixed-end moment PL = 30,000 in-lb.
  const frame: Frame = {
    joints: [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 100, y: 0 },
    ],
    members: [{ id: 'm', start: 'a', end: 'b', section: SECTION }],
    supports: { a: { kind: 'fixed' } },
    loads: [{ joint: 'b', fx: 1_000, fy: -300 }],
  };

  it('gives the tip deflection, rotation, and stretch', () => {
    const { displacements } = solved(frame);
    close(displacements.b?.x, 0.01);
    close(displacements.b?.y, -1.0);
    close(displacements.b?.rotation, -0.015);
    expect(displacements.a).toEqual({ x: 0, y: 0, rotation: 0 });
  });

  it('gives the support reactions', () => {
    const { reactions } = solved(frame);
    close(reactions.a?.fx, -1_000);
    close(reactions.a?.fy, 300);
    close(reactions.a?.moment, 30_000);
    expect(Object.keys(reactions)).toEqual(['a']);
  });

  it('gives the member end forces in local axes', () => {
    const { memberForces } = solved(frame);
    const m = memberForces.m;
    close(m?.start.axial, -1_000);
    close(m?.start.shear, 300);
    close(m?.start.moment, 30_000);
    close(m?.end.axial, 1_000);
    close(m?.end.shear, -300);
    close(m?.end.moment, 0);
  });

  it('gives the same answers standing up, through the transformation to global axes', () => {
    // The same member as a leg from (0, 0) to (0, 100), pushed sideways by 300 lb at the top.
    // Its top moves 1.0 in along +x and turns 0.015 rad clockwise.
    const { displacements, reactions, memberForces } = solved({
      joints: [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 0, y: 100 },
      ],
      members: [{ id: 'leg', start: 'a', end: 'b', section: SECTION }],
      supports: { a: { kind: 'fixed' } },
      loads: [{ joint: 'b', fx: 300, fy: -1_000 }],
    });
    close(displacements.b?.x, 1.0);
    close(displacements.b?.y, -0.01);
    close(displacements.b?.rotation, -0.015);
    close(reactions.a?.fx, -300);
    close(reactions.a?.fy, 1_000);
    close(reactions.a?.moment, 30_000);
    // Local y points to global −x on a member along +y: the base pushes back with +300 lb in −x.
    close(memberForces.leg?.start.shear, 300);
    close(memberForces.leg?.start.axial, 1_000);
  });
});

describe('propped cantilever with a center load', () => {
  // Fixed at a, held up by a roller at b, L = 100 in, P = 1,600 lb down at midspan (joint m).
  // Roller reaction 5P/16 = 500 lb; fixed-end reaction 11P/16 = 1,100 lb.
  // Fixed-end moment 3PL/16 = 30,000 in-lb.
  // Midspan deflection 7PL³/(768EI) = 7 × 1,600 × 1,000,000 / 76,800,000,000 = 0.1458333… in.
  // Rotation at the roller PL²/(32EI) = 1,600 × 10,000 / 3,200,000,000 = 0.005 rad.
  // (Superposition on a simple beam: PL²/16EI less the end moment's ML/6EI; PL³/48EI less ML²/16EI.)
  const joints = [
    { id: 'a', x: 0, y: 0 },
    { id: 'm', x: 50, y: 0 },
    { id: 'b', x: 100, y: 0 },
  ];
  const loads = [{ joint: 'm', fy: -1_600 }];

  it('with a roller at the far end', () => {
    const { displacements, reactions } = solved({
      joints,
      members: [
        { id: 'left', start: 'a', end: 'm', section: SECTION },
        { id: 'right', start: 'm', end: 'b', section: SECTION },
      ],
      supports: { a: { kind: 'fixed' }, b: { kind: 'roller', restrains: 'y' } },
      loads,
    });
    close(reactions.b?.fy, 500);
    close(reactions.b?.fx, 0);
    close(reactions.a?.fy, 1_100);
    close(reactions.a?.moment, 30_000);
    close(displacements.m?.y, -7 / 48);
    close(displacements.b?.rotation, 0.005);
  });

  it('with a fixed support and the member released at it, as a pinned joint', () => {
    const { displacements, reactions, memberForces } = solved({
      joints,
      members: [
        { id: 'left', start: 'a', end: 'm', section: SECTION },
        { id: 'right', start: 'm', end: 'b', section: SECTION, releases: { end: true } },
      ],
      supports: {
        a: { kind: 'fixed' },
        b: { kind: 'restraints', x: false, y: true, rotation: true },
      },
      loads,
    });
    close(reactions.b?.fy, 500);
    close(reactions.b?.moment, 0);
    close(reactions.a?.moment, 30_000);
    close(displacements.m?.y, -7 / 48);
    close(memberForces.right?.end.moment, 0);
    // Midspan moment: 500 lb × 50 in = 25,000 in-lb, sagging.
    close(memberForces.right?.start.moment, -25_000);
  });
});

describe('internal hinge', () => {
  // Two 50 in cantilevers fixed at a and c and pinned to each other at h, 1,600 lb down at h.
  // By symmetry each carries 800 lb: deflection 800 × 50³ / (3EI) = 1/3 in.
  const joints = [
    { id: 'a', x: 0, y: 0 },
    { id: 'h', x: 50, y: 0 },
    { id: 'c', x: 100, y: 0 },
  ];
  const supports = { a: { kind: 'fixed' }, c: { kind: 'fixed' } } as const;

  it('released on both members, the hinge has no rotation of its own', () => {
    const { displacements, reactions } = solved({
      joints,
      members: [
        { id: 'left', start: 'a', end: 'h', section: SECTION, releases: { end: true } },
        { id: 'right', start: 'h', end: 'c', section: SECTION, releases: { start: true } },
      ],
      supports,
      loads: [{ joint: 'h', fy: -1_600 }],
    });
    close(displacements.h?.y, -1 / 3);
    expect(displacements.h?.rotation).toBeNull();
    close(reactions.a?.fy, 800);
    close(reactions.a?.moment, 40_000);
    close(reactions.c?.moment, -40_000);
  });

  it('released on one member, the joint turns with the other', () => {
    // The right cantilever's tip turns P·L²/(2EI) = 800 × 2,500 / 200,000,000 = 0.01 rad,
    // counterclockwise, since its free end is the low one.
    const { displacements } = solved({
      joints,
      members: [
        { id: 'left', start: 'a', end: 'h', section: SECTION, releases: { end: true } },
        { id: 'right', start: 'h', end: 'c', section: SECTION },
      ],
      supports,
      loads: [{ joint: 'h', fy: -1_600 }],
    });
    close(displacements.h?.y, -1 / 3);
    close(displacements.h?.rotation, 0.01);
  });
});

describe('portal frame with a lateral load', () => {
  // Fixed bases a and d, columns h = 100 in with I_c = 100 in⁴, beam L = 200 in with I_b = 200 in⁴,
  // H = 1,000 lb to the right at b. Area is made large so axial shortening is negligible, as the
  // closed form assumes. Slope-deflection with joint rotation θ (the same at b and c) and chord
  // rotation ψ = Δ/h, writing a = EI_c/h and b = EI_b/L, and k = b/a = 1 here:
  //   joint b:   2a(2θ − 3ψ) + 6bθ = 0, so θ = 3aψ / (2a + 3b)
  //   shear:     2 × (2a/h)(6ψ − 3θ) = H
  //   sway       Δ = H·h³·(2 + 3k) / (12·E·I_c·(1 + 6k)) = 10⁹ × 5 / (1.2 × 10⁹ × 7) = 25/42 in
  //   base       M = (H·h/2)(1 + 3k)/(1 + 6k) = 50,000 × 4/7 = 200,000/7 in-lb
  //   top        M = (H·h/2)(3k)/(1 + 6k) = 50,000 × 3/7 = 150,000/7 in-lb
  //   vertical   R = 2·M_top/L = 1,500/7 lb, down at a and up at d
  // Checks at the limits: k → ∞ gives Hh³/(24EI) and Hh/4 at both ends of each column (fixed-guided
  // columns); k → 0 gives Hh³/(6EI) and Hh/2 at the base (two cantilevers).
  const column: Section = { e: E, area: 1e6, inertia: 100 };
  const beam: Section = { e: E, area: 1e6, inertia: 200 };
  const frame: Frame = {
    joints: [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 100 },
      { id: 'c', x: 200, y: 100 },
      { id: 'd', x: 200, y: 0 },
    ],
    members: [
      { id: 'left', start: 'a', end: 'b', section: column },
      { id: 'beam', start: 'b', end: 'c', section: beam },
      { id: 'right', start: 'd', end: 'c', section: column },
    ],
    supports: { a: { kind: 'fixed' }, d: { kind: 'fixed' } },
    loads: [{ joint: 'b', fx: 1_000 }],
  };
  // Axial shortening, about 10⁻⁸ of the sway, is what remains of the closed form's assumption.
  const tolerance = 1e-6;

  it('gives the sway', () => {
    const { displacements } = solved(frame);
    close(displacements.b?.x, 25 / 42, tolerance);
    close(displacements.c?.x, 25 / 42, tolerance);
    // θ = 3aψ/(2a + 3b) = 3ψ/5 with ψ = Δ/h, clockwise.
    close(displacements.b?.rotation, -(3 / 5) * (25 / 42 / 100), tolerance);
  });

  it('gives the base reactions', () => {
    const { reactions } = solved(frame);
    close(reactions.a?.fx, -500, tolerance);
    close(reactions.d?.fx, -500, tolerance);
    close(reactions.a?.fy, -1_500 / 7, tolerance);
    close(reactions.d?.fy, 1_500 / 7, tolerance);
    close(reactions.a?.moment, 200_000 / 7, tolerance);
    close(reactions.d?.moment, 200_000 / 7, tolerance);
  });

  it('gives the beam end moments, and the reactions balance the load', () => {
    const { reactions, memberForces } = solved(frame);
    // Both joints turn clockwise and apply clockwise moments to the beam at its ends.
    close(memberForces.beam?.start.moment, -150_000 / 7, tolerance);
    close(memberForces.beam?.end.moment, -150_000 / 7, tolerance);
    const sum = Object.values(reactions).reduce((s, r) => ({ fx: s.fx + r.fx, fy: s.fy + r.fy }), {
      fx: 0,
      fy: 0,
    });
    close(sum.fx, -1_000);
    close(sum.fy, 0);
  });

  it('with pinned bases and a pinned beam, reports a mechanism instead of numbers', () => {
    const result = analyze({
      ...frame,
      members: frame.members.map((m) =>
        m.id === 'beam' ? { ...m, releases: { start: true, end: true } } : m,
      ),
      supports: { a: { kind: 'pinned' }, d: { kind: 'pinned' } },
    });
    expect(result.kind).toBe('mechanism');
  });
});

describe('mechanisms and input errors', () => {
  const beam = (supports: Frame['supports'], loads: Frame['loads'] = []): Frame => ({
    joints: [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 100, y: 0 },
    ],
    members: [{ id: 'm', start: 'a', end: 'b', section: SECTION }],
    supports,
    loads,
  });

  it('a beam on two vertical rollers can slide sideways', () => {
    // a's x is held by the member's axial stiffness until a is eliminated; then nothing holds b.
    const result = analyze(
      beam({ a: { kind: 'roller', restrains: 'y' }, b: { kind: 'roller', restrains: 'y' } }),
    );
    expect(result).toMatchObject({ kind: 'mechanism', joint: 'b', direction: 'x' });
  });

  it('a joint with no members and no support is a mechanism', () => {
    const result = analyze({
      ...beam({ a: { kind: 'fixed' } }),
      joints: [...beam({}).joints, { id: 'loose', x: 0, y: 50 }],
    });
    expect(result).toMatchObject({ kind: 'mechanism', joint: 'loose', direction: 'x' });
  });

  it('a moment on a joint whose every member is released has nothing to resist it', () => {
    const result = analyze({
      joints: [
        { id: 'a', x: 0, y: 0 },
        { id: 'h', x: 50, y: 0 },
        { id: 'c', x: 100, y: 0 },
      ],
      members: [
        { id: 'left', start: 'a', end: 'h', section: SECTION, releases: { end: true } },
        { id: 'right', start: 'h', end: 'c', section: SECTION, releases: { start: true } },
      ],
      supports: { a: { kind: 'fixed' }, c: { kind: 'fixed' } },
      loads: [{ joint: 'h', moment: 1_000 }],
    });
    expect(result).toMatchObject({ kind: 'mechanism', joint: 'h', direction: 'rotation' });
  });

  it('refuses a member, support, or load naming a joint that is not there', () => {
    expect(() => analyze(beam({ z: { kind: 'fixed' } }))).toThrow('joint z');
    expect(() => analyze(beam({ a: { kind: 'fixed' } }, [{ joint: 'z', fy: 1 }]))).toThrow(
      'joint z',
    );
    expect(() =>
      analyze({
        ...beam({ a: { kind: 'fixed' } }),
        members: [{ id: 'm', start: 'a', end: 'z', section: SECTION }],
      }),
    ).toThrow('joint z');
  });
});
