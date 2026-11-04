import { describe, expect, it } from 'vitest';
import { fitProblems } from '../fit/fit.ts';
import { cutDetail } from '../geometry/cutDetail.ts';
import type { Inventory } from '../inventory/tools.ts';
import { fillMethodText, METHODS } from '../knowledge/methods.ts';
import { hardwareList } from '../outputs/hardwareList.ts';
import { selectMethod } from '../steps/select.ts';
import { BRAND_NAMES, VERDICT_WORDS, withoutBrandExceptions } from '../testing.ts';
import {
  CupHinge,
  cupHingeFields,
  cupHingeIssues,
  cupHingeItem,
  cupHingePair,
} from './cupHinge.ts';
import { formValues, visibleFields } from './form.ts';
import { cutAndDrillOperations, type Operation } from './operations.ts';
import type { Part, Placement } from './types.ts';

// A made-up inset cup hinge, as an owner might enter it from a maker's instructions: a cup 1-3/8"
// across and 1/2" deep, its rim 3/16" in from the edge; a plate with two screws 1-1/4" apart, on a
// line 1-1/2" behind the closed door's back face; for doors 5/8" to 7/8" thick.
//
// The door is 24" long, 12" wide, and 3/4" thick, standing on end in a case whose front is at
// y = 0, with y running back and z up. Its front face is flush with the case's front (inset), its
// back face at y = 3/4". Its hinge edge, the reference edge, is 1/16" right of the case side's
// inner face at x = 0, and its bottom at z = 2". The case side is 30" tall, 16" deep, and 3/4"
// thick, from x = 0 left to x = −3/4", its reference edge at the front.
//
// By hand: each cup's center is 3/16 + 1-3/8 / 2 = 7/8" in from the hinge edge, at x = 1/16 + 7/8
// = 15/16", on the back face. The plate's screws are 1-1/2" behind that face, at y = 3/4 + 1-1/2 =
// 2-1/4" from the case's front, and 5/8" either side of each cup's height. Cups 3" and 21" up the
// door are at z = 5" and 23", so the screws are at 4-3/8" and 5-5/8", and 22-3/8" and 23-5/8", up
// the case side.

const hinge = CupHinge.parse({
  cupDiameter: 1.375,
  cupDepth: 0.5,
  cupFromEdge: 0.1875,
  plateSetback: 1.5,
  plateScrews: 2,
  plateScrewSpacing: 1.25,
  minThickness: 0.625,
  maxThickness: 0.875,
});

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const part = (
  id: string,
  size: { length: number; width: number; thickness: number },
  referenceEdge: string,
): Part => ({
  id,
  letter: id === 'door' ? 'A' : 'B',
  name: id,
  role: id,
  stock: { nominal: id, thickness: size.thickness, width: size.width, buyableFeet: [8] },
  quantity: 1,
  length: size.length,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge,
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
  boredHoles: [],
  hingePlates: [],
});

const doorPart = part('door', { length: 24, width: 12, thickness: 0.75 }, 'hinge edge');
const sidePart = part('side', { length: 30, width: 16, thickness: 0.75 }, 'front edge');

// Door: along up (+z), across from the hinge edge (+x), so through is +y, front to back.
const doorAt = (x: number): Placement => ({
  partId: 'door',
  instance: 0,
  origin: { x, y: 0, z: 2 },
  along: { x: 0, y: 0, z: 1 },
  across: { x: 1, y: 0, z: 0 },
  through: { x: 0, y: 1, z: 0 },
});
// Case side: along up, across from the front edge (+y), so through is −x: its near face (n = 0)
// is the inner face at x = 0.
const sideAt: Placement = {
  partId: 'side',
  instance: 0,
  origin: { x: 0, y: 0, z: 0 },
  along: { x: 0, y: 0, z: 1 },
  across: { x: 0, y: 1, z: 0 },
  through: { x: -1, y: 0, z: 0 },
};

const pair = (door = doorPart, at = doorAt(0.0625), h = hinge) =>
  cupHingePair(
    h,
    'hinges',
    { part: door, placement: at },
    { part: sidePart, placement: sideAt },
    { edge: 'reference', back: 'far', cups: [3, 21] },
  );

const item = cupHingeItem({ id: 'hinges', name: 'Concealed hinge', group: 'Hinges' }, hinge, 2);

function problemsOf(door: Part, side: Part, at = doorAt(0.0625), items = [item]) {
  return fitProblems({ parts: [door, side], placements: [at, sideAt] }, hardwareList(items)).map(
    (p) => p.message,
  );
}

