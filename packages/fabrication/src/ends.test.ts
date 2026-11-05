import { geometry, type Part } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { endSheet, endWindow, partTemplates, RUN_ON, shapedReach } from './ends.ts';
import { exampleParts } from './parts.ts';
import { PAD, type Shape, type Sheet } from './sheet.ts';
import { tile } from './tile.ts';

const RAD = Math.PI / 180;
const TEMPLATE_IDS = ['swing-set-a-frame', 'record-cabinet', 'workbench'] as const;

const swingParts = exampleParts('swing-set-a-frame');
const byName = (name: string) => swingParts.find((p) => p.name.startsWith(name)) as Part;

function shapesOf<K extends Shape['kind']>(sheet: Sheet, kind: K): Extract<Shape, { kind: K }>[] {
  return sheet.shapes.filter((s): s is Extract<Shape, { kind: K }> => s.kind === kind);
}
const notesOf = (sheet: Sheet) =>
  shapesOf(sheet, 'text')
    .map((t) => t.text)
    .join(' ');

describe('a 20° level cut on a 3-1/2" leg, worked by hand', () => {
  // The swing set's back leg without its flush cut or bolt holes, 100" long. Both ends are level cuts at 20°,
  // parallel: the first end's long point is on the reference edge, the second end's on the far
  // edge. 3.5 × tan 20° = 1.2738958: the short point is that far from the square line.
  const example = byName('Back leg');
  const leg: Part = { ...example, length: 100, tapers: [], holes: [] };
  const run = 3.5 * Math.tan(20 * RAD);

  it('starts from the worked example', () => {
    expect(example.stock.width).toBe(3.5);
    expect(example.ends.map((e) => e.setting)).toEqual([20, 20]);
    expect(example.endsParallel).toBe(true);
    expect(run).toBeCloseTo(1.2738958, 7);
  });

  it('reaches from the long point to the short point at each end', () => {
    expect(shapedReach(leg, 0)).toBeCloseTo(1.2738958, 7);
    expect(shapedReach(leg, 1)).toBeCloseTo(1.2738958, 7);
  });

  it('draws the first end from its long point, with a 3" run past the short point', () => {
    const sheet = endSheet(leg, 0);
    const window = endWindow(leg, 0);
    expect(window.u0).toBe(0);
    expect(window.u1).toBeCloseTo(run + RUN_ON, 12);
    const [dot] = shapesOf(sheet, 'dot');
    // The long point is on the reference edge, at the bottom of the drawing.
    expect(dot?.at.x).toBeCloseTo(PAD, 12);
    expect(dot?.at.y).toBeCloseTo(PAD + 3.5, 12);
    const [square] = shapesOf(sheet, 'square');
    expect(square?.points.map((p) => [p.x, p.y])).toEqual([
      [PAD, PAD + 3.5],
      [PAD, PAD],
    ]);
    const points = shapesOf(sheet, 'outline').flatMap((o) => o.points);
    const short = points.find((p) => Math.abs(p.y - PAD) < 1e-9 && p.x < PAD + run + 1e-6);
    expect(short?.x).toBeCloseTo(PAD + run, 12);
    expect(notesOf(sheet)).toContain('Long point on the reference edge (the dot)');
    // 1.2738958" is 20.38 sixteenths: 1-1/4".
    expect(notesOf(sheet)).toContain(
      'the cut meets the far edge 1-1/4" along from the dashed line',
    );
    expect(notesOf(sheet)).toContain('saw at 20.0°, 70.0° to the edge');
  });

  it('draws the second end with its long point on the far edge', () => {
    const sheet = endSheet(leg, 1);
    const shown = run + RUN_ON;
    const [dot] = shapesOf(sheet, 'dot');
    expect(dot?.at.x).toBeCloseTo(PAD + shown, 12);
    expect(dot?.at.y).toBeCloseTo(PAD, 12);
    const points = shapesOf(sheet, 'outline').flatMap((o) => o.points);
    const bottomRight = Math.max(
      ...points.filter((p) => Math.abs(p.y - PAD - 3.5) < 1e-9).map((p) => p.x),
    );
    expect(bottomRight).toBeCloseTo(PAD + shown - run, 12);
    expect(notesOf(sheet)).toContain('Long point on the far edge');
    expect(notesOf(sheet)).toContain('the cut meets the reference edge 1-1/4"');
  });

  it('breaks off with a zigzag and leaves the break out of the cut line', () => {
    const sheet = endSheet(leg, 0);
    const x = PAD + run + RUN_ON;
    const [zigzag] = shapesOf(sheet, 'break');
    expect(zigzag?.points[0]?.x).toBeCloseTo(x, 12);
    for (const outline of shapesOf(sheet, 'outline')) {
      expect(outline.closed).toBe(false);
      for (let i = 1; i < outline.points.length; i++) {
        const a = outline.points[i - 1];
        const b = outline.points[i];
        const alongBreak = Math.abs((a?.x ?? 0) - x) < 1e-9 && Math.abs((b?.x ?? 0) - x) < 1e-9;
        expect(alongBreak).toBe(false);
      }
    }
    expect(notesOf(sheet)).toContain('The part continues past the break: 100" long');
  });

  it('refuses a square end', () => {
    const square: Part = {
      ...leg,
      ends: [leg.ends[0], { ...leg.ends[1], setting: 0 }],
      endsParallel: false,
    };
    expect(shapedReach(square, 1)).toBe(0);
    expect(() => endSheet(square, 1)).toThrow(/square/);
  });
});

