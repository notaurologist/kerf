import { swingSetAFrame } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { type Generator, parity, parityCases } from '../../parity.ts';
import { design } from './design.ts';

// Step 2 of the joint model: the swing set with every part trimmed by planes matches the
// template's own output in every parity case, and gives the spec's hand-checked worked example
// (docs/templates/swing-set-a-frame.md, Worked example and Placements).

const template = swingSetAFrame.definition;
const FIXTURES = import.meta.glob<readonly unknown[]>(
  '../../../../core/src/templates/swing-set-a-frame/snapshots/v*.json',
  { eager: true, import: 'default' },
);
const cases = parityCases(template, FIXTURES);

describe('the swing set trimmed by planes', () => {
  it('matches the template in every case', () => {
    const results = parity(template, swingSetAFrame.generateWith(design) as Generator, cases);
    expect(results.length).toBe(cases.length);
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });

  it('gives the worked example', () => {
    const example = template.examples[0];
    if (!example) throw new Error('No worked example');
    const made = design(example.params);
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
  });
});
