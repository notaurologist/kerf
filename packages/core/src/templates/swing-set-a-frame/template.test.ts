import { describe, expect, it } from 'vitest';
import type { Part } from '../../model/types.ts';
import type { SwingSetParams } from './params.ts';
import { generate, type SwingSetOutput } from './template.ts';

// Worked example from docs/templates/swing-set-a-frame.md. Expected values are the spec's
// hand-checked numbers, so a change here means the spec changes too.
const example: SwingSetParams = {
  beamLength: 120,
  beamHeight: 96,
  splay: { kind: 'angle', degrees: 20 },
  beamStock: '4x6',
  beamPlies: 1,
  legStock: '4x4',
  crossbarStock: '2x6',
  crossbarHeight: 40,
  gussetStock: '2x8',
  frameInset: 12,
  groundSlope: 1,
  burialDepth: 24,
  swings: { centers: [40, 80], hangerSpacing: 20, seatWidth: 20, seatHeight: 16 },
  hardware: {
    legBoltDiameter: 0.5,
    crossbarBolts: { diameter: 0.5, perJoint: 2 },
    gussetBolts: { diameter: 0.5, perJoint: 2 },
  },
};

const pads: SwingSetParams = {
  ...example,
  burialDepth: 0,
  hardware: { ...example.hardware, anchorsPerFoot: 1 },
};

function run(params: unknown): SwingSetOutput {
  const result = generate(params);
  if (!result.ok) throw new Error(`Expected success: ${JSON.stringify(result.issues)}`);
  return result.output;
}

function issueCodes(params: unknown): string[] {
  const result = generate(params);
  if (result.ok) throw new Error('Expected issues');
  return result.issues.map((issue) => issue.code);
}

function part(output: SwingSetOutput, id: string): Part {
  const found = output.parts.find((p) => p.id === id);
  if (!found) throw new Error(`No part ${id}`);
  return found;
}

describe('worked example, buried legs', () => {
  const { geometry: g } = run(example);

  it('matches the flush cut and bolt', () => {
    expect(g.flushCut.depthAtTop).toBeCloseTo(1.881, 3);
    expect(g.flushCut.woodLeftAtTop).toBeCloseTo(1.619, 3);
    expect(g.flushCut.woodLeftAtBolt).toBeCloseTo(2.559, 3);
    expect(g.flushCut.lengthAlongLeg).toBeCloseTo(5.168, 3);
    expect(g.boltGrip).toBeCloseTo(8.947, 3);
  });

  it('matches the back (uphill) legs', () => {
    expect(g.back.groundZ).toBeCloseTo(3.118, 3);
    expect(g.back.footZ).toBeCloseTo(-20.882, 3);
    expect(g.back.edgeLength).toBeCloseTo(130.236, 3);
    expect(g.back.overallLength).toBeCloseTo(131.51, 3);
    expect(g.back.belowGrade).toBeCloseTo(25.54, 3);
  });

  it('matches the front (downhill) legs', () => {
    expect(g.front.groundZ).toBeCloseTo(-3.313, 3);
    expect(g.front.footZ).toBeCloseTo(-27.313, 3);
    expect(g.front.edgeLength).toBeCloseTo(137.08, 3);
    expect(g.front.overallLength).toBeCloseTo(138.354, 3);
  });

  it('matches the footprint, crossbar, and gusset', () => {
    expect(g.back.outerAtGrade).toBeCloseTo(39.226, 3);
    expect(g.front.outerAtGrade).toBeCloseTo(41.68, 3);
    expect(g.footprintDepth).toBeCloseTo(80.906, 3);
    // Each board runs 7D − w / (2·cos α) = 3.5 − 1.862 = 1.638 past each leg (spec, Bolt layout).
    expect(g.crossbar.pastLeg).toBeCloseTo(1.638, 3);
    expect(g.crossbar.topEdge).toBeCloseTo(54.989, 3);
    expect(g.crossbar.bottomEdge).toBeCloseTo(58.993, 3);
    expect(g.gusset.topWidth).toBeCloseTo(14.225, 3);
    expect(g.gusset.bottomWidth).toBeCloseTo(19.502, 3);
    expect(g.gusset.height).toBe(7.25);
  });

  it('puts the supports at the frame centerlines', () => {
    expect(g.supportsX).toEqual([13.75, 106.25]);
  });
});

describe('worked example, pads', () => {
  const { geometry: g } = run(pads);

  it('matches the leg lengths', () => {
    expect(g.back.overallLength).toBeCloseTo(105.97, 3);
    expect(g.front.overallLength).toBeCloseTo(112.814, 3);
    expect(g.back.belowGrade).toBe(0);
  });
});

