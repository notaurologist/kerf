import { swingSetAFrame } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { type Generator, type ParityCase, parity, parityCases } from '../../parity.ts';
import { design } from './design.ts';

// Steps 2 and 3 of the joint model: the swing set with its parts trimmed by planes and bolted by
// laps matches the template's own output in every parity case, and gives the spec's hand-checked
// worked examples (docs/templates/swing-set-a-frame.md, Worked example and Edge of range).

const template = swingSetAFrame.definition;
const FIXTURES = import.meta.glob<readonly unknown[]>(
  '../../../../core/src/templates/swing-set-a-frame/snapshots/v*.json',
  { eager: true, import: 'default' },
);
const [worked] = template.examples;
if (!worked) throw new Error('No worked example');
const params = worked.params;

// Beyond the fixtures: the spec's edge of range (a two-ply beam, so the hanger bolts run down the
// seam), a three-ply beam (down the middle ply), and other bolt counts at each joint.
const more: (ParityCase & Pick<typeof worked, 'params' | 'structuralInputs'>)[] = [
  {
    name: 'the edge of range (spec)',
    params: {
      ...params,
      beamLength: 240,
      beamHeight: 144,
      splay: { kind: 'angle', degrees: 35 },
      beamStock: '2x6',
      beamPlies: 2,
      groundSlope: -3,
      burialDepth: 48,
      crossbarHeight: 100,
      swings: { ...params.swings, centers: [80, 160] },
      hardware: { ...params.hardware, plyBolts: { diameter: 0.5, count: 10 } },
    },
    structuralInputs: worked.structuralInputs,
  },
  {
    name: 'a three-ply beam on level ground',
    params: {
      ...params,
      beamStock: '2x6',
      beamPlies: 3,
      groundSlope: 0,
      hardware: { ...params.hardware, plyBolts: { diameter: 0.5, count: 6 } },
    },
    structuralInputs: worked.structuralInputs,
  },
  {
    name: 'three crossbar bolts and one gusset bolt at each leg',
    params: {
      ...params,
      hardware: {
        ...params.hardware,
        crossbarBolts: { ...params.hardware.crossbarBolts, perJoint: 3 },
        gussetBolts: { ...params.hardware.gussetBolts, perJoint: 1 },
      },
    },
    structuralInputs: worked.structuralInputs,
  },
];
const cases = [...parityCases(template, FIXTURES), ...more];

describe('the swing set from joints', () => {
  it('matches the template in every case', () => {
    for (const c of more) {
      // The definition's generate takes parsed parameters, so each is parsed here first.
      expect(template.params.safeParse(c.params).success).toBe(true);
      expect(template.generate(c.params, c.structuralInputs).ok).toBe(true);
    }
    const results = parity(template, swingSetAFrame.generateWith(design) as Generator, cases);
    expect(results.length).toBe(cases.length);
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });

  it('gives the worked example', () => {
    const made = design(params);
    if (!made.ok) throw new Error('The worked example does not generate');
    const part = (id: string) => made.output.parts.find((p) => p.id === id);
    const origin = (id: string, instance: number) =>
      made.output.placements?.find((p) => p.partId === id && p.instance === instance)?.origin;

    // Legs: edge (101.5 − z_b) / cos 20°, overall + 3.5·tan 20°; level cuts at 20°.
    expect(part('leg-back')?.markLengths[0]?.value).toBeCloseTo(130.236, 3);
    expect(part('leg-back')?.length).toBeCloseTo(131.51, 3);
    expect(part('leg-front')?.markLengths[0]?.value).toBeCloseTo(137.08, 3);
    expect(part('leg-front')?.length).toBeCloseTo(138.354, 3);
    expect(part('leg-back')?.ends.map((e) => e.setting)).toEqual([
      expect.closeTo(20, 9),
      expect.closeTo(20, 9),
    ]);
    // Crossbar top and bottom edges; gusset top and bottom widths.
    expect(part('crossbar')?.markLengths.map((m) => m.value)).toEqual([
      expect.closeTo(54.989, 3),
      expect.closeTo(58.993, 3),
    ]);
    expect(part('crossbar')?.length).toBeCloseTo(58.993, 3);
    expect(part('gusset')?.markLengths.map((m) => m.value)).toEqual([
      expect.closeTo(14.225, 3),
      expect.closeTo(19.502, 3),
    ]);
    expect(part('beam')?.length).toBe(120);

    // Origins (spec, Placements).
    expect(origin('leg-back', 0)).toEqual({
      x: 12,
      y: expect.closeTo(-0.252, 3),
      z: 101.5,
    });
    expect(origin('leg-front', 1)).toEqual({ x: 108, y: expect.closeTo(0.252, 3), z: 101.5 });
    expect(origin('crossbar', 0)).toEqual({ x: 10.5, y: expect.closeTo(-29.496, 3), z: 34.5 });
    expect(origin('gusset', 1)).toEqual({ x: 108, y: expect.closeTo(-9.751, 3), z: 88.75 });

    // Bolt grip: 3.5 + 2·(3.7246 − 1.0009) = 8.947; each leg's hole 3.5 / cos 20° − 2.75·tan 20°.
    const grip = (id: string) => made.output.hardware.find((i) => i.id === id)?.bolt?.grip;
    expect(made.output.geometry.boltGrip).toBeCloseTo(8.947, 3);
    expect(grip('leg-beam-bolts')).toBeCloseTo(8.947, 3);
    expect(part('leg-back')?.holes[0]?.length).toBeCloseTo(2.7237, 4);
    // Crossbar and gusset bolts: the board's thickness and the leg's, 1.5 + 3.5.
    expect(grip('crossbar-bolts')).toBeCloseTo(5, 12);
    expect(grip('gusset-bolts')).toBeCloseTo(5, 12);
    // Hanger bolts: down through the beam's depth, 5.5.
    expect(grip('hanger-bolts')).toBeCloseTo(5.5, 12);
  });

  it('gives the edge of range its grip: 3 + 2·(3.5 / cos 35° − 2.75·tan 35°) = 7.694', () => {
    const edge = more[0];
    const made = edge && design(edge.params);
    expect(made?.ok && made.output.geometry.boltGrip).toBeCloseTo(7.694, 3);
  });
});
