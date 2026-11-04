import { describe, expect, it } from 'vitest';
import { fitProblems } from '../fit/fit.ts';
import { BRAND_NAMES, VERDICT_WORDS, withoutBrandExceptions } from '../testing.ts';
import { formValues, visibleFields } from './form.ts';
import type { Part } from './types.ts';
import { ViseScrew, viseHoles, viseIssues, viseScrewFields, viseScrewItem } from './viseScrew.ts';

// A made-up vise screw, as an owner might enter it from a maker's instructions: a 1-1/8" hole for
// the screw, opening 12", two guide bars in 13/16" holes 4-1/2" either side of the screw, and the
// nut held by 4 wood screws. Its jaw is 2-1/2" thick, 20" long, and 7" wide, the screw centered
// at 10" along and 3-1/2" across, the guide bars along its length.

const screw = ViseScrew.parse({
  screwHole: 1.125,
  maxOpening: 12,
  guides: 2,
  guideHole: 0.8125,
  guideFromScrew: 4.5,
  mountingScrews: 4,
});
const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const jaw = (boredHoles: Part['boredHoles']): Part => ({
  id: 'jaw',
  letter: 'A',
  name: 'Jaw',
  role: 'jaw',
  stock: { nominal: 'jaw', thickness: 2.5, width: 7, buyableFeet: [8] },
  quantity: 1,
  length: 20,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'top edge',
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  dovetails: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  boredHoles,
});
const placed = (part: Part) =>
  fitProblems({
    parts: [part],
    placements: [
      {
        partId: part.id,
        instance: 0,
        origin: { x: 0, y: 0, z: 0 },
        along: { x: 1, y: 0, z: 0 },
        across: { x: 0, y: 1, z: 0 },
        through: { x: 0, y: 0, z: 1 },
      },
    ],
  });

describe('a vise screw', () => {
  it('bores its screw and guide bars through the jaw', () => {
    const holes = viseHoles(screw, {
      center: { u: 10, v: 3.5 },
      thickness: 2.5,
      guidesAlong: 'u',
    });
    // The guide bars at 10 + 4-1/2 = 14-1/2 and 10 − 4-1/2 = 5-1/2.
    expect(holes.map((h) => [h.use, h.diameter, h.entry.u, h.entry.v, h.depth, h.through])).toEqual(
      [
        ['for the screw', 1.125, 10, 3.5, 2.5, true],
        ['for a guide bar', 0.8125, 14.5, 3.5, 2.5, true],
        ['for a guide bar', 0.8125, 5.5, 3.5, 2.5, true],
      ],
    );
    expect(placed(jaw(holes))).toEqual([]);
  });

  it('bores one guide bar on the side toward larger values, or none', () => {
    const one = viseHoles(
      { ...screw, guides: 1 },
      { center: { u: 10, v: 3.5 }, thickness: 2.5, guidesAlong: 'v' },
    );
    expect(one.map((h) => [h.entry.u, h.entry.v])).toEqual([
      [10, 3.5],
      [10, 8],
    ]);
    // 8" across a 7" jaw: the fit check finds the guide bar's hole outside it.
    expect(placed(jaw(one)).map((p) => p.message)).toEqual([
      'A 0.8125 hole for a guide bar at u 10, v 8, n 0 runs past the part.',
    ]);
    const none = viseHoles(
      { screwHole: 1, maxOpening: 8, guides: 0, mountingScrews: 3 },
      { center: { u: 10, v: 3.5 }, thickness: 2.5, guidesAlong: 'u' },
    );
    expect(none).toHaveLength(1);
  });

  it('refuses an opening wider than the screw opens', () => {
    expect(viseIssues(screw, 'frontVise', 12)).toEqual([]);
    expect(viseIssues(screw, 'frontVise', 12.0625)).toEqual([
      {
        code: 'vise-opening',
        message: 'The plan opens this vise 12-1/16", but its screw opens only 12".',
        params: ['frontVise.maxOpening'],
      },
    ]);
    const unsized = { ...screw, guideHole: undefined };
    expect(viseIssues(unsized, 'frontVise', 6).map((i) => i.code)).toEqual(['vise-guides']);
  });

  it('is listed with the sizes entered for it', () => {
    expect(
      viseScrewItem({ id: 'front-screw', name: 'Vise screw', group: 'Vise hardware' }, screw),
    ).toEqual({
      id: 'front-screw',
      name: 'Vise screw',
      group: 'Vise hardware',
      quantity: 1,
      structural: false,
      notes: [
        'Bore 1-1/8" through both jaws for the screw, as its maker says.',
        'Opens to 12".',
        'Two guide bars: bore 13/16" for each, 4-1/2" from the screw\'s center.',
        'Mount the nut with 4 wood screws, of the size its maker says.',
      ],
    });
  });
});

describe('its form fields', () => {
  const fields = viseScrewFields('frontVise');

  it('are confirmed by the owner, each saying where to read its value', () => {
    expect(fields.map((f) => f.path)).toEqual([
      'frontVise.screwHole',
      'frontVise.maxOpening',
      'frontVise.guides',
      'frontVise.guideHole',
      'frontVise.guideFromScrew',
      'frontVise.mountingScrews',
    ]);
    for (const f of fields) {
      expect(f.confirmed, f.path).toBe(true);
      expect(f.help, f.path).toMatch(/instructions|maker|box|flange/);
    }
  });

  it('ask for the guide bars only when there are some', () => {
    const shown = (guides: string) =>
      visibleFields([{ title: 'Vise', fields }], {
        ...formValues([{ title: 'Vise', fields }], {}),
        'frontVise.guides': guides,
      }).map((f) => f.path);
    expect(shown('0')).not.toContain('frontVise.guideHole');
    expect(shown('2')).toContain('frontVise.guideFromScrew');
  });

  it('name no brands and no verdicts', () => {
    const text = JSON.stringify([fields, viseScrewItem({ id: 'a', name: 'a', group: 'a' }, screw)]);
    expect(withoutBrandExceptions(text)).not.toMatch(BRAND_NAMES);
    expect(text).not.toMatch(VERDICT_WORDS);
  });
});