describe('fit', () => {
  // Rebuild each leg the way it is built: a board of the generated length with level cuts at
  // the generated angle, stood at the splay with its inner face against the beam's lower corner
  // and its top cut at the top of the beam. Then check where it actually lands. This uses the
  // part outputs, not the formulas that produced them.
  const RAD = Math.PI / 180;
  const H = 96;
  const bw = 3.5;
  const bd = 5.5;
  const w = 3.5;

  function placedLeg(output: SwingSetOutput, side: 'back' | 'front') {
    const legPart = part(output, `leg-${side}`);
    const a = legPart.ends[0].setting * RAD;
    const sign = side === 'back' ? 1 : -1;
    const down = { y: sign * Math.sin(a), z: -Math.cos(a) };
    const across = { y: sign * Math.cos(a), z: Math.sin(a) }; // inner face to outer face
    const edge = legPart.markLengths[0]?.value ?? Number.NaN;
    const along = (p: { y: number; z: number }, d: { y: number; z: number }, s: number) => ({
      y: p.y + d.y * s,
      z: p.z + d.z * s,
    });
    const innerTop = along({ y: sign * (bw / 2), z: H }, down, -bd / Math.cos(a));
    const outerTop = along(along(innerTop, across, w), down, w * Math.tan(a));
    const innerFoot = along(innerTop, down, edge);
    const outerFoot = along(outerTop, down, edge);
    return { legPart, a, sign, down, across, innerTop, outerTop, innerFoot, outerFoot };
  }

  /** Where a line from `p` along `d` meets the ground z = k·y, found by bisection. */
  function meetGround(p: { y: number; z: number }, d: { y: number; z: number }, k: number) {
    const above = (s: number) => p.z + d.z * s - k * (p.y + d.y * s);
    let lo = 0;
    let hi = 400;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (above(mid) > 0) lo = mid;
      else hi = mid;
    }
    return { y: p.y + d.y * lo, z: p.z + d.z * lo };
  }

  for (const burialDepth of [24, 0]) {
    for (const side of ['back', 'front'] as const) {
      it(`${side} leg, burial ${burialDepth}: cuts are level and the foot lands at the right depth`, () => {
        const output = run(burialDepth === 0 ? pads : { ...example, burialDepth });
        const leg = placedLeg(output, side);
        const k = 1 / 12;

        // Top cut level at the top of the beam; both foot corners at the same height.
        expect(leg.outerTop.z).toBeCloseTo(H + bd, 9);
        expect(leg.outerFoot.z).toBeCloseTo(leg.innerFoot.z, 9);

        // Long point to long point matches the stock length on the cut list.
        const overall =
          (leg.outerFoot.y - leg.innerTop.y) * leg.down.y +
          (leg.outerFoot.z - leg.innerTop.z) * leg.down.z;
        expect(overall).toBeCloseTo(leg.legPart.length, 9);

        // The centerline meets the sloping ground exactly burialDepth above the foot cut.
        const centerTop = {
          y: (leg.innerTop.y + leg.outerTop.y) / 2,
          z: (leg.innerTop.z + leg.outerTop.z) / 2,
        };
        const grade = meetGround(centerTop, leg.down, k);
        expect(leg.innerFoot.z).toBeCloseTo(grade.z - burialDepth, 6);

        // The outer face meets the ground where the layout says to mark it.
        const outerGrade = meetGround(leg.outerTop, leg.down, k);
        expect(Math.abs(outerGrade.y)).toBeCloseTo(output.geometry[side].outerAtGrade, 6);
      });
    }
  }

  it("crossbar and gusset ends run the same distance past the legs' outer faces", () => {
    const output = run(example);
    const leg = placedLeg(output, 'back');
    const outerAt = (z: number) => {
      const s = (leg.outerTop.z - z) / -leg.down.z;
      return leg.outerTop.y + leg.down.y * s;
    };
    const past = output.geometry.crossbar.pastLeg ?? 0;
    expect(past).toBeGreaterThan(0);
    expect(output.geometry.gusset.pastLeg).toBe(past);
    const crossbar = part(output, 'crossbar');
    expect(crossbar.length).toBeCloseTo(2 * (outerAt(40 - 5.5) + past), 9);
    expect(crossbar.markLengths[0]?.value).toBeCloseTo(2 * (outerAt(40) + past), 9);
    const gusset = part(output, 'gusset');
    expect(gusset.markLengths[0]?.value).toBeCloseTo(2 * (outerAt(H) + past), 9);
    expect(gusset.length).toBeCloseTo(2 * (outerAt(H - 7.25) + past), 9);
  });
});

