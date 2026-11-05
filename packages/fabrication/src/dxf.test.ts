import { geometry, type Part } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { LAYERS, partDxf } from './dxf.ts';
import { faceHoles } from './marks.ts';
import { exampleParts } from './parts.ts';

const RAD = Math.PI / 180;

type Group = [number, string];

/** The file as code/value pairs, checking each code is a whole number. */
function groups(text: string): Group[] {
  const lines = text.split('\n');
  expect(lines.at(-1)).toBe('');
  lines.pop();
  expect(lines.length % 2).toBe(0);
  const out: Group[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = lines[i] as string;
    expect(code).toMatch(/^-?\d+$/);
    out.push([Number(code), lines[i + 1] as string]);
  }
  return out;
}

/** Entities as lists of groups, each starting at its 0 group. */
function entities(gs: readonly Group[]): Group[][] {
  const start = gs.findIndex(
    ([c, v], i) => c === 0 && v === 'SECTION' && gs[i + 1]?.[1] === 'ENTITIES',
  );
  expect(start).toBeGreaterThanOrEqual(0);
  const out: Group[][] = [];
  for (const g of gs.slice(start + 2)) {
    if (g[0] === 0) {
      if (g[1] === 'ENDSEC') break;
      out.push([g]);
    } else out.at(-1)?.push(g);
  }
  return out;
}

const value = (e: readonly Group[], code: number) => e.find(([c]) => c === code)?.[1];
const num = (e: readonly Group[], code: number) => Number(value(e, code));

/** A minimal reader: the closed outline and the circles, by layer. */
function read(text: string) {
  const gs = groups(text);
  const es = entities(gs);
  const outlines: { layer: string; closed: boolean; points: { x: number; y: number }[] }[] = [];
  const circles: { layer: string; x: number; y: number; r: number }[] = [];
  for (let i = 0; i < es.length; i++) {
    const e = es[i] as Group[];
    const kind = e[0]?.[1];
    if (kind === 'POLYLINE') {
      const points: { x: number; y: number }[] = [];
      let j = i + 1;
      for (; es[j]?.[0]?.[1] === 'VERTEX'; j++) {
        const v = es[j] as Group[];
        points.push({ x: num(v, 10), y: num(v, 20) });
      }
      expect(es[j]?.[0]?.[1]).toBe('SEQEND');
      outlines.push({ layer: value(e, 8) as string, closed: (num(e, 70) & 1) === 1, points });
      i = j;
    } else if (kind === 'CIRCLE') {
      circles.push({ layer: value(e, 8) as string, x: num(e, 10), y: num(e, 20), r: num(e, 40) });
    } else {
      throw new Error(`Unexpected entity ${kind}`);
    }
  }
  return { groups: gs, outlines, circles };
}

const swing = exampleParts('swing-set-a-frame');
const gusset = swing.find((p) => p.name === 'Gusset') as Part;

describe('the file', () => {
  const text = partDxf(gusset);
  const { groups: gs } = read(text);

  it('labels itself R12 and in inches', () => {
    expect(gs.slice(0, 7)).toEqual([
      [0, 'SECTION'],
      [2, 'HEADER'],
      [9, '$ACADVER'],
      [1, 'AC1009'],
      [9, '$INSUNITS'],
      [70, '1'],
      [0, 'ENDSEC'],
    ]);
  });

  it('ends its sections and the file', () => {
    expect(gs.slice(-2)).toEqual([
      [0, 'ENDSEC'],
      [0, 'EOF'],
    ]);
    expect(gs.filter(([c, v]) => c === 0 && v === 'SECTION')).toHaveLength(2);
    expect(gs.filter(([c, v]) => c === 0 && v === 'ENDSEC')).toHaveLength(2);
  });

  it('marks the polyline as having vertices that follow, at elevation 0', () => {
    const [polyline] = entities(gs);
    expect(polyline).toEqual([
      [0, 'POLYLINE'],
      [8, LAYERS.outline],
      [66, '1'],
      [10, '0'],
      [20, '0'],
      [30, '0'],
      [70, '1'],
    ]);
  });
});

describe('a 20" gusset, worked by hand', () => {
  // 7.25 × tan 20° = 2.638784: the far edge runs from there to 20 − 2.638784 = 17.361216.
  const part: Part = { ...gusset, length: 20 };
  const { outlines, circles } = read(partDxf(part));

  it('writes one closed outline with the trapezoid’s corners, unrounded, in inches', () => {
    expect(outlines).toHaveLength(1);
    const [outline] = outlines;
    expect(outline?.closed).toBe(true);
    expect(outline?.layer).toBe('OUTLINE');
    const p = outline?.points ?? [];
    expect(p).toHaveLength(4);
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[1]).toEqual({ x: 20, y: 0 });
    expect(p[2]?.x).toBeCloseTo(17.361216, 6);
    expect(p[2]?.y).toBe(7.25);
    expect(p[3]?.x).toBeCloseTo(2.638784, 6);
    expect(p[3]?.x).toBe(7.25 * Math.tan(20 * RAD));
  });

  it('writes its four bolt holes as 9/32" radius circles through the part', () => {
    expect(circles).toHaveLength(4);
    for (const c of circles) {
      expect(c.layer).toBe('THROUGH_HOLES');
      expect(c.r).toBe(0.28125);
    }
  });
});

describe('every part of every template example', () => {
  const parts = (['swing-set-a-frame', 'record-cabinet', 'workbench'] as const).flatMap((id) =>
    exampleParts(id).map((part) => [id, part.letter, part] as const),
  );

  it.each(parts)('%s %s reads back as core’s outline and holes', (_id, _letter, part) => {
    const { outlines, circles } = read(partDxf(part));
    expect(outlines).toHaveLength(1);
    expect(outlines[0]?.points).toEqual(
      geometry.partOutline(part).map((p) => ({ x: p.u, y: p.v })),
    );
    const holes = faceHoles(part);
    expect(circles.map((c) => [c.x, c.y, c.r * 2])).toEqual(
      holes.map((h) => [h.at.u, h.at.v, h.diameter]),
    );
  });

  it('puts stopped holes on their own layers', () => {
    const top = exampleParts('workbench').find((p) => p.name === 'Top') as Part;
    const stopped = top.boredHoles.filter((h) => !h.through);
    // Dog holes bored part way into the top from the face shown.
    expect(stopped.length).toBeGreaterThan(0);
    expect(stopped.every((h) => h.entry.n === top.stock.thickness)).toBe(true);
    const layerAt = (circles: ReturnType<typeof read>['circles'], u: number, v: number) =>
      circles.find((c) => c.x === u && c.y === v)?.layer;
    const { circles } = read(partDxf(top));
    for (const h of top.boredHoles) {
      expect(layerAt(circles, h.entry.u, h.entry.v)).toBe(
        h.through ? LAYERS.through : LAYERS.stopped,
      );
    }
    const back: Part = {
      ...top,
      boredHoles: stopped.map((h) => ({
        ...h,
        entry: { ...h.entry, n: 0 },
        direction: { u: 0, v: 0, n: 1 },
      })),
    };
    expect(new Set(read(partDxf(back)).circles.map((c) => c.layer))).toEqual(
      new Set([LAYERS.back]),
    );
  });
});
