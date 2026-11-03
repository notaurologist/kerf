import {
  type Dado,
  type Notch,
  type Part,
  type Placement,
  recordCabinet,
  type Vec3,
} from '@kerf/core';
import type { PlacedPart } from '../../boltedLap.ts';
import { compare } from '../../compare.ts';
import { type HousedEnd, housedEnd, housingPlane } from '../../housedEnd.ts';
import { type Member, type Plane, trim } from '../../trim.ts';

// The record cabinet's design with its sides, partitions, and back rails cut to length and placed
// by housed ends, and the dadoes and notches those ends need made with them
// (docs/explorations/joint-model.md, step 4). The template still gives where each part stands:
// the panels' positions across the case, the top and case bottom, and the rails' height.

const X: Vec3 = { x: 1, y: 0, z: 0 };
const MINUS_X: Vec3 = { x: -1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const MINUS_Y: Vec3 = { x: 0, y: -1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

export const design: typeof recordCabinet.design = (input, allowances) => {
  const made = recordCabinet.design(input, allowances);
  if (!made.ok) return made;
  const { params: p, geometry: g } = made.output;
  const t = p.panelThickness;
  const j = p.dadoDepth;
  const dt = g.door?.trackZone ?? 0;

  const partOf = (id: string) => {
    const part = made.output.parts.find((q) => q.id === id);
    if (!part) throw new Error(`No ${id}.`);
    return part;
  };
  const placementOf = (id: string, instance: number) => {
    const found = made.output.placements.find((q) => q.partId === id && q.instance === instance);
    if (!found) throw new Error(`No ${id} ${instance}.`);
    return found;
  };
  const top: PlacedPart = { part: partOf('top'), placement: placementOf('top', 0) };
  const bottom: PlacedPart = { part: partOf('bottom'), placement: placementOf('bottom', 0) };

  /** A part trimmed to a plane at each end, with its length and placement from the trim. */
  const cut = (id: string, instance: number, member: Member, planes: [Plane, Plane]) => {
    const trimmed = trim(member, planes);
    if (!trimmed.ok) throw new Error(`${id} ${instance}, end ${trimmed.end}: ${trimmed.message}`);
    const part: Part = {
      ...partOf(id),
      length: trimmed.length,
      ends: [
        { ...partOf(id).ends[0], ...trimmed.ends[0] },
        { ...partOf(id).ends[1], ...trimmed.ends[1] },
      ],
      endsParallel: trimmed.endsParallel,
    };
    const placement: Placement = {
      partId: id,
      instance,
      origin: trimmed.origin,
      along: member.along,
      across: member.across,
      through: member.through,
    };
    return { part, placement };
  };

  // Sides and partitions stand along z, front edge first, near face to the right, each from the
  // bottom of the case bottom's dado to the top of the top's. Partitions start behind the tracks.
  const panelIds = [
    'side-left',
    ...Array.from({ length: p.bays - 1 }, () => 'partition'),
    'side-right',
  ];
  const panels = g.panelX.map((x, k) => {
    const id = panelIds[k] as string;
    const partition = id === 'partition';
    return cut(
      id,
      partition ? k - 1 : 0,
      {
        along: Z,
        across: Y,
        through: MINUS_X,
        referenceEdge: { x: x + t, y: partition ? dt : 0, z: 0 },
        width: partOf(id).stock.width,
      },
      [housingPlane(bottom, 'far', j), housingPlane(top, 'near', j)],
    );
  });

  // Each bay's back rail, on edge at the back under the top, its ends in the panels' dadoes.
  const railZ = g.height - t - p.railHeight;
  const rails = Array.from({ length: p.bays }, (_, k) => {
    const left = panels[k] as PlacedPart;
    const right = panels[k + 1] as PlacedPart;
    return cut(
      'rail',
      k,
      {
        along: X,
        across: Z,
        through: MINUS_Y,
        referenceEdge: { x: 0, y: p.caseDepth, z: railZ },
        width: partOf('rail').stock.width,
      },
      [housingPlane(left, 'near', j), housingPlane(right, 'far', j)],
    );
  });

  // Each panel's ends in stopped dadoes in the case bottom and the top, then each rail's first end
  // and then its second, the order each part lists its dadoes and notches.
  const joints: HousedEnd[] = [
    ...panels.flatMap((panel) => [
      { housing: bottom, housed: panel, end: 0 as const, depth: j, stop: p.stoppedSetback },
      { housing: top, housed: panel, end: 1 as const, depth: j, stop: p.stoppedSetback },
    ]),
    ...rails.map((rail, k) => ({
      housing: panels[k] as PlacedPart,
      housed: rail,
      end: 0 as const,
      depth: j,
    })),
    ...rails.map((rail, k) => ({
      housing: panels[k + 1] as PlacedPart,
      housed: rail,
      end: 1 as const,
      depth: j,
    })),
  ];
  const dadoes = new Map<string, Dado[]>();
  const notches = new Map<string, Notch[]>();
  // A part's pieces share its lists, so what another piece already has is not listed again.
  const add = <T>(lists: Map<string, T[]>, id: string, item: T) => {
    const list = lists.get(id) ?? [];
    if (!list.some((other) => compare(other, item).length === 0)) list.push(item);
    lists.set(id, list);
  };
  for (const joint of joints) {
    const housed = housedEnd(joint);
    if (!housed.ok) {
      throw new Error(`${joint.housed.part.id} in ${joint.housing.part.id}: ${housed.message}`);
    }
    add(dadoes, joint.housing.part.id, housed.dado);
    if (housed.notch) add(notches, joint.housed.part.id, housed.notch);
  }

  const housedIds = new Set(joints.map((jt) => jt.housed.part.id));
  const placed = [...panels, ...rails];
  const parts = made.output.parts.map((part): Part => {
    const derived = placed.find((q) => q.part.id === part.id)?.part ?? part;
    const own = dadoes.get(part.id);
    if (!own && !housedIds.has(part.id)) return part;
    return {
      ...derived,
      // Dadoes for parts no joint covers yet, such as the doors' tracks, stay the template's.
      dadoes: [...(own ?? []), ...part.dadoes.filter((d) => !housedIds.has(d.withPart))],
      notches: housedIds.has(part.id) ? (notches.get(part.id) ?? []) : part.notches,
    };
  });
  const placements = made.output.placements.map(
    (pl) =>
      placed.find((q) => q.placement.partId === pl.partId && q.placement.instance === pl.instance)
        ?.placement ?? pl,
  );
  return { ok: true, output: { ...made.output, parts, placements } };
};