describe('a leg with its flush cut', () => {
  const leg = byName('Back leg');
  const [taper] = leg.tapers;

  it('reaches to the start of the flush cut, past the level cut', () => {
    expect(taper?.description).toBe('Flush cut');
    expect(shapedReach(leg, 0)).toBe(taper?.start.u);
  });

  it('keeps the blank’s long point on the sheet and draws the cut-away corner dashed', () => {
    const sheet = endSheet(leg, 0);
    const [dot] = shapesOf(sheet, 'dot');
    expect(dot?.at.x).toBeCloseTo(PAD, 12);
    const [waste] = shapesOf(sheet, 'waste');
    expect(waste?.points).toHaveLength(3);
    expect(waste?.points[1]?.x).toBeCloseTo(PAD, 12);
    expect(notesOf(sheet)).toContain('on the board before the flush cut');
  });
});

describe('every template example', () => {
  const parts = TEMPLATE_IDS.flatMap((id) => exampleParts(id).map((part) => ({ id, part })));
  const shaped = parts.filter(({ part }) => shapedReach(part, 0) > 0 || shapedReach(part, 1) > 0);

  it('has shaped ends to template', () => {
    expect(shaped.length).toBeGreaterThan(10);
  });

  it.each(shaped.map(({ id, part }) => [id, part.letter, part] as const))(
    '%s %s: each end template matches core’s outline where it shows it',
    (_id, _letter, part) => {
      const outline = geometry.partOutline(part);
      const maxV = Math.max(...outline.map((p) => p.v));
      for (const end of [0, 1] as const) {
        if (shapedReach(part, end) === 0) continue;
        const { u0, u1 } = endWindow(part, end);
        const points = shapesOf(endSheet(part, end), 'outline').flatMap((o) => o.points);
        const inside = outline.filter((p) => p.u >= u0 - 1e-9 && p.u <= u1 + 1e-9);
        expect(inside.length).toBeGreaterThan(0);
        for (const p of inside) {
          const x = PAD + (p.u - u0);
          const y = PAD + (maxV - p.v);
          expect(points.some((q) => Math.abs(q.x - x) < 1e-9 && Math.abs(q.y - y) < 1e-9)).toBe(
            true,
          );
        }
        for (const q of points) {
          expect(q.x).toBeGreaterThanOrEqual(PAD - 1e-9);
          expect(q.x).toBeLessThanOrEqual(PAD + (u1 - u0) + 1e-9);
        }
      }
    },
  );

  it('prints the gusset whole and the crossbar and legs as their ends', () => {
    expect(partTemplates(byName('Gusset'))).toHaveLength(1);
    expect(partTemplates(byName('Gusset'))[0]?.title).not.toContain(' end ');
    expect(partTemplates(byName('Crossbar')).map((s) => s.title)).toEqual([
      expect.stringContaining('left end'),
      expect.stringContaining('right end'),
    ]);
    expect(partTemplates(byName('Back leg'))).toHaveLength(2);
  });

  it('keeps every note inside the first page across', () => {
    // Notes wrap at 7" from x = 1/4", and a sheet that spans pages starts at the first page's
    // edge, so even at the estimate of 0.08" a character no note crosses the 7-1/2" trim line.
    for (const { part } of shaped) {
      for (const sheet of partTemplates(part)) {
        const t = tile(sheet.size);
        if (t.columns > 1) expect(t.offset.x).toBe(0);
        for (const note of shapesOf(sheet, 'text').filter((s) => s.size === 0.16)) {
          expect(note.at.x + t.offset.x + note.text.length * 0.08).toBeLessThanOrEqual(7.5);
        }
      }
    }
  });

  it('makes no template for a part with two square ends', () => {
    const plain = parts.filter(
      ({ part }) => shapedReach(part, 0) === 0 && shapedReach(part, 1) === 0,
    );
    expect(plain.length).toBeGreaterThan(0);
    for (const { part } of plain) expect(partTemplates(part)).toEqual([]);
  });
});
