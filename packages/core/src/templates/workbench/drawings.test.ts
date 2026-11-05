import { describe, expect, it } from 'vitest';
import { type Explode, type SubAssembly, subAssemblyViews } from '../../geometry/index.ts';
import { solid, solidBox } from '../../geometry/solid.ts';
import { subAssemblies, subAssemblyDrawings } from '../../steps/drawings.ts';
import { workbench } from './definition.ts';
import { CHERRY, WORKED_EXAMPLE } from './examples.ts';

// The worked example's sub-assemblies (spec, Drawings), checked by hand against its placements
// (spec, Geometry): each part leaves along its joint by what it overlaps the part it leaves, plus
// a gap of a quarter of the group's depth, or of a door's width.

const made = workbench.generate(WORKED_EXAMPLE, CHERRY);
if (!made.ok) throw new Error('worked example does not generate');
const outputs = made.output;
const groups = workbench.assembly(outputs)?.subAssemblies ?? [];
const group = (id: string): SubAssembly => {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const moves = (g: SubAssembly) =>
  g.explode.map((e: Explode) => [
    `${e.partId}/${e.instance}`,
    e.stage ?? 0,
    e.offset.x,
    e.offset.y,
    e.offset.z,
  ]);
const ids = (g: SubAssembly) => g.members.map((m) => `${m.partId}/${m.instance}`).sort();

describe('the workbench’s sub-assemblies', () => {
  it('declares the two end frames, a drawer of each size, and a door', () => {
    expect(groups.map((g) => [g.id, g.title, g.alike, g.stepId])).toEqual([
      ['left-end-frame', 'Left end frame', 1, 'end-frames'],
      ['right-end-frame', 'Right end frame', 1, 'end-frames'],
      ['upper-drawer', 'Upper drawer', 2, 'drawer-screws'],
      ['lower-drawer', 'Lower drawer', 1, 'drawer-screws'],
      ['door', 'Door', 2, 'doors'],
    ]);
  });

  it('takes each end frame apart: the foot down, then the legs off the rail', () => {
    // The foot runs from y = −1 to 17-5/8, so the gap is 18-5/8 / 4 = 4-21/32. The legs stand
    // from z = 1-1/4 in the foot, 3 tall, so the foot drops 3 − 1-1/4 + 4-21/32 = 6-13/32. The end
    // rail's tenons reach y = 1-1/4 in the front leg (y = 0 to 3) and 15-3/8 in the back leg
    // (y = 13-5/8 to 16-5/8), 1-3/4 into each, so each leg moves 1-3/4 + 4-21/32 = 6-13/32.
    const d = 1.75 + 18.625 / 4;
    expect(d).toBe(6.40625);
    expect(ids(group('left-end-frame'))).toEqual(['end-rail/0', 'foot/0', 'leg-b/1', 'leg-vise/0']);
    expect(moves(group('left-end-frame'))).toEqual([
      ['foot/0', 0, 0, 0, -d],
      ['leg-vise/0', 1, 0, -d, 0],
      ['leg-b/1', 1, 0, d, 0],
    ]);
    expect(ids(group('right-end-frame'))).toEqual(['end-rail/1', 'foot/1', 'leg-a/0', 'leg-b/0']);
    expect(moves(group('right-end-frame'))).toEqual([
      ['foot/1', 0, 0, 0, -d],
      ['leg-b/0', 1, 0, -d, 0],
      ['leg-a/0', 1, 0, d, 0],
    ]);
  });

  it('takes each drawer apart: the front, then the sides, then the bottom out the back', () => {
    // A drawer runs from the front's face, y = 0, to the box back's, 14-13/16, so the gap is
    // 14-13/16 / 4 = 3-45/64. The front only touches the box front, so it moves the gap. The
    // bottom runs to the box back's outside face, so it moves its own depth front to back and the
    // gap. The sides hold the box front's and back's pins across their 1/2 thickness, past the
    // bottom's edges.
    const gap = 14.8125 / 4;
    expect(gap).toBe(3.703125);
    // The bottom's front edge stands its movement gap behind the front groove's bottom.
    const part = outputs.design.parts.find((p) => p.id === 'upper-drawer-bottom');
    const pl = outputs.design.placements.find((q) => q.partId === 'upper-drawer-bottom');
    if (!part || !pl) throw new Error('no drawer bottom');
    const depth = 14.8125 - solidBox(solid(part, pl)).y[0];
    expect(depth).toBeCloseTo(13.58235, 5);
    for (const [size, instance] of [
      ['upper', 0],
      ['lower', 0],
    ] as const) {
      const g = group(`${size}-drawer`);
      expect(ids(g)).toEqual(
        ['bottom', 'box-back', 'box-front', 'front', 'side-left', 'side-right'].map(
          (n) => `${size}-drawer-${n}/${instance}`,
        ),
      );
      const [front, left, right, bottomMove] = moves(g);
      expect(front).toEqual([`${size}-drawer-front/0`, 0, 0, -gap, 0]);
      expect(left).toEqual([`${size}-drawer-side-left/0`, 1, -(0.5 + gap), 0, 0]);
      expect(right).toEqual([`${size}-drawer-side-right/0`, 1, 0.5 + gap, 0, 0]);
      expect(bottomMove?.slice(0, 3)).toEqual([`${size}-drawer-bottom/0`, 2, 0]);
      expect(bottomMove?.[3]).toBeCloseTo(depth + gap, 9);
      expect(bottomMove?.[4]).toBe(0);
    }
  });

  it('takes the left door apart: the stiles off the rails’ tenons, then the rails off the panel', () => {
    // The door runs from x = 8-13/16 to 30-29/32, 22-3/32 wide, so the gap is 5-67/128. The
    // rails' tenons go 3/8 into each stile, past the panel's tongue, and the panel's tongue goes
    // 11/32 into each rail's groove (z = 8-15/32 against the low rail's 8-13/16 top, and
    // 19-29/32 against the high rail's 19-9/16 bottom).
    const gap = 22.09375 / 4;
    expect(ids(group('door'))).toEqual([
      'door-panel/0',
      'door-rail/0',
      'door-rail/1',
      'door-stile-hinge/0',
      'door-stile-meeting/0',
    ]);
    expect(moves(group('door'))).toEqual([
      ['door-stile-hinge/0', 0, -(0.375 + gap), 0, 0],
      ['door-stile-meeting/0', 0, 0.375 + gap, 0, 0],
      ['door-rail/0', 1, 0, 0, -(0.34375 + gap)],
      ['door-rail/1', 1, 0, 0, 0.34375 + gap],
    ]);
  });

  it('draws each group alone, once, titled with how many alike', () => {
    const assembly = workbench.assembly(outputs);
    if (!assembly) throw new Error('no assembly');
    const g = group('upper-drawer');
    const { isometric, exploded } = subAssemblyViews(assembly.scene, assembly.view, g);
    expect([isometric.title, exploded.title]).toEqual([
      'Upper drawer (2 alike), assembled',
      'Upper drawer (2 alike), exploded',
    ]);
    const drawn = new Set(
      exploded.primitives.flatMap((p) =>
        p.kind === 'polygon' && p.part ? [`${p.part.partId}/${p.part.instance}`] : [],
      ),
    );
    expect([...drawn].sort()).toEqual(ids(g));
    expect(exploded.stages?.map((s) => s.moves.length)).toEqual([1, 2, 1]);
    const lower = subAssemblyViews(assembly.scene, assembly.view, group('lower-drawer'));
    expect(lower.isometric.title).toBe('Lower drawer, assembled');
  });

  it('lists each group without its members or explode, and draws one by its ID', () => {
    expect(subAssemblies(workbench, outputs)).toEqual(
      groups.map((g) => ({ id: g.id, title: g.title, alike: g.alike, stepId: g.stepId })),
    );
    const assembly = workbench.assembly(outputs);
    if (!assembly) throw new Error('no assembly');
    expect(subAssemblyDrawings(workbench, outputs, 'door')).toEqual(
      subAssemblyViews(assembly.scene, assembly.view, group('door')),
    );
    expect(subAssemblyDrawings(workbench, outputs, 'no-such-group')).toBeNull();
  });
});