describe('swings and layout', () => {
  // Spec, Swings and layout.
  const output = run(example);

  it('places the hangers and gives the chain length', () => {
    expect(output.swings.hangersX).toEqual([30, 50, 70, 90]);
    expect(output.swings.seats).toEqual([
      { xMin: 30, xMax: 50 },
      { xMin: 70, xMax: 90 },
    ]);
    expect(output.swings.chainLength).toBe(80);
  });

  it('draws the footprint, clear area, and swing zones', () => {
    const { footprint, clearArea, swingZones } = output.layout;
    expect(footprint.xMin).toBe(0);
    expect(footprint.xMax).toBe(120);
    expect(footprint.yMin).toBeCloseTo(-41.68, 3);
    expect(footprint.yMax).toBeCloseTo(39.226, 3);
    expect(clearArea.xMin).toBe(-72);
    expect(clearArea.xMax).toBe(192);
    expect(clearArea.yMin).toBeCloseTo(-113.68, 3);
    expect(clearArea.yMax).toBeCloseTo(111.226, 3);
    expect(swingZones.map((z) => [z.xMin, z.xMax, z.yMin, z.yMax])).toEqual([
      [30, 50, -192, 192],
      [70, 90, -192, 192],
    ]);
    expect(clearArea.source).toContain('Pub. 324');
  });

  const withSwings = (swings: Partial<SwingSetParams['swings']>) => ({
    ...example,
    swings: { ...example.swings, ...swings },
  });

  it('accepts seats exactly 8 inches from each other and the frame', () => {
    // Inside faces at 15.5 and 104.5. Seats 20 wide at 33.5 and 86.5 span 23.5-43.5 and
    // 76.5-96.5: exactly 8 from each frame, 33 apart.
    expect(generate(withSwings({ centers: [33.5, 86.5] })).ok).toBe(true);
    // Seats 20 wide at 50 and 78: edges 40-60 and 68-88, exactly 8 apart.
    expect(generate(withSwings({ centers: [50, 78] })).ok).toBe(true);
  });

  it('rejects seats closer than 8 inches to the frame or each other', () => {
    expect(issueCodes(withSwings({ centers: [33.4, 86.5] }))).toEqual(['seat-too-close-to-frame']);
    expect(issueCodes(withSwings({ centers: [50, 77.9] }))).toEqual(['seats-too-close']);
  });

  it('rejects overlapping swings and hangers outside the frames', () => {
    expect(issueCodes(withSwings({ centers: [60, 70] }))).toContain('hangers-overlap');
    expect(issueCodes(withSwings({ centers: [20, 80], seatWidth: 4 }))).toContain(
      'hanger-outside-span',
    );
  });

  it('rejects a seat less than 8 inches above the ground', () => {
    expect(issueCodes(withSwings({ seatHeight: 7.9 }))).toEqual(['seat-too-low']);
    expect(generate(withSwings({ seatHeight: 8 })).ok).toBe(true);
  });

  it('flags sloped ground but not level ground', () => {
    const slopeFlag = (o: SwingSetOutput) => o.flags.some((f) => f.ask.includes('sloped ground'));
    expect(slopeFlag(output)).toBe(true);
    expect(slopeFlag(run({ ...example, groundSlope: 0 }))).toBe(false);
  });
});

describe('hardware', () => {
  // Spec, Hardware example: every bolt 1/2", two per crossbar and gusset joint.
  const item = (o: SwingSetOutput, id: string) => o.hardware.find((h) => h.id === id);

  it('counts bolts and gives each group its grip', () => {
    const output = run(example);
    expect(item(output, 'leg-beam-bolts')?.quantity).toBe(2);
    expect(item(output, 'leg-beam-bolts')?.bolt?.grip).toBeCloseTo(8.947, 3);
    expect(item(output, 'crossbar-bolts')).toMatchObject({
      quantity: 8,
      bolt: { diameter: 0.5, grip: 5 },
    });
    expect(item(output, 'gusset-bolts')).toMatchObject({
      quantity: 8,
      bolt: { diameter: 0.5, grip: 5 },
    });
    expect(item(output, 'swing-hangers')?.quantity).toBe(4);
    expect(item(output, 'swing-seats')?.quantity).toBe(2);
    expect(item(output, 'ground-anchors')).toBeUndefined();
  });

  it('adds anchors for pads and ply bolts for a built-up beam', () => {
    expect(item(run(pads), 'ground-anchors')?.quantity).toBe(4);
    const builtUp = run({
      ...example,
      beamStock: '2x6',
      beamPlies: 2,
      hardware: { ...example.hardware, plyBolts: { diameter: 0.5, count: 6 } },
    });
    expect(item(builtUp, 'ply-bolts')).toMatchObject({ quantity: 6, bolt: { grip: 3 } });
  });

  it('requires anchors for pads and ply bolts for a built-up beam', () => {
    expect(issueCodes({ ...example, burialDepth: 0 })).toEqual(['anchors-missing']);
    expect(issueCodes({ ...example, beamStock: '2x6', beamPlies: 2 })).toEqual([
      'ply-bolts-missing',
    ]);
  });

  it('rejects bolt sizes outside the list', () => {
    expect(
      issueCodes({ ...example, hardware: { ...example.hardware, legBoltDiameter: 0.45 } }),
    ).toContain('invalid-invalid_union');
  });
});

