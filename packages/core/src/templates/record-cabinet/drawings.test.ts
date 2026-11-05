import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { subAssemblyViews } from '../../geometry/index.ts';
import type { TemplateDefinition } from '../../model/definition.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
import type { StoredRecordCabinetOutputs } from './outputs.ts';

// The worked example's door (spec, Drawings), checked by hand against its placements (spec,
// Sliding doors): the door is 17-3/4" wide, so each part clears what it leaves by 17-3/4 / 4 =
// 4-7/16". Each stile sits over the rails' stub tenons by the groove depth, 3/8, so it moves
// 3/8 + 4-7/16 = 4-13/16 out to its side. Each rail holds the panel's tongue by the groove depth
// less the panel's gap at each end, 3/8 − 1/32 = 11/32 (the panel is 10-7/16 in a 10-1/2 opening
// between the rails' groove bottoms), so it moves 11/32 + 4-7/16 = 4-25/32 down or up.

const [example, , edge] = recordCabinet.examples;
if (!example || !edge) throw new Error('no worked examples');
const outputsOf = (params: unknown, inputs: unknown) => {
  const made = recordCabinet.generate(params as never, inputs as never);
  if (!made.ok) throw new Error('example does not generate');
  return made.output;
};
const outputs = outputsOf(example.params, example.structuralInputs);
const groups = (o: StoredRecordCabinetOutputs) => recordCabinet.assembly(o)?.subAssemblies ?? [];

describe('the record cabinet’s sub-assemblies', () => {
  it('declares a door, two alike, put together in the doors step', () => {
    expect(groups(outputs).map((g) => [g.id, g.title, g.alike, g.stepId])).toEqual([
      ['door', 'Door', 2, 'doors'],
    ]);
  });

  it('takes the left door apart: the stiles off the rails’ stub tenons, then the rails off the panel', () => {
    const [door] = groups(outputs);
    if (!door) throw new Error('no door');
    expect(door.members.map((m) => `${m.partId}/${m.instance}`).sort()).toEqual([
      'door-panel/0',
      'door-rail/0',
      'door-rail/1',
      'door-stile-inner/0',
      'door-stile-outer/0',
    ]);
    expect(
      door.explode.map((e) => [`${e.partId}/${e.instance}`, e.stage, e.offset.x, e.offset.z]),
    ).toEqual([
      ['door-stile-outer/0', 0, -(4 + 13 / 16), 0],
      ['door-stile-inner/0', 0, 4 + 13 / 16, 0],
      ['door-rail/0', 1, 0, -(4 + 25 / 32)],
      ['door-rail/1', 1, 0, 4 + 25 / 32],
    ]);
    expect(door.explode.every((e) => e.offset.y === 0)).toBe(true);
  });

  it('draws the door alone, titled with how many alike', () => {
    const assembly = recordCabinet.assembly(outputs);
    const [door] = groups(outputs);
    if (!assembly || !door) throw new Error('no door');
    const { isometric, exploded } = subAssemblyViews(assembly.scene, assembly.view, door);
    expect([isometric.title, exploded.title]).toEqual([
      'Door (2 alike), assembled',
      'Door (2 alike), exploded',
    ]);
    expect(exploded.stages?.map((s) => s.moves.length)).toEqual([2, 2]);
  });

  it('declares none for a plan with no doors', () => {
    expect(edge.params.doors).toBe('none');
    expect(groups(outputsOf(edge.params, edge.structuralInputs))).toEqual([]);
  });

  // Every stored plan with doors declares the same door, found by where its parts stand; one
  // with none, every plan from before doors or the leg base included, declares none.
  const folder = join(dirname(fileURLToPath(import.meta.url)), 'snapshots');
  const stored = readdirSync(folder)
    .filter((f) => f.endsWith('.json'))
    .flatMap((file) =>
      (JSON.parse(readFileSync(join(folder, file), 'utf8')) as unknown[]).map((snapshot, i) => ({
        name: `${file} #${i}`,
        snapshot,
      })),
    );

  it.each(stored)('declares a door in $name only when it has one', ({ snapshot }) => {
    const read = readSnapshot([recordCabinet as TemplateDefinition], snapshot);
    if (!read.ok) throw new Error(read.message);
    const o = recordCabinet.storedOutputs.parse(read.snapshot.outputs);
    const doors = o.design.placements.filter((pl) => pl.partId === 'door-panel').length;
    const declared = groups(o);
    if (doors === 0) {
      expect(declared).toEqual([]);
      return;
    }
    expect(declared.map((g) => [g.id, g.alike])).toEqual([['door', doors]]);
    expect(declared[0]?.members).toHaveLength(5);
  });
});
