import type { Part, Placement } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import type { PlacedPart } from './boltedLap.ts';
import { housedEnd, housingPlane } from './housedEnd.ts';
import { trim } from './trim.ts';

// Hand-checked: a 3/4" side, 30" tall and 11-1/4" deep, standing along z with its thickness from
// x = 0 to 0.75 and its front edge at y = 0. A 3/4" shelf, 11-1/4" deep, runs along x with its
// bottom face at z = 10, its first end housed 1/4" deep in the side's far face (x = 0.75).

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const panel = (id: string, length: number, over: Partial<Part> = {}): Part => ({
  id,
  letter: 'A',
  name: id,
  role: id,
  stock: { nominal: '3/4', thickness: 0.75, width: 11.25, buyableFeet: [8] },
  quantity: 1,
  length,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'front edge',
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
  mortises: [],
  tenons: [],
  screwHoles: [],
  grooves: [],
  rabbets: [],
  recesses: [],
  ...over,
});
const placement = (partId: string, p: Omit<Placement, 'partId' | 'instance'>): Placement => ({
  partId,
  instance: 0,
  ...p,
});
const side: PlacedPart = {
  part: panel('side', 30),
  placement: placement('side', {
    origin: { x: 0, y: 0, z: 0 },
    along: { x: 0, y: 0, z: 1 },
    across: { x: 0, y: 1, z: 0 },
    through: { x: 1, y: 0, z: 0 },
  }),
};
const shelfMember = (z = 10) => ({
  along: { x: 1, y: 0, z: 0 },
  across: { x: 0, y: 1, z: 0 },
  through: { x: 0, y: 0, z: 1 },
  referenceEdge: { x: 0, y: 0, z },
  width: 11.25,
});
/** The shelf trimmed to the dado's bottom at its first end and to x = 20 at its second. */
function shelf(z = 10, bottom = housingPlane(side, 'far', 0.25)): PlacedPart {
  const member = shelfMember(z);
  const cut = trim(member, [bottom, { point: { x: 20, y: 0, z: 0 }, normal: member.along }]);
  if (!cut.ok) throw new Error(cut.message);
  return {
    part: panel('shelf', cut.length),
    placement: placement('shelf', { ...member, origin: cut.origin }),
  };
}

describe('housingPlane', () => {
  it("is the dado's depth inside the face", () => {
    expect(housingPlane(side, 'far', 0.25)).toEqual({
      point: { x: 0.5, y: 0, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
    });
    expect(housingPlane(side, 'near', 0.25).point).toEqual({ x: 0.25, y: 0, z: 0 });
  });

  it('lengthens a part trimmed to it by the depth: 20 − 0.5 = 19.5', () => {
    expect(shelf().part.length).toBe(19.5);
    expect(shelf().placement.origin).toEqual({ x: 0.5, y: 0, z: 10 });
  });
});

describe('housedEnd', () => {
  it("makes the dado the end's shape on the face it enters", () => {
    expect(housedEnd({ housing: side, housed: shelf(), end: 0, depth: 0.25 })).toEqual({
      ok: true,
      dado: { withPart: 'shelf', face: 'far', u0: 10, u1: 10.75, v0: 0, v1: 11.25, depth: 0.25 },
    });
  });

  it("stops the dado short of the housed part's reference edge and notches that corner", () => {
    expect(housedEnd({ housing: side, housed: shelf(), end: 0, depth: 0.25, stop: 0.5 })).toEqual({
      ok: true,
      dado: { withPart: 'shelf', face: 'far', u0: 10, u1: 10.75, v0: 0.5, v1: 11.25, depth: 0.25 },
      notch: { end: 0, edge: 'reference', along: 0.25, across: 0.5 },
    });
  });

  it('enters the near face of a side turned the other way', () => {
    // Its thickness runs toward −x from x = 0.75, so the shelf enters its near face.
    const turned: PlacedPart = {
      part: side.part,
      placement: placement('side', {
        origin: { x: 0.75, y: 0, z: 0 },
        along: { x: 0, y: 0, z: 1 },
        across: { x: 0, y: 1, z: 0 },
        through: { x: -1, y: 0, z: 0 },
      }),
    };
    expect(
      housedEnd({
        housing: turned,
        housed: shelf(10, housingPlane(turned, 'near', 0.25)),
        end: 0,
        depth: 0.25,
      }),
    ).toEqual({
      ok: true,
      dado: { withPart: 'shelf', face: 'near', u0: 10, u1: 10.75, v0: 0, v1: 11.25, depth: 0.25 },
    });
  });

  it("refuses an end that stops short of the dado's bottom", () => {
    expect(
      housedEnd({
        housing: side,
        housed: shelf(10, housingPlane(side, 'far', 0.125)),
        end: 0,
        depth: 0.25,
      }),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/bottom/) });
  });

  it('refuses an end that runs past the housing', () => {
    expect(housedEnd({ housing: side, housed: shelf(29.5), end: 0, depth: 0.25 })).toMatchObject({
      ok: false,
      message: 'The housed end runs past the housing.',
    });
  });

  it('refuses an angled end', () => {
    const angled = shelf();
    angled.part = { ...angled.part, ends: [{ ...square, setting: 10 }, square] };
    expect(housedEnd({ housing: side, housed: angled, end: 0, depth: 0.25 })).toMatchObject({
      ok: false,
    });
  });

  it('refuses a part that meets the face at an angle', () => {
    const turned = shelf();
    turned.placement = {
      ...turned.placement,
      along: { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 },
      across: { x: -Math.SQRT1_2, y: Math.SQRT1_2, z: 0 },
    };
    expect(housedEnd({ housing: side, housed: turned, end: 0, depth: 0.25 })).toMatchObject({
      ok: false,
      message: 'The housed part does not meet the housing square to a side.',
    });
  });
});