describe('edge of range', () => {
  // Spec, Edge of range.
  const edge: SwingSetParams = {
    ...example,
    beamLength: 240,
    beamHeight: 144,
    splay: { kind: 'angle', degrees: 35 },
    beamStock: '2x6',
    beamPlies: 2,
    groundSlope: -3,
    burialDepth: 48,
    crossbarHeight: 100,
    swings: { ...example.swings, centers: [80, 160] },
    hardware: { ...example.hardware, plyBolts: { diameter: 0.5, count: 10 } },
  };
  const output = run(edge);
  const g = output.geometry;

  it('matches the spec values', () => {
    expect(g.flushCut.depthAtTop).toBeCloseTo(3.155, 3);
    expect(g.flushCut.woodLeftAtTop).toBeCloseTo(0.345, 3);
    expect(g.boltGrip).toBeCloseTo(7.694, 3);
    expect(g.back.groundZ).toBeCloseTo(-31.658, 3);
    expect(g.back.footZ).toBeCloseTo(-79.658, 3);
    expect(g.back.overallLength).toBeCloseTo(282.202, 3);
    expect(g.front.groundZ).toBeCloseTo(22.226, 3);
    expect(g.front.footZ).toBeCloseTo(-25.774, 3);
    expect(g.front.overallLength).toBeCloseTo(216.421, 3);
    expect(g.footprintDepth).toBeCloseTo(219.945, 3);
    // At 35°, 3.5 − 3.5 / (2·cos 35°) = 1.364 past each leg.
    expect(g.crossbar.pastLeg).toBeCloseTo(1.364, 3);
    expect(g.crossbar.topEdge).toBeCloseTo(75.891, 3);
    expect(g.crossbar.bottomEdge).toBeCloseTo(83.593, 3);
    expect(g.gusset.topWidth).toBeCloseTo(14.273, 3);
    expect(g.gusset.bottomWidth).toBeCloseTo(24.426, 3);
  });

  it('names legs by which way the ground actually slopes', () => {
    expect(output.parts.find((p) => p.id === 'leg-back')?.name).toBe('Back leg (downhill)');
    expect(output.parts.find((p) => p.id === 'leg-front')?.name).toBe('Front leg (uphill)');
    const level = run({ ...example, groundSlope: 0 });
    expect(level.parts.find((p) => p.id === 'leg-back')?.name).toBe('Back leg');
  });

  it('flags the thin flush cut', () => {
    expect(output.flags.some((f) => f.ask.includes('left at the top of the flush cut'))).toBe(true);
  });
});

