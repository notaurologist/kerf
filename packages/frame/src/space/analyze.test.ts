import { swingSetAFrame } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { type AFrameInputs, aFrameAnalysis, buildFrame, frameGeometry } from '../aFrame.ts';
import { analyze } from '../analyze.ts';
import type { Frame, Section } from '../model.ts';
import { analyze3 } from './analyze.ts';
import type { Frame3, Member3, Release, Section3, Support3 } from './model.ts';

const near = (actual: number | null | undefined, expected: number, within: number) => {
  expect(actual).toBeDefined();
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(within);
};

function solved(frame: Frame3) {
  const a = analyze3(frame);
  if (a.kind !== 'solved') throw new Error(a.message);
  return a;
}

describe('L-shaped space cantilever', () => {
  // ab along x, a = 100, fixed at a; bc along y, b = 100, rigidly joined at b; P = 300 lb down
  // (−z) at c. Both members: E = 1,000,000, I = 100 about both axes, G = 400,000, J = 50.
  // bc is a cantilever from b: P·b³/3EI = 300·10⁶ / (3·10⁸) = 1.0 in.
  // ab carries P at its tip: P·a³/3EI = 1.0 in.
  // ab carries the torque P·b = 30,000 in-lb: it twists P·b·a/GJ = 3·10⁶/(2·10⁷) = 0.15 rad,
  // which drops c by 0.15·b = 15 in. Its tip slope P·a²/2EI = 0.015 rad turns bc as a rigid body
  // about y, which moves c along x only.
  // Total at c: 1 + 1 + 15 = 17 in down. Reactions at a: Fz = 300, and −r × F with r = (100, 100,
  // 0), F = (0, 0, −300): Mx = 30,000, My = −30,000.
  const s: Section3 = { e: 1_000_000, g: 400_000, area: 1e6, iy: 100, iz: 100, j: 50 };
  const frame: Frame3 = {
    joints: [
      { id: 'a', x: 0, y: 0, z: 0 },
      { id: 'b', x: 100, y: 0, z: 0 },
      { id: 'c', x: 100, y: 100, z: 0 },
    ],
    members: [
      { id: 'ab', start: 'a', end: 'b', section: s, reference: { x: 0, y: 0, z: 1 } },
      { id: 'bc', start: 'b', end: 'c', section: s, reference: { x: 0, y: 0, z: 1 } },
    ],
    supports: { a: { kind: 'fixed' } },
    loads: [{ joint: 'c', fz: -300 }],
  };
  // Axial shortening is negligible with A = 10⁶ in².
  const tol = 1e-6;

  it('drops the tip by bending in both members and twist in the first', () => {
    const { displacements } = solved(frame);
    near(displacements.c?.z, -17, tol);
    // b: P·a³/3EI down, twisted 0.15 rad about x, and sloped P·a²/2EI.
    near(displacements.b?.z, -1, tol);
    near(displacements.b?.rotation?.x, -0.15, tol);
    near(displacements.b?.rotation?.y, 0.015, tol);
  });

  it('gives the reactions and the torque in the first member', () => {
    const { reactions, memberForces } = solved(frame);
    near(reactions.a?.fz, 300, tol);
    near(reactions.a?.mx, 30_000, tol);
    near(reactions.a?.my, -30_000, tol);
    near(reactions.a?.fx, 0, tol);
    near(Math.abs(memberForces.ab?.start.torsion ?? 0), 30_000, tol);
    near(memberForces.bc?.start.torsion, 0, tol);
  });

  it('with the joint at b pinned about x, cannot hold the tip', () => {
    // bc then turns freely about ab's axis: nothing holds c from dropping.
    const pinned: Frame3 = {
      ...frame,
      members: frame.members.map((m) =>
        m.id === 'bc' ? { ...m, releases: { start: [{ moment: { x: 1, y: 0, z: 0 } }] } } : m,
      ),
    };
    expect(analyze3(pinned).kind).toBe('mechanism');
  });
});