const placed = () => {
  const { cups, plates } = pair();
  return {
    door: { ...doorPart, boredHoles: cups },
    side: { ...sidePart, hingePlates: plates },
  };
};

describe('a pair of concealed hinges', () => {
  it('bores each cup in the back face, and puts each plate opposite it on the case side', () => {
    const { cups, plates } = pair();
    expect(cups).toEqual(
      [3, 21].map((u) => ({
        use: 'for a hinge cup',
        diameter: 1.375,
        entry: { u, v: 0.875, n: 0.75 },
        direction: { u: 0, v: 0, n: -1 },
        depth: 0.5,
        through: false,
        hinge: 'hinges',
      })),
    );
    expect(plates).toEqual([
      {
        hardwareId: 'hinges',
        face: 'near',
        screws: [
          { u: 4.375, v: 2.25 },
          { u: 5.625, v: 2.25 },
        ],
      },
      {
        hardwareId: 'hinges',
        face: 'near',
        screws: [
          { u: 22.375, v: 2.25 },
          { u: 23.625, v: 2.25 },
        ],
      },
    ]);
    const { door, side } = placed();
    expect(problemsOf(door, side)).toEqual([]);
  });

  it('refuses a door edge that runs into the case side', () => {
    expect(() => pair(doorPart, doorAt(-0.25))).toThrow('inside its case side');
  });

  it('finds a plate moved off its cup, a cup moved off its edge, and a cup with no hinge listed', () => {
    const { door, side } = placed();
    const [first, second] = side.hingePlates;
    if (!first || !second) throw new Error('no plates');
    const raised = {
      ...side,
      hingePlates: [
        { ...first, screws: first.screws.map((s) => ({ ...s, u: s.u + 0.125 })) },
        second,
      ],
    };
    expect(problemsOf(door, raised)).toEqual([
      "The cup for hinges at u 3 meets no plate where the hinge's sizes put it.",
      'A plate for hinges meets no cup.',
    ]);
    // A cup 1/16" farther from the edge still lines up with its plate's height and depth, but
    // its rim is 1/4" from the edge, not 3/16".
    const moved = {
      ...door,
      boredHoles: door.boredHoles.map((h) => ({ ...h, entry: { ...h.entry, v: 0.9375 } })),
    };
    expect(problemsOf(moved, side)).toEqual([
      "The cup for hinges at u 3 has its rim 0.25 from the edge toward its plate, not the hinge's 0.1875.",
      "The cup for hinges at u 21 has its rim 0.25 from the edge toward its plate, not the hinge's 0.1875.",
    ]);
    expect(problemsOf(door, side, doorAt(0.0625), [])).toEqual([
      'The cup for hinges at u 3 has no hinge in the hardware list.',
      'The cup for hinges at u 21 has no hinge in the hardware list.',
      'A plate for hinges meets no cup.',
      'A plate for hinges meets no cup.',
    ]);
  });

  it('pairs each cup with the plate beside it when two doors hang from opposite sides', () => {
    // A second door, the first turned end for end about y: x from 12-3/16 to 24-3/16, its hinge
    // edge 1/16 from a second side whose inner face is at x = 24-1/4. Its cups are at the same
    // heights as the first door's, so a plate on either side lines up with a cup on both doors.
    const turned: Placement = {
      partId: 'door',
      instance: 1,
      origin: { x: 24.1875, y: 0, z: 26 },
      along: { x: 0, y: 0, z: -1 },
      across: { x: -1, y: 0, z: 0 },
      through: { x: 0, y: 1, z: 0 },
    };
    const farSideAt: Placement = {
      partId: 'far-side',
      instance: 0,
      origin: { x: 24.25, y: 0, z: 30 },
      along: { x: 0, y: 0, z: -1 },
      across: { x: 0, y: 1, z: 0 },
      through: { x: 1, y: 0, z: 0 },
    };
    const farSide = { ...sidePart, id: 'far-side' };
    const { door, side } = placed();
    const second = cupHingePair(
      hinge,
      'hinges',
      { part: doorPart, placement: turned },
      { part: farSide, placement: farSideAt },
      { edge: 'reference', back: 'far', cups: [3, 21] },
    );
    const both = (plates: typeof second.plates) =>
      fitProblems(
        {
          parts: [door, side, { ...farSide, hingePlates: plates }],
          placements: [doorAt(0.0625), turned, sideAt, farSideAt],
        },
        hardwareList([
          cupHingeItem({ id: 'hinges', name: 'Concealed hinge', group: 'Hinges' }, hinge, 4),
        ]),
      ).map((p) => p.message);
    expect(both(second.plates)).toEqual([]);
    // The far side's first plate raised 1/8: its cup's only fit is the near side's plate across
    // the pair, so its rim is reported far from the edge, and that plate meets two cups.
    const [first, rest] = second.plates;
    if (!first || !rest) throw new Error('no plates');
    const raised = { ...first, screws: first.screws.map((q) => ({ ...q, u: q.u + 0.125 })) };
    expect(both([raised, rest])).toEqual([
      "The cup for hinges at u 3 has its rim 10.4375 from the edge toward its plate, not the hinge's 0.1875.",
      'A plate for hinges meets 2 cups.',
      'A plate for hinges meets no cup.',
    ]);
  });

  it('finds a door thicker than the hinge allows', () => {
    // A 1" door: the cups and plates are worked out for it, but the hinge stops at 7/8".
    const thick = { ...doorPart, stock: { ...doorPart.stock, thickness: 1 } };
    const { cups, plates } = pair(thick);
    expect(
      problemsOf({ ...thick, boredHoles: cups }, { ...sidePart, hingePlates: plates }),
    ).toEqual([
      'The cup for hinges at u 3 is in a part 1 thick, outside the 0.625 to 0.875 the hinge allows.',
      'The cup for hinges at u 21 is in a part 1 thick, outside the 0.625 to 0.875 the hinge allows.',
    ]);
  });
});

