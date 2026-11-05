import type { Part } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { endSheet, endWindow, partTemplates, RUN_ON } from './ends.ts';
import { faceHoles, faceRects, markShapes, unmarkedNote } from './marks.ts';
import { exampleParts } from './parts.ts';
import { PAD, type Shape, type Sheet } from './sheet.ts';

const swing = exampleParts('swing-set-a-frame');
const bench = exampleParts('workbench');
const cabinet = exampleParts('record-cabinet');
const named = (parts: readonly Part[], name: string) =>
  parts.find((p) => p.name.startsWith(name)) as Part;

function shapesOf<K extends Shape['kind']>(sheet: Sheet, kind: K): Extract<Shape, { kind: K }>[] {
  return sheet.shapes.filter((s): s is Extract<Shape, { kind: K }> => s.kind === kind);
}
const notesOf = (sheet: Sheet) =>
  shapesOf(sheet, 'text')
    .map((t) => t.text)
    .join(' ');
const identity = (p: { u: number; v: number }) => ({ x: p.u, y: p.v });

describe('the leg’s bolt holes on its top template, worked by hand', () => {
  // The back leg's top: two 9/16" holes for 1/2" bolts through its faces, on its centerline
  // (v = 3-1/2 / 2 = 1-3/4"), drilled from the near face; one more hole enters its edge.
  const leg = named(swing, 'Back leg');
  const through = leg.holes
    .filter((h) => h.direction.n === 1)
    .sort((a, b) => a.entry.u - b.entry.u);
  const [first, second] = through;

  it('starts from the worked example', () => {
    expect(through.map((h) => [h.entry.v, h.entry.n, h.diameter, h.boltDiameter])).toContainEqual([
      1.75, 0, 0.5625, 0.5,
    ]);
    expect(first?.entry.u).toBeLessThan(RUN_ON + 5.86);
    expect(leg.holes.filter((h) => h.direction.n === 0)).toHaveLength(1);
  });

  it('runs the template past the second bolt: its center + 9/32" + 3"', () => {
    // The flush cut reaches 5.853", and 3" past it is 8.853". The first bolt at 8.419" is inside
    // that. The second, at 12.276", starts within two widths (7") of it, so the template runs to
    // 12.276 + 0.281 + 3 = 15.558".
    const window = endWindow(leg, 0);
    expect(window.u0).toBe(0);
    expect(window.u1).toBeCloseTo((second?.entry.u as number) + 0.28125 + 3, 12);
    expect(window.u1).toBeCloseTo(15.5576, 4);
  });

  it('marks each center on the centerline, measured from the long point', () => {
    const sheet = endSheet(leg, 0);
    const circles = shapesOf(sheet, 'circle').sort((a, b) => a.at.x - b.at.x);
    expect(circles).toHaveLength(2);
    for (const [i, hole] of [first, second].entries()) {
      const c = circles[i];
      // The long point is at x = PAD; the reference edge is 3-1/2" below the far edge.
      expect(c?.at.x).toBeCloseTo(PAD + (hole?.entry.u as number), 12);
      expect(c?.at.y).toBeCloseTo(PAD + 3.5 - 1.75, 12);
      expect(c?.radius).toBe(0.28125);
      expect(c?.dashed).toBe(false);
    }
    expect(shapesOf(sheet, 'cross')).toHaveLength(2);
    expect(shapesOf(sheet, 'cross')[0]?.arm).toBeCloseTo(0.38125, 12);
  });

  it('notes the holes together and the edge hole it cannot mark', () => {
    const notes = notesOf(endSheet(leg, 0));
    expect(notes).toContain(
      '2 holes, 9/16" for a 1/2" bolt, drilled from the other face; prick the centers.',
    );
    expect(notes).toContain('Not marked here: 1 hole in an edge or end; see the cut detail.');
    const labels = shapesOf(endSheet(leg, 0), 'text').filter((t) => t.text === '9/16"');
    expect(labels).toHaveLength(2);
  });

  it('leaves holes outside the window off the template', () => {
    const sheet = endSheet(leg, 1);
    const { u0 } = endWindow(leg, 1);
    const inside = faceHoles(leg).filter((h) => h.at.u >= u0);
    expect(shapesOf(sheet, 'circle')).toHaveLength(inside.length);
  });
});

