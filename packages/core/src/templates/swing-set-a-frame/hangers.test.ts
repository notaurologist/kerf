import { describe, expect, it } from 'vitest';
import { WORKED_EXAMPLE } from './examples.ts';
import type { SwingSetParams } from './params.ts';
import { checkFields } from './structural.ts';
import { generate, type SwingSetOutput } from './template.ts';

// The swing hangers' mounting (spec, Hardware): the bolts that fasten them, their holes in the
// beam, and the operation that drills them. The worked example hangs each hanger from a 1/2" bolt
// down through the 4x6 beam (5-1/2" deep), in a 9/16" hole, at 30, 50, 70, and 90.

const withMounting = (hangerMounting?: SwingSetParams['hardware']['hangerMounting']) => {
  const { hangerMounting: _, ...hardware } = WORKED_EXAMPLE.hardware;
  return {
    ...WORKED_EXAMPLE,
    hardware: hangerMounting ? { ...hardware, hangerMounting } : hardware,
  };
};

function output(p: SwingSetParams): SwingSetOutput {
  const result = generate(p);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

const sideways = withMounting({
  kind: 'horizontal-bolts',
  diameter: 0.375,
  perHanger: 2,
  holeHeight: 2.75,
});

describe('one bolt down through the beam', () => {
  const o = output(WORKED_EXAMPLE);
  const beam = o.parts.find((p) => p.id === 'beam');

  it('lists four bolts with the other bolts, gripping the beam depth plus the hanger', () => {
    const bolts = o.hardware.find((h) => h.id === 'hanger-bolts');
    expect(bolts).toMatchObject({
      name: 'Swing hanger bolts',
      quantity: 4,
      bolt: { diameter: 0.5, grip: 5.5, washers: 2, nut: 'locking', cap: true },
      group: 'Bolts and fittings',
    });
    expect(bolts?.bolt?.length).toBeUndefined();
    expect(bolts?.notes[0]).toMatch(/^Grip 5-1\/2": the beam's depth, plus the hanger's plate/);
    expect(bolts?.notes[1]).toBe(
      'Many hangers come with their bolts: check those against this length.',
    );
  });

  it('drills a 9/16" hole down through the beam at each hanger, on its centerline', () => {
    const holes = beam?.holes.filter((h) => h.hardwareId === 'hanger-bolts') ?? [];
    expect(holes.map((h) => h.entry)).toEqual(
      [30, 50, 70, 90].map((u) => ({ u, v: 5.5, n: 1.75 })),
    );
    for (const h of holes) {
      expect(h).toMatchObject({ diameter: 0.5625, boltDiameter: 0.5, length: 5.5 });
      expect(h.direction).toEqual({ u: 0, v: -1, n: 0 });
    }
    expect(beam?.notes).toContain(
      'Swing hanger holes: 9/16", down through the beam on its centerline, 30", 50", 70", 90" from the left end.',
    );
  });

  it('makes the holes an operation in the beam, 5-1/2" deep', () => {
    expect(o.operations?.find((op) => op.id === 'hanger-bolts/holes')).toEqual({
      id: 'hanger-bolts/holes',
      type: 'bolt-holes',
      hardwareId: 'hanger-bolts',
      partIds: ['beam'],
      count: 4,
      boltDiameter: 0.5,
      holeDiameter: 0.5625,
      depth: 5.5,
    });
  });

  it('puts the hole on the seam of a two-ply beam', () => {
    const twoPly = output({
      ...WORKED_EXAMPLE,
      beamStock: '2x6',
      beamPlies: 2,
      hardware: { ...WORKED_EXAMPLE.hardware, plyBolts: { diameter: 0.5, count: 6 } },
    });
    const hole = twoPly.parts
      .find((p) => p.id === 'beam')
      ?.holes.find((h) => h.hardwareId === 'hanger-bolts');
    expect(hole?.entry.n).toBe(1.5);
  });
});

describe('bolts sideways through a bracket', () => {
  const o = output(sideways);

  it('lists the bolts per hanger, gripping the beam breadth plus the bracket', () => {
    const bolts = o.hardware.find((h) => h.id === 'hanger-bolts');
    expect(bolts).toMatchObject({ quantity: 8, bolt: { diameter: 0.375, grip: 3.5 } });
    expect(bolts?.notes[0]).toMatch(/^Grip 3-1\/2": the beam's breadth, plus the two sides/);
  });

  it('places no holes, since the bracket sets where they go, and drills through it', () => {
    const beam = o.parts.find((p) => p.id === 'beam');
    expect(beam?.holes.some((h) => h.hardwareId === 'hanger-bolts')).toBe(false);
    expect(beam?.notes).toContain(
      'Swing hanger holes: 7/16", across the beam 2-3/4" up from its bottom edge. Hold each hanger\'s bracket at its mark and drill through the bracket\'s holes.',
    );
    expect(o.operations?.find((op) => op.id === 'hanger-bolts/holes')).toMatchObject({
      partIds: ['beam'],
      count: 8,
      holeDiameter: 0.4375,
      depth: 3.5,
    });
  });

  // A 7/16" hole reaches 7/32" either side of its center: 0.21875 to 5.28125 in a 5-1/2" beam.
  it('refuses holes that reach past the top or bottom of the beam', () => {
    for (const holeHeight of [0.2, 5.3]) {
      const result = generate(
        withMounting({ kind: 'horizontal-bolts', diameter: 0.375, perHanger: 1, holeHeight }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.issues.map((i) => i.code)).toEqual(['hanger-holes-outside-beam']);
    }
    expect(
      generate(
        withMounting({ kind: 'horizontal-bolts', diameter: 0.375, perHanger: 1, holeHeight: 0.25 }),
      ).ok,
    ).toBe(true);
  });
});

describe('another mounting, or none entered', () => {
  for (const [name, p] of [
    ['other', withMounting({ kind: 'other' })],
    ['not entered', withMounting()],
  ] as const) {
    it(`lists no hanger bolts and drills nothing: ${name}`, () => {
      const o = output(p);
      expect(o.hardware.some((h) => h.id === 'hanger-bolts')).toBe(false);
      expect(o.operations?.some((op) => op.id === 'hanger-bolts/holes')).toBe(false);
      expect(o.parts.find((p) => p.id === 'beam')?.notes).toEqual([]);
    });
  }
});

describe('the fields bending changes with', () => {
  it('include the mounting; shear and deflection do not', () => {
    const paths = (kind: 'beam-bending' | 'beam-shear' | 'beam-deflection') =>
      checkFields({ kind, subject: 'Top beam, 4x6' }).map((f) => f.path);
    expect(paths('beam-bending')).toContain('hardware.hangerMounting.kind');
    expect(paths('beam-bending')).toContain('hardware.hangerMounting.holeHeight');
    expect(paths('beam-shear')).not.toContain('hardware.hangerMounting.kind');
    expect(paths('beam-deflection')).not.toContain('hardware.hangerMounting.kind');
  });
});