describe("a hinge's sizes", () => {
  it('refuses a door thicker or thinner than the hinge is made for', () => {
    expect(cupHingeIssues(hinge, 'hinge', 0.75, 'doorThickness')).toEqual([]);
    expect(cupHingeIssues(hinge, 'hinge', 0.875, 'doorThickness')).toEqual([]);
    expect(cupHingeIssues(hinge, 'hinge', 1, 'doorThickness')).toEqual([
      {
        code: 'hinge-too-thick',
        message: 'The door is 1" thick, but the hinge is made for doors up to 7/8".',
        params: ['doorThickness', 'hinge.maxThickness'],
      },
    ]);
    expect(cupHingeIssues(hinge, 'hinge', 0.5, 'doorThickness').map((i) => i.code)).toEqual([
      'hinge-too-thin',
      'hinge-cup-depth',
    ]);
    const muddled = { ...hinge, minThickness: 1, plateScrewSpacing: undefined };
    expect(cupHingeIssues(muddled, 'hinge', 0.75, 'doorThickness').map((i) => i.code)).toEqual([
      'hinge-thickness-range',
      'hinge-plate-spacing',
    ]);
  });

  it('asks for each size, confirmed, saying where to read it', () => {
    const fields = cupHingeFields('hinge');
    expect(fields.map((f) => f.path)).toEqual([
      'hinge.cupDiameter',
      'hinge.cupDepth',
      'hinge.cupFromEdge',
      'hinge.plateSetback',
      'hinge.plateScrews',
      'hinge.plateScrewSpacing',
      'hinge.minThickness',
      'hinge.maxThickness',
    ]);
    for (const f of fields) {
      expect(f.confirmed, f.path).toBe(true);
      expect(f.help, f.path).toMatch(/instructions|diagram|specifications|parts list/);
      expect(f.help).not.toMatch(VERDICT_WORDS);
      expect(withoutBrandExceptions(f.help ?? '')).not.toMatch(BRAND_NAMES);
    }
    const sections = [{ title: 'Hinges', fields }];
    const shown = (screws: number) =>
      visibleFields(
        sections,
        formValues(sections, { hinge: { ...hinge, plateScrews: screws } }),
      ).map((f) => f.path);
    expect(shown(2)).toContain('hinge.plateScrewSpacing');
    expect(shown(1)).not.toContain('hinge.plateScrewSpacing');
  });

  it('is listed with the sizes entered for it, and its line carries them for the fit check', () => {
    expect(item.notes).toEqual([
      'Inset hinges for a door 5/8" to 7/8" thick, each with its mounting plate.',
      'Bore each cup 1-3/8" across and 1/2" deep, 3/16" in from the edge, as the maker says.',
      'Screw each plate to the case side with two screws 1-1/4" apart, 1-1/2" behind the door\'s back face, using the screws the maker says.',
    ]);
    expect(hardwareList([item])[0]?.hinge).toEqual({ ...hinge, item: 'hinges' });
  });
});