describe('the gusset’s bolt holes', () => {
  it('marks all four on the whole template', () => {
    const [sheet] = partTemplates(named(swing, 'Gusset'));
    expect(shapesOf(sheet as Sheet, 'circle')).toHaveLength(4);
    expect(notesOf(sheet as Sheet)).toContain('4 holes, 9/16" for a 1/2" bolt');
  });
});

describe('bored holes', () => {
  const stile = named(bench, 'Door stile');

  it('marks a hinge cup bored from the face shown, solid', () => {
    const holes = faceHoles(stile);
    expect(holes).toHaveLength(2);
    for (const h of holes) {
      expect(h.from).toBe('shown');
      expect(h.showsHere).toBe(true);
      expect(h.use).toBe('for a hinge cup');
    }
  });

  it('dashes a stopped hole bored from the other face', () => {
    const cup = stile.boredHoles[0] as Part['boredHoles'][number];
    const back: Part = {
      ...stile,
      boredHoles: [
        {
          ...cup,
          entry: { ...cup.entry, n: 0 },
          direction: { u: 0, v: 0, n: 1 },
        },
      ],
    };
    const [hole] = faceHoles(back);
    expect(hole?.from).toBe('other');
    expect(hole?.showsHere).toBe(false);
    const { shapes, notes } = markShapes(back, identity, 0, back.length);
    expect(shapes.find((s) => s.kind === 'circle')).toMatchObject({ dashed: true });
    expect(notes[0]).toContain('drilled from the other face, stopping short of this face (dashed)');
  });

  it('counts a hole bored into an end as unmarked', () => {
    const block = named(bench, 'End vise block');
    expect(faceHoles(block)).toEqual([]);
    expect(unmarkedNote(block)).toEqual([
      'Not marked here: 3 holes in an edge or end; see the cut detail.',
    ]);
  });
});

describe('dadoes and mortises', () => {
  it('draws a dado in the face shown solid and one in the other face dashed', () => {
    const partition = named(cabinet, 'Partition');
    const rects = faceRects(partition);
    expect(rects.map((r) => r.onShown).sort()).toEqual([false, true]);
    const { shapes, notes } = markShapes(partition, identity, 0, partition.length);
    const drawn = shapes.filter((s) => s.kind === 'rect');
    expect(drawn.map((s) => s.kind === 'rect' && s.dashed).sort()).toEqual([false, true]);
    // 10.4375 to 13.4375 along, 13.6875 to 14.5 across: the narrower side, 13/16", is its width;
    // 0.1875" deep is 3/16".
    expect(partition.dadoes.map((d) => d.depth)).toEqual([0.1875, 0.1875]);
    expect(notes).toContain('D1: dado, 13/16" wide, 3/16" deep, in the other face (dashed).');
    expect(notes).toContain('D2: dado, 13/16" wide, 3/16" deep, in this face.');
  });

  it('draws a mortise in a face and counts one in an edge as unmarked', () => {
    const leg = named(bench, 'Leg, front left');
    const rects = faceRects(leg);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ kind: 'mortise', u0: 27.625, u1: 30.125, v0: 1.25, v1: 1.75 });
    expect(unmarkedNote(leg)[0]).toContain('1 mortise in an edge or end');
    const { notes } = markShapes(leg, identity, 0, leg.length);
    expect(notes.find((n) => n.startsWith('M'))).toMatch(/^M\d: mortise, 2-1\/2" by 1\/2", /);
  });

  it('clips a dado to the window and leaves out one outside it', () => {
    const partition = named(cabinet, 'Partition');
    const { shapes } = markShapes(partition, identity, 0, 12);
    const rects = shapes.filter((s) => s.kind === 'rect');
    expect(rects).toHaveLength(2);
    for (const r of rects)
      if (r.kind === 'rect') expect(Math.max(...r.points.map((p) => p.x))).toBe(12);
    expect(markShapes(partition, identity, 0, 10).shapes.filter((s) => s.kind === 'rect')).toEqual(
      [],
    );
  });
});
