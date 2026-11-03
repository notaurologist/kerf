import { recordCabinet } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { type Generator, type ParityCase, parity, parityCases } from '../../parity.ts';
import { design } from './design.ts';

// Step 4 of the joint model: the record cabinet with its sides, partitions, and back rails housed
// in dadoes matches the template's own output in every parity case, and gives the spec's
// hand-checked worked example (docs/templates/record-cabinet.md, Worked example).

const template = recordCabinet.definition;
const FIXTURES = import.meta.glob<readonly unknown[]>(
  '../../../../core/src/templates/record-cabinet/snapshots/v*.json',
  { eager: true, import: 'default' },
);
const [worked] = template.examples;
if (!worked) throw new Error('No worked example');
const params = worked.params;

// Beyond the fixtures: one bay, with no partitions, and four, with three.
const more: (ParityCase & Pick<typeof worked, 'params' | 'structuralInputs'>)[] = [
  {
    name: 'one bay',
    params: { ...params, width: 24, bays: 1, doors: 'none' },
    structuralInputs: worked.structuralInputs,
  },
  {
    name: 'four bays with doors',
    params: { ...params, width: 72, bays: 4 },
    structuralInputs: worked.structuralInputs,
  },
];
const cases = [...parityCases(template, FIXTURES), ...more];
const generate = recordCabinet.generateWith(design) as Generator;

describe('the record cabinet from joints', () => {
  it('matches the template in every case', () => {
    for (const c of more) expect(template.generate(c.params, c.structuralInputs).ok).toBe(true);
    const results = parity(template, generate, cases);
    expect(results.length).toBe(cases.length);
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });

  it('gives the worked example', () => {
    const made = recordCabinet.generateWith(design)(params, worked.structuralInputs);
    if (!made.ok) throw new Error('The worked example does not generate');
    const { parts, placements } = made.output.design;
    const part = (id: string) => parts.find((q) => q.id === id);
    const origin = (id: string, instance: number) =>
      placements.find((q) => q.partId === id && q.instance === instance)?.origin;

    // Sides and partitions: h_b + 2j = 13.25 + 0.375 = 13.625, from z_b + t − j = 8.0625.
    expect(part('side-left')?.length).toBe(13.625);
    expect(part('partition')?.length).toBe(13.625);
    expect(origin('side-left', 0)).toEqual({ x: 1.5, y: 0, z: 8.0625 });
    // The second partition stands at x = 0.75 + 0.75 + 2·16.5 + 0.75 = 35.25, behind the 2.5 tracks.
    expect(origin('partition', 1)).toEqual({ x: 36, y: 2.5, z: 8.0625 });
    // Each notched s_d = 0.5 by j at both front corners.
    expect(part('side-left')?.notches).toEqual([
      { end: 0, edge: 'reference', along: 0.1875, across: 0.5 },
      { end: 1, edge: 'reference', along: 0.1875, across: 0.5 },
    ]);
    // Back rails: b + 2j = 16.5 + 0.375 = 16.875, the first from 1.5 − 0.1875.
    expect(part('rail')?.length).toBe(16.875);
    expect(origin('rail', 0)).toEqual({ x: 1.3125, y: 17, z: 18.5 });

    // The top's dadoes: the left side's from o_f + s_d = 1.25 to the back, D_t = 17.75; a
    // partition's from 0.75 + 2.5 + 0.5 = 3.75.
    const housedIn = (id: string, withPart: string) =>
      part(id)?.dadoes.filter((d) => d.withPart === withPart);
    expect(housedIn('top', 'side-left')).toEqual([
      {
        withPart: 'side-left',
        face: 'near',
        u0: 0.75,
        u1: 1.5,
        v0: 1.25,
        v1: 17.75,
        depth: 0.1875,
      },
    ]);
    expect(housedIn('top', 'partition')?.[0]).toMatchObject({ u0: 18, u1: 18.75, v0: 3.75 });
    // The case bottom's, from x = 0.75: the first partition's from 17.25, 2.5 + 0.5 = 3 from the front.
    expect(housedIn('bottom', 'partition')?.[0]).toMatchObject({
      u0: 17.25,
      u1: 18,
      v0: 3,
      v1: 17,
    });
    // A rail's dado in each panel: 22.25 − 0.75 − 3 − 8.0625 = 10.4375 up to 13.4375, across the
    // back 13/16: from 17 − 0.8125 in a side, and 14.5 − 0.8125 in a partition.
    expect(housedIn('side-left', 'rail')).toEqual([
      {
        withPart: 'rail',
        face: 'near',
        u0: 10.4375,
        u1: 13.4375,
        v0: 16.1875,
        v1: 17,
        depth: 0.1875,
      },
    ]);
    expect(housedIn('partition', 'rail')).toEqual([
      {
        withPart: 'rail',
        face: 'near',
        u0: 10.4375,
        u1: 13.4375,
        v0: 13.6875,
        v1: 14.5,
        depth: 0.1875,
      },
      {
        withPart: 'rail',
        face: 'far',
        u0: 10.4375,
        u1: 13.4375,
        v0: 13.6875,
        v1: 14.5,
        depth: 0.1875,
      },
    ]);
  });
});