describe('boring the cups and screwing on the plates', () => {
  const { door, side } = placed();
  const ops = cutAndDrillOperations([door, side], [item]);
  const cups = ops.find((o) => o.type === 'hinge-cups');
  const plates = ops.find((o) => o.type === 'hinge-plates');
  if (!cups || !plates) throw new Error('no hinge operations');

  it('bores the cups as one operation and screws on the plates as another', () => {
    // Each cup's center is 7/8" from the hinge edge, nearer than either end (3" away), so a
    // fence 7/8" from the bit's center leaves the rim 7/8 − 11/16 = 3/16" in.
    expect(cups).toEqual({
      id: 'door/bore-0',
      type: 'hinge-cups',
      partId: 'door',
      count: 2,
      holes: [0, 1],
      diameter: 1.375,
      depth: 0.5,
      fromEdge: 0.875,
      hardwareId: 'hinges',
      edgeToCenter: 0.875,
      cupFromEdge: 0.1875,
    } satisfies Operation);
    expect(plates).toEqual({
      id: 'side/hinge-plates-hinges',
      type: 'hinge-plates',
      partId: 'side',
      count: 2,
      hardwareId: 'hinges',
      screws: 2,
    } satisfies Operation);
    expect(ops.some((o) => o.type === 'stopped-bore')).toBe(false);
  });

  it('bores with a drill press and a fence, or a jig in a drill', () => {
    const kit = (...tools: [string, Record<string, number>][]): Inventory => ({
      tools: [['tape-measure', {}], ['combination-square', {}], ['clamps', {}], ...tools].map(
        ([toolTypeId, capabilities]) => ({
          toolTypeId: toolTypeId as string,
          capabilities: capabilities as Record<string, number>,
        }),
      ),
    });
    const press: [string, Record<string, number>] = ['drill-press', { throat: 4, quillTravel: 3 }];
    const forstner: [string, Record<string, number>] = ['forstner-bits', { reach: 2 }];
    const drill: [string, Record<string, number>] = ['drill-driver', {}];
    const jig: [string, Record<string, number>] = ['hinge-jig', {}];
    expect(selectMethod(cups, kit(press, forstner, drill, jig)).chosen?.id).toBe(
      'hinge-cups-drill-press',
    );
    const withJig = selectMethod(cups, kit(drill, jig));
    expect(withJig.chosen?.id).toBe('hinge-cups-jig');
    expect(withJig.suggestions.map((s) => s.methodId)).toContain('hinge-cups-drill-press');
    // A plain Forstner bit in a hand drill is not offered for a cup: it needs the jig to hold it.
    expect(selectMethod(cups, kit(drill, forstner)).chosen).toBeUndefined();
    expect(selectMethod(plates, kit(drill)).chosen?.id).toBe('hinge-plates-drill-driver');
  });

  it("fills each method's text with the cups' and plates' sizes", () => {
    const press = METHODS.find((m) => m.id === 'hinge-cups-drill-press');
    expect(press?.setup.map((t) => fillMethodText(t, cups))).toContain(
      'Clamp a straight board to the table as a fence, 7/8" from the bit’s center, so each cup’s rim is 3/16" in from the edge.',
    );
    const jig = METHODS.find((m) => m.id === 'hinge-cups-jig');
    expect(jig?.setup.map((t) => fillMethodText(t, cups))).toContain(
      'Fit the jig’s 1-3/8" bit in the drill, and set its depth stop for a cup 1/2" deep.',
    );
    const screwOn = METHODS.find((m) => m.id === 'hinge-plates-drill-driver');
    expect(screwOn?.technique.map((t) => fillMethodText(t, plates))).toEqual([
      'Drill a pilot hole at each mark, as deep as the screws go.',
      'Set a plate on its marks the way the maker’s diagram shows, and drive its 2 screws until each head is snug.',
      'Screw on 2 plates this way.',
    ]);
  });

  it("draws the cups and the plates' screws in the cut details, and says where they go", () => {
    expect(cutDetail(door).notes).toContain(
      'Bore 2 1-3/8" holes for a hinge cup, 1/2" deep, into the face shown, 7/8" from the hinge edge, at 3", 21" from the first end.',
    );
    expect(cutDetail(side).notes).toEqual(
      expect.arrayContaining([
        'Hinge plate on the back face (dashed), its screws at 4-3/8" from the first end and 2-1/4" from the front edge; 5-5/8" from the first end and 2-1/4" from the front edge.',
        'Hinge plate on the back face (dashed), its screws at 22-3/8" from the first end and 2-1/4" from the front edge; 23-5/8" from the first end and 2-1/4" from the front edge.',
      ]),
    );
    // Two crosses of two lines for each plate's two screws.
    const dashed = cutDetail(side).primitives.filter(
      (p) => p.kind === 'line' && p.role === 'hidden',
    );
    expect(dashed).toHaveLength(8);
  });
});