describe('built-up beam', () => {
  // Spec, Built-up beam check: two 2x6 plies, otherwise the worked example.
  const builtUp: SwingSetParams = {
    ...example,
    beamStock: '2x6',
    beamPlies: 2,
    hardware: { ...example.hardware, plyBolts: { diameter: 0.5, count: 6 } },
  };
  const output = run(builtUp);
  const g = output.geometry;

  it('matches the spec values that depend on the beam width', () => {
    expect(g.boltGrip).toBeCloseTo(8.447, 3);
    expect(g.back.groundZ).toBeCloseTo(3.098, 3);
    expect(g.back.overallLength).toBeCloseTo(131.531, 3);
    expect(g.front.overallLength).toBeCloseTo(138.331, 3);
    expect(g.footprintDepth).toBeCloseTo(80.405, 3);
    expect(g.crossbar.topEdge).toBeCloseTo(54.489, 3);
    expect(g.crossbar.bottomEdge).toBeCloseTo(58.493, 3);
    expect(g.gusset.topWidth).toBeCloseTo(13.725, 3);
    expect(g.gusset.bottomWidth).toBeCloseTo(19.002, 3);
  });

  it('leaves the flush cut unchanged, since it depends only on the beam depth', () => {
    expect(g.flushCut.depthAtTop).toBeCloseTo(1.881, 3);
  });

  it('lists one beam part per ply and flags the ply fastening', () => {
    const beam = part(output, 'beam');
    expect(beam.quantity).toBe(2);
    expect(beam.stock.nominal).toBe('2x6');
    expect(beam.length).toBe(120);
    expect(output.flags.some((f) => f.ask.includes('beam plies are fastened'))).toBe(true);
  });

  it('does not flag ply fastening for a solid beam', () => {
    expect(run(example).flags.some((f) => f.ask.includes('plies'))).toBe(false);
  });

  it('rejects plies of anything but 2x stock', () => {
    expect(issueCodes({ ...example, beamPlies: 2 })).toContain('built-up-beam-stock');
  });

  it('rejects more than three plies', () => {
    expect(issueCodes({ ...builtUp, beamPlies: 4 })).toContain('invalid-too_big');
  });
});

describe('parts', () => {
  const output = run(example);

  it('lists every part with quantities', () => {
    expect(output.parts.map((p) => [p.id, p.quantity])).toEqual([
      ['beam', 1],
      ['leg-back', 2],
      ['leg-front', 2],
      ['crossbar', 2],
      ['gusset', 2],
    ]);
  });

  it('uses actual stock sizes and the splay for angled ends', () => {
    expect(part(output, 'beam').length).toBe(120);
    expect(part(output, 'beam').stock).toEqual({ nominal: '4x6', thickness: 3.5, width: 5.5 });
    for (const id of ['leg-back', 'leg-front', 'crossbar', 'gusset']) {
      for (const end of part(output, id).ends) expect(end.setting).toBe(20);
    }
    expect(part(output, 'leg-back').endsParallel).toBe(true);
    expect(part(output, 'crossbar').endsParallel).toBe(false);
  });
});

describe('splay from footprint', () => {
  it('solves the splay that gives the worked example footprint', () => {
    const output = run({ ...example, splay: { kind: 'footprint', depth: 80.906 } });
    expect(output.geometry.splay).toBeCloseTo(20, 3);
  });

  it('rejects a footprint no allowed splay can produce', () => {
    expect(issueCodes({ ...example, splay: { kind: 'footprint', depth: 10 } })).toEqual([
      'footprint-out-of-range',
    ]);
  });
});

describe('validation', () => {
  it('rejects out-of-range and malformed parameters', () => {
    expect(issueCodes({ ...example, beamLength: 10 })).toContain('invalid-too_small');
    expect(issueCodes({ ...example, legStock: '3x3' })).toContain('invalid-invalid_value');
  });

  it('rejects a flush cut that goes through the leg', () => {
    expect(
      issueCodes({ ...example, beamStock: '4x8', splay: { kind: 'angle', degrees: 35 } }),
    ).toContain('flush-cut-through-leg');
  });

  it('rejects a crossbar that overlaps the gusset', () => {
    expect(issueCodes({ ...example, crossbarHeight: 90 })).toEqual(['crossbar-overlaps-gusset']);
  });

  it('rejects a crossbar at or below grade at the uphill legs', () => {
    expect(issueCodes({ ...example, crossbarHeight: 8 })).toEqual(['crossbar-below-grade']);
  });

  it('rejects frames that do not fit on the beam', () => {
    expect(issueCodes({ ...example, beamLength: 48, frameInset: 22 })).toContain(
      'frames-do-not-fit',
    );
  });
});

describe('flags', () => {
  it('flags the bolt and burial for buried legs', () => {
    const asks = run(example).flags.map((f) => f.ask);
    expect(asks.some((a) => a.includes('leg-to-beam bolt'))).toBe(true);
    expect(asks.some((a) => a.includes('ground contact'))).toBe(true);
  });

  it('flags anchors for pads', () => {
    const asks = run(pads).flags.map((f) => f.ask);
    expect(asks.some((a) => a.includes('anchors'))).toBe(true);
    expect(asks.some((a) => a.includes('ground contact'))).toBe(false);
  });

  it('flags a thin flush cut without rejecting it', () => {
    const output = run({ ...example, beamStock: '4x8', splay: { kind: 'angle', degrees: 25 } });
    expect(output.geometry.flushCut.woodLeftAtTop).toBeLessThan(1);
    expect(output.flags.some((f) => f.ask.includes('left at the top of the flush cut'))).toBe(true);
  });
});
