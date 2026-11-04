import type { PlacedPart } from '../../joints/boltedLap.ts';
import { compare } from '../../joints/compare.ts';
import { type HousedEnd, housedEnd, housingPlane, sideEntered } from '../../joints/housedEnd.ts';
import {
  floatingPanel,
  mortiseAndTenon,
  slottedScrews,
  tenonInGroove,
} from '../../joints/joinery.ts';
import { type Member, type Plane, trim } from '../../joints/trim.ts';
import type {
  Dado,
  EdgeGroove,
  Mortise,
  Notch,
  Part,
  Placement,
  ScrewHole,
  Tenon,
  Vec3,
} from '../../model/types.ts';
import { type CaseGeometry, PANEL_END_GAP } from './geometry.ts';
import type { RecordCabinetParams } from './params.ts';
import { apronTenons, SCREW_INSET, SHOULDER, type UncutPart } from './parts.ts';
import type { Allowances } from './structural.ts';

// The record cabinet's joints (decision 0020): the sides, partitions, and back rails housed in
// dadoes, the aprons tenoned into the legs, each door's rails stub-tenoned into its stiles around a
// floating panel, and the cleats screwed to the case bottom through slots. The parts say where each
// one stands and how big each joint is; the joints give every length, end cut, dado, notch,
// mortise, tenon, groove, rabbet, and screw hole, and each part's stock is sized to its length.

