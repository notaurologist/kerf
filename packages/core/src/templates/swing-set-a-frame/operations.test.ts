import { describe, expect, it } from 'vitest';
import type { Operation } from '../../model/operations.ts';
import type { SwingSetParams } from './params.ts';
import { generate } from './template.ts';

// The spec's worked example (docs/templates/swing-set-a-frame.md, Worked example; Operations):
// a 120" 4x6 beam at 96", 4x4 legs splayed 20°, 2x6 crossbars, 2x8 gussets, legs buried 24",
// 1/2" bolts, two per crossbar and gusset joint.
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

function operations(params: SwingSetParams): Operation[] {
  const result = generate(params);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output.operations ?? [];
}

const RAD = Math.PI / 180;

describe('swing-set operations (#103)', () => {
  const ops = operations(example);
  const byId = (id: string) => ops.find((o) => o.id === id);

  it('lists every operation once, by a unique ID', () => {
    expect(ops.map((o) => o.id)).toEqual([
      'beam/end-0',
      'beam/end-1',
      'leg-back/end-0',
      'leg-back/end-1',
      'leg-back/taper-0',
      'leg-front/end-0',
      'leg-front/end-1',
      'leg-front/taper-0',
      'crossbar/end-0',
      'crossbar/end-1',
      'gusset/end-0',
      'gusset/end-1',
      'leg-beam-bolts/holes',
      'crossbar-bolts/holes',
      'gusset-bolts/holes',
      'beam/ease-edges',
      'leg-back/ease-edges',
      'leg-front/ease-edges',
      'crossbar/ease-edges',
      'gusset/ease-edges',
      'site/dig-holes',
    ]);
  });

  it('cuts the beam square, across its 5-1/2" width and through its 3-1/2" thickness', () => {
    expect(byId('beam/end-0')).toEqual({
      id: 'beam/end-0',
      type: 'crosscut',
      partId: 'beam',
      count: 1,
      end: 0,
      width: 5.5,
      thickness: 3.5,
    });
  });

  it('miters both ends of every leg, crossbar, and gusset at the 20° splay', () => {
    for (const id of ['leg-back', 'leg-front', 'crossbar', 'gusset']) {
      for (const end of [0, 1]) {
        const op = byId(`${id}/end-${end}`);
        expect(op).toMatchObject({ type: 'miter', partId: id, count: 2, end });
        expect(op?.type === 'miter' && op.setting).toBeCloseTo(20, 9);
      }
    }
    expect(byId('crossbar/end-0')).toMatchObject({ width: 5.5, thickness: 1.5 });
    expect(byId('gusset/end-0')).toMatchObject({ width: 7.25, thickness: 1.5 });
  });

  // Hand check: the flush face is vertical and lies against the beam's face, so it runs the
  // beam's depth, 5.5", at the splay angle to the leg's edge. From the spec's marks: 5.853 down
  // the inner edge, ending 1.881 in from it on the top cut (0.685 down at that point), so
  // √((5.853 − 0.685)² + 1.881²) = 5.500.
  it('cuts each leg\'s flush face 5-1/2" long at 20° to its edge, through the leg', () => {
    for (const id of ['leg-back', 'leg-front']) {
      const op = byId(`${id}/taper-0`);
      if (op?.type !== 'taper') throw new Error(`${id} has no taper`);
      expect(op.length).toBeCloseTo(5.5, 3);
      expect(op.angleToEdge).toBeCloseTo(20, 9);
      expect(op).toMatchObject({ count: 2, taper: 0, thickness: 3.5 });
    }
  });

  // Hand check of each grip (spec, Hardware): leg to beam, bw + 2·(w / cos α − (bd/2)·tan α)
  // = 3.5 + 2·(3.5 / 0.93969 − 2.75 · 0.36397) = 8.947; crossbar and gusset, ct + t = 1.5 + 3.5.
  it('drills each bolt item through the parts it joins, to its grip', () => {
    const legBeam = 3.5 + 2 * (3.5 / Math.cos(20 * RAD) - 2.75 * Math.tan(20 * RAD));
    expect(legBeam).toBeCloseTo(8.947, 3);
    const holes = byId('leg-beam-bolts/holes');
    if (holes?.type !== 'bolt-holes') throw new Error('no leg-to-beam holes');
    expect(holes.depth).toBeCloseTo(legBeam, 9);
    expect(holes).toMatchObject({
      count: 2,
      boltDiameter: 0.5,
      partIds: ['beam', 'leg-back', 'leg-front'],
    });
    for (const [id, board] of [
      ['crossbar-bolts/holes', 'crossbar'],
      ['gusset-bolts/holes', 'gusset'],
    ] as const) {
      expect(byId(id)).toMatchObject({
        type: 'bolt-holes',
        count: 8,
        boltDiameter: 0.5,
        depth: 5,
        partIds: ['leg-back', 'leg-front', board],
      });
    }
  });

  it('eases the edges of every part, as many as the cut list has', () => {
    expect(ops.filter((o) => o.type === 'ease-edges').map((o) => [o.partId, o.count])).toEqual([
      ['beam', 1],
      ['leg-back', 2],
      ['leg-front', 2],
      ['crossbar', 2],
      ['gusset', 2],
    ]);
  });

  it('digs a hole for each of the four legs when they are buried, and levels pads when not', () => {
    expect(byId('site/dig-holes')).toEqual({
      id: 'site/dig-holes',
      type: 'dig-holes',
      count: 4,
      depth: 24,
    });
    const onPads = operations({
      ...example,
      burialDepth: 0,
      hardware: { ...example.hardware, anchorsPerFoot: 2 },
    });
    expect(onPads.at(-1)).toEqual({ id: 'site/level-pads', type: 'level-pads', count: 4 });
    expect(onPads.some((o) => o.type === 'dig-holes')).toBe(false);
  });
});