describe('a portal frame standing in the x-z plane', () => {
  // Step 1's portal (analyze.test.ts): h = 100, L = 200, I_b/L = I_c/h, 1,000 lb along the beam,
  // fixed bases, now in the x-z plane with bending about global y: sway 25/42 in, base moments
  // 200,000/7 in-lb. The out-of-plane stiffness is real here, so nothing else needs holding.
  // Columns run along z with reference +x, so local y is along x; the beam runs along x with
  // reference +z. Either way bending in the x-z plane is about local z, so I_c and I_b go in iz.
  const column: Section3 = { e: 1_000_000, g: 400_000, area: 1e6, iy: 300, iz: 100, j: 200 };
  const beam: Section3 = { ...column, iy: 600, iz: 200 };
  const frame: Frame3 = {
    joints: [
      { id: 'a', x: 0, y: 0, z: 0 },
      { id: 'b', x: 0, y: 0, z: 100 },
      { id: 'c', x: 200, y: 0, z: 100 },
      { id: 'd', x: 200, y: 0, z: 0 },
    ],
    members: [
      { id: 'left', start: 'a', end: 'b', section: column, reference: { x: 1, y: 0, z: 0 } },
      { id: 'beam', start: 'b', end: 'c', section: beam, reference: { x: 0, y: 0, z: 1 } },
      { id: 'right', start: 'd', end: 'c', section: column, reference: { x: 1, y: 0, z: 0 } },
    ],
    supports: { a: { kind: 'fixed' }, d: { kind: 'fixed' } },
    loads: [{ joint: 'b', fx: 1_000 }],
  };

  it('sways 25/42 in with base moments 200,000/7 in-lb', () => {
    const { displacements, reactions } = solved(frame);
    near(displacements.b?.x, 25 / 42, 1e-6);
    near(displacements.c?.x, 25 / 42, 1e-6);
    near(displacements.b?.y, 0, 1e-12);
    // Relative 10⁻⁶, as in step 1: axial shortening is what the closed form leaves out.
    near(Math.abs(reactions.a?.my ?? 0), 200_000 / 7, (200_000 / 7) * 1e-6);
    near(reactions.a?.fx, -500, 500 * 1e-6);
  });
});

// A plane frame in the x-y plane as a space frame: each member's local z along global z, the
// out-of-plane degrees of freedom held at every joint, so only the plane's own remain.
function toSpace(frame: Frame): Frame3 {
  const at = new Map(frame.joints.map((j) => [j.id, j]));
  const section = (s: Section): Section3 => ({
    e: s.e,
    g: s.e,
    area: s.area,
    iz: s.inertia,
    iy: s.inertia,
    j: s.inertia,
  });
  const plane = (held: { x: boolean; y: boolean; rotation: boolean }): Support3 => ({
    kind: 'restraints',
    x: held.x,
    y: held.y,
    z: true,
    rx: true,
    ry: true,
    rz: held.rotation,
  });
  const supports: Record<string, Support3> = {};
  for (const j of frame.joints) {
    const s = frame.supports[j.id];
    supports[j.id] = plane(
      s === undefined
        ? { x: false, y: false, rotation: false }
        : s.kind === 'fixed'
          ? { x: true, y: true, rotation: true }
          : s.kind === 'pinned'
            ? { x: true, y: true, rotation: false }
            : s.kind === 'roller'
              ? { x: s.restrains === 'x', y: s.restrains === 'y', rotation: false }
              : { x: s.x, y: s.y, rotation: s.rotation },
    );
  }
  const members: Member3[] = frame.members.map((m) => {
    const a = at.get(m.start);
    const b = at.get(m.end);
    if (!a || !b) throw new Error('joint');
    const s = m.offsets?.start ?? { x: 0, y: 0 };
    const t = m.offsets?.end ?? { x: 0, y: 0 };
    const dx = b.x + t.x - (a.x + s.x);
    const dy = b.y + t.y - (a.y + s.y);
    const rel = (on?: boolean): Release[] => (on ? ['z'] : []);
    return {
      id: m.id,
      start: m.start,
      end: m.end,
      section: section(m.section),
      reference: { x: -dy, y: dx, z: 0 },
      releases: { start: rel(m.releases?.start), end: rel(m.releases?.end) },
      offsets: {
        start: { x: s.x, y: s.y, z: 0 },
        end: { x: t.x, y: t.y, z: 0 },
      },
    };
  });
  return {
    joints: frame.joints.map((j) => ({ id: j.id, x: j.x, y: j.y, z: 0 })),
    members,
    supports,
    loads: frame.loads.map((l) => ({ joint: l.joint, fx: l.fx, fy: l.fy, mz: l.moment })),
  };
}