const X: Vec3 = { x: 1, y: 0, z: 0 };
const MINUS_X: Vec3 = { x: -1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const MINUS_Y: Vec3 = { x: 0, y: -1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

type Made = Part | (UncutPart & { letter: string });
const isUncut = (part: Made): part is UncutPart & { letter: string } => 'at' in part.stock;

export function joined(
  p: RecordCabinetParams,
  g: CaseGeometry,
  allowances: Allowances,
  made: { parts: Made[]; placements: Placement[] },
): { parts: Part[]; placements: Placement[] } {
  const t = p.panelThickness;
  const j = p.dadoDepth;
  const dt = g.door?.trackZone ?? 0;

  const madeOf = (id: string) => {
    const part = made.parts.find((q) => q.id === id);
    if (!part) throw new Error(`No ${id}.`);
    return part;
  };
  /** A part the template sizes whole. */
  const partOf = (id: string) => {
    const part = madeOf(id);
    if (isUncut(part)) throw new Error(`${id} has no length until its joints give it one.`);
    return part;
  };
  /** A part its joints cut to length. */
  const uncutOf = (id: string) => {
    const part = madeOf(id);
    if (!isUncut(part)) throw new Error(`${id} is not cut to length by its joints.`);
    return part;
  };
  const placementOf = (id: string, instance: number) => {
    const found = made.placements.find((q) => q.partId === id && q.instance === instance);
    if (!found) throw new Error(`No ${id} ${instance}.`);
    return found;
  };
  const top: PlacedPart = { part: partOf('top'), placement: placementOf('top', 0) };
  const bottom: PlacedPart = { part: partOf('bottom'), placement: placementOf('bottom', 0) };

  /**
   * A part trimmed to a plane at each end, with its length, its stock, and its placement from the
   * trim.
   */
  const cut = (id: string, instance: number, member: Member, planes: [Plane, Plane]) => {
    const trimmed = trim(member, planes);
    if (!trimmed.ok) throw new Error(`${id} ${instance}, end ${trimmed.end}: ${trimmed.message}`);
    const uncut = uncutOf(id);
    const part: Part = {
      ...uncut,
      stock: uncut.stock.at(trimmed.length),
      length: trimmed.length,
      ends: [
        { ...uncut.ends[0], ...trimmed.ends[0] },
        { ...uncut.ends[1], ...trimmed.ends[1] },
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
        width: uncutOf(id).stock.width,
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
        width: uncutOf('rail').stock.width,
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

  // Aprons: tenons into the legs' inside faces, with shoulders above and below, centered in the
  // apron's thickness, each mitered where it meets the other apron's tenon inside the leg. Each
  // runs where the template stands it; its length comes from the tenons.
  const legs = [0, 1, 2, 3].map(
    (i): PlacedPart => ({ part: partOf('leg'), placement: placementOf('leg', i) }),
  );
  const shoulder = SHOULDER;
  // Each apron's legs at its first end and its second.
  const layout = [
    ['apron-short', 0, 2, 0],
    ['apron-short', 1, 1, 3],
    ['apron-long', 0, 0, 1],
    ['apron-long', 1, 3, 2],
  ] as const;
  // Two aprons enter each leg, and their tenons meet inside it: the way each runs toward its tip.
  const entering = layout.flatMap(([id, instance, first, second]) => {
    const along = placementOf(id, instance).along;
    const back = { x: -along.x, y: -along.y, z: -along.z };
    return [
      { leg: first, id, instance, toward: back },
      { leg: second, id, instance, toward: along },
    ];
  });
  const meet = apronTenons(p, uncutOf('apron-long').stock.thickness).meet;
  const meeting = (leg: number, id: string, instance: number) =>
    meet
      ? entering.find((e) => e.leg === leg && !(e.id === id && e.instance === instance))?.toward
      : undefined;
  /** The plane `depth` into the side of a leg that a part running `toward` it meets. */
  const into = (leg: number, toward: Vec3, depth: number, what: string) => {
    const placed = legs[leg] as PlacedPart;
    const side = sideEntered(placed, toward);
    if (!side) throw new Error(`${what} does not meet its leg square.`);
    return housingPlane(placed, side, depth);
  };
  /** A part's legs, at its first end and its second, the planes `depth` into them. */
  const betweenLegs = (pl: Placement, [first, second]: [number, number], depth: number) =>
    [
      into(first, { x: -pl.along.x, y: -pl.along.y, z: -pl.along.z }, depth, pl.partId),
      into(second, pl.along, depth, pl.partId),
    ] as [Plane, Plane];
  const aprons = layout.map(([id, instance, first, second]) => {
    const pl = placementOf(id, instance);
    const piece = cut(
      id,
      instance,
      memberOf(pl, uncutOf(id).stock.width),
      betweenLegs(pl, [first, second], p.tenonLength),
    );
    const ta = piece.part.stock.thickness;
    const tenon = {
      v0: shoulder,
      width: p.apronHeight - 2 * shoulder,
      n0: (ta - p.tenonThickness) / 2,
      thickness: p.tenonThickness,
    };
    const joints = ([0, 1] as const).map((end) =>
      mortiseAndTenon({
        mortised: legs[end === 0 ? first : second] as PlacedPart,
        tenoned: piece,
        end,
        depth: p.tenonLength,
        tenon,
        // The template's mortises name what they house by role.
        withPart: piece.part.role,
        meets: meeting(end === 0 ? first : second, id, instance),
      }),
    );
    return { piece, joints };
  });

  // Doors: each rail's stub tenons in its stiles' grooves, and the panel floating in the frame.
  const door = g.door && p.door;
  const doorParts = door
    ? [0, 1].map((k) => {
        const outer: PlacedPart = {
          part: partOf('door-stile-outer'),
          placement: placementOf('door-stile-outer', k),
        };
        const inner: PlacedPart = {
          part: partOf('door-stile-inner'),
          placement: placementOf('door-stile-inner', k),
        };
        const [left, right] = k === 0 ? [outer, inner] : [inner, outer];
        const rails = [2 * k, 2 * k + 1].map((instance) => {
          const pl = placementOf('door-rail', instance);
          return cut('door-rail', instance, memberOf(pl, uncutOf('door-rail').stock.width), [
            housingPlane(left, 'far-edge', door.grooveDepth),
            housingPlane(right, 'far-edge', door.grooveDepth),
          ]);
        });
        const panelPart = uncutOf('door-panel');
        const panelAt = placementOf('door-panel', k);
        const floating = floatingPanel({
          frame: [
            { ...left, edge: 'far' },
            { ...right, edge: 'far' },
            ...rails.map((r) => ({ ...r, edge: 'far' as const })),
          ],
          groove: { width: p.tenonThickness, depth: door.grooveDepth },
          panel: {
            part: panelPart,
            along: panelAt.along,
            across: panelAt.across,
            through: panelAt.through,
          },
          gaps: { ends: PANEL_END_GAP, edges: allowances.panelGap.length },
        });
        if (!floating.ok) throw new Error(`Door ${k} panel: ${floating.message}`);
        const grooveOf = (id: string) => floating.grooves.find((f) => f.partId === id)?.groove;
        const withGroove = (s: PlacedPart): PlacedPart => {
          const groove = grooveOf(s.part.id);
          return { ...s, part: { ...s.part, grooves: groove ? [groove] : [] } };
        };
        const tenons = rails.map((rail) =>
          ([0, 1] as const).map((end) => {
            const made = tenonInGroove({
              grooved: withGroove(end === 0 ? left : right),
              tenoned: rail,
              end,
              v: [0, rail.part.stock.width],
            });
            if (!made.ok) throw new Error(`Door ${k} rail: ${made.message}`);
            return made.tenon;
          }),
        );
        const panel = {
          part: {
            ...panelPart,
            stock: panelPart.stock.at(floating.length),
            length: floating.length,
            rabbets: floating.rabbets,
          },
          placement: { ...panelAt, origin: floating.origin },
        };
        return { rails, tenons, floating, panel };
      })
    : [];

  // Each cleat runs between the inside faces of the legs at its side, the front one first.
  const cleatLegs = [
    [0, 2],
    [1, 3],
  ] as const;
  const cleats = cleatLegs.map(([first, second], instance) => {
    const pl = placementOf('cleat', instance);
    return cut(
      'cleat',
      instance,
      memberOf(pl, uncutOf('cleat').stock.width),
      betweenLegs(pl, [first, second], 0),
    );
  });

  // Screws up through each cleat into the case bottom, which is held at its front edge and moves
  // toward the back: round at the front, slotted behind.
  const screwHoles = cleats.map((cleat, instance) => {
    const L = cleat.part.length;
    const v = cleat.part.stock.width / 2;
    const made = slottedScrews({
      hardwareId: 'screws',
      through: cleat,
      at: [SCREW_INSET, L / 2, L - SCREW_INSET].map((u) => ({ u, v })),
      into: bottom,
      heldAt: 'reference-edge',
      slot: allowances.slot.length,
    });
    if (!made.ok) throw new Error(`Cleat ${instance}: ${made.message}`);
    return made.holes;
  });

  // Every derived list, by part, without what another piece of the part already has.
  const lists = {
    mortises: new Map<string, Mortise[]>(),
    tenons: new Map<string, Tenon[]>(),
    grooves: new Map<string, EdgeGroove[]>(),
    screwHoles: new Map<string, ScrewHole[]>(),
  };
  for (const { piece, joints } of aprons) {
    for (const joint of joints) {
      if (!joint.ok) throw new Error(`${piece.part.id}: ${joint.message}`);
      add(lists.mortises, 'leg', joint.mortise);
      add(lists.tenons, piece.part.id, joint.tenon);
    }
  }
  for (const d of doorParts) {
    for (const tenon of d.tenons.flat()) add(lists.tenons, 'door-rail', tenon);
    for (const { partId, groove } of d.floating.grooves) add(lists.grooves, partId, groove);
  }
  for (const hole of screwHoles.flat()) add(lists.screwHoles, 'cleat', hole);

  const housedIds = new Set(joints.map((jt) => jt.housed.part.id));
  const placed = [
    ...panels,
    ...rails,
    ...aprons.map((a) => a.piece),
    ...cleats,
    ...doorParts.flatMap((d) => [...d.rails, d.panel]),
  ];
  const parts = made.parts.map((part): Part => {
    let derived = placed.find((q) => q.part.id === part.id)?.part ?? partOf(part.id);
    const own = dadoes.get(part.id);
    if (own || housedIds.has(part.id)) {
      derived = {
        ...derived,
        // Dadoes for parts no joint covers, the doors' tracks, stay the template's.
        dadoes: [...(own ?? []), ...part.dadoes.filter((d) => !housedIds.has(d.withPart))],
        notches: housedIds.has(part.id) ? (notches.get(part.id) ?? []) : part.notches,
      };
    }
    for (const key of ['mortises', 'tenons', 'grooves', 'screwHoles'] as const) {
      const list = lists[key].get(part.id);
      if (list) derived = { ...derived, [key]: list };
    }
    return derived;
  });
  const placements = made.placements.map(
    (pl) =>
      placed.find((q) => q.placement.partId === pl.partId && q.placement.instance === pl.instance)
        ?.placement ?? pl,
  );
  return { parts, placements };
}

/** A part as the template stands it, before its ends are cut: its origin is on its reference edge. */
function memberOf(pl: Placement, width: number): Member {
  return {
    along: pl.along,
    across: pl.across,
    through: pl.through,
    referenceEdge: pl.origin,
    width,
  };
}