describe('a plane frame through the space frame analysis', () => {
  // Step 2's A-frames for the worked example, every load, support, and joint case: the space
  // analysis of the same frame gives step 2's displacements, reactions, and member forces.
  const inputs: AFrameInputs = {
    riderWeights: [200, 80],
    maxSwingAngle: 60,
    dynamicFactor: 2,
    beamSpeciesGrade: 'southern-pine-no2',
    beamMoistureContent: 30,
    legSpeciesGrade: 'southern-pine-no2',
    legIncised: false,
    crossbarSpeciesGrade: 'southern-pine-no2',
    crossbarIncised: false,
    gussetSpeciesGrade: 'southern-pine-no2',
    gussetIncised: false,
  };

  for (const burialDepth of [24, 0]) {
    it(`agrees with step 2 for every case, burial depth ${burialDepth}`, () => {
      const made = swingSetAFrame.generate({ ...swingSetAFrame.WORKED_EXAMPLE, burialDepth });
      if (!made.ok) throw new Error('plan');
      const report = aFrameAnalysis(made.output, inputs);
      if (report.status !== 'computed') throw new Error('report');
      const g = frameGeometry(made.output, 0);
      let compared = 0;
      for (const c of report.cases.filter((x) => x.frame === 'left')) {
        if (c.analysis.kind !== 'solved') continue;
        const supports = c.supports.startsWith('Both feet fixed')
          ? { back: { kind: 'fixed' as const }, front: { kind: 'fixed' as const } }
          : c.supports.startsWith('Both feet pinned')
            ? { back: { kind: 'pinned' as const }, front: { kind: 'pinned' as const } }
            : c.supports.includes('back foot')
              ? {
                  back: { kind: 'roller' as const, restrains: 'y' as const },
                  front: { kind: 'pinned' as const },
                }
              : {
                  front: { kind: 'roller' as const, restrains: 'y' as const },
                  back: { kind: 'pinned' as const },
                };
        const frame = buildFrame(g, report.sections, c.joints, supports, c.applied);
        const plane = analyze(frame);
        const space = analyze3(toSpace(frame));
        if (plane.kind !== 'solved' || space.kind !== 'solved') throw new Error('mechanism');
        // The same frame as step 2 reported.
        near(plane.displacements.top?.x, c.analysis.displacements.top?.x ?? 0, 1e-12);
        for (const [id, d] of Object.entries(plane.displacements)) {
          const s = space.displacements[id];
          near(s?.x, d.x, 1e-9);
          near(s?.y, d.y, 1e-9);
          if (d.rotation !== null) near(s?.rotation?.z, d.rotation, 1e-11);
        }
        for (const [id, r] of Object.entries(plane.reactions)) {
          near(space.reactions[id]?.fx, r.fx, 1e-6);
          near(space.reactions[id]?.fy, r.fy, 1e-6);
          near(space.reactions[id]?.mz, r.moment, 1e-5);
        }
        for (const [id, f] of Object.entries(plane.memberForces)) {
          const s = space.memberForces[id];
          near(s?.start.axial, f.start.axial, 1e-6);
          near(s?.start.vy, f.start.shear, 1e-6);
          near(s?.start.mz, f.start.moment, 1e-5);
          near(s?.end.mz, f.end.moment, 1e-5);
        }
        compared++;
      }
      expect(compared).toBe(burialDepth > 0 ? 6 : 10);
    });
  }
});
