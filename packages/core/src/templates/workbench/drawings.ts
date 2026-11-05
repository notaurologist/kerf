import { cutDetail } from '../../geometry/cutDetail.ts';
import {
  type DimensionChain,
  type Drawings,
  type Explode,
  elevationView,
  explodedView,
  isometric,
  isometricView,
  orthographic,
  type Scene,
  type SubAssembly,
  sectionView,
} from '../../geometry/index.ts';
import { type Box, solid, solidBox } from '../../geometry/solid.ts';
import type { Placement, Vec3 } from '../../model/types.ts';
import type { WorkbenchOutputs } from './outputs.ts';

// The workbench's drawings (spec, Hardware, operations, build steps, drawings): each part's cut
// detail, the assembled and exploded views, front and end elevations with the main heights, and a
// section through the case. Drawn from stored outputs on read.

const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export function benchScene(outputs: WorkbenchOutputs): Scene {
  const { parts, placements } = outputs.design;
  return { parts, placements, ground: { point: at(0, 0, 0), up: at(0, 0, 1) } };
}

/**
 * How the exploded view pulls the bench apart, in two stages, so no part slides out from under one
 * still in place: first the top lifts with the face vise's chop, the upper shelf, and the divider
 * under it, the end vise's chop and block come out, the end frames move out from the case, its
 * sides out, and its back back; then the drawers, the shelves between them, and the doors slide
 * forward together off the case bottom, the door panels farther, out of their frames.
 */
export function benchExplode(outputs: WorkbenchOutputs): Explode[] {
  const { params: p, geometry: g } = outputs.design;
  const gap = p.topDepth / 2;
  const lift = p.topThickness + gap;
  const middleX = p.overhangEnds + g.baseLength / 2;
  const lifted = new Set(['top', 'shelf-upper', 'divider']);
  const frames = new Set(['leg-vise', 'leg-a', 'leg-b', 'foot', 'end-rail']);
  const forward = (id: string) =>
    id.includes('-drawer-') ||
    id.startsWith('door-') ||
    id === 'shelf-middle' ||
    id === 'shelf-lower';
  return outputs.design.placements.flatMap((pl): Explode[] => {
    const id = pl.partId;
    // Which end of the bench a part is at, from where it stands.
    const side = pl.origin.x < middleX ? -1 : 1;
    const move = (stage: number, offset: Vec3): Explode[] => [
      { partId: id, instance: pl.instance, stage, offset },
    ];
    // Off the leg's face as it rises, so it never slides along it.
    if (id === 'face-chop') return move(0, at(0, -gap, 2 * lift));
    if (lifted.has(id)) return move(0, at(0, 0, 2 * lift));
    if (id === 'end-chop' || id === 'vise-block') return move(0, at(4 * gap, 0, 0));
    if (frames.has(id)) return move(0, at(side * 3 * gap, 0, 0));
    if (id === 'case-side-left' || id === 'case-side-right')
      return move(0, at(side * 2 * gap, 0, 0));
    if (id === 'case-back') return move(0, at(0, 2 * gap, 0));
    if (forward(id)) return move(1, at(0, (id === 'door-panel' ? -4 : -3) * gap, 0));
    return [];
  });
}

type Member = { pl: Placement; box: Box };

/**
 * How far `a` moves along `axis`, toward `sign`, to clear every box in `from` by `gap`: past the
 * far side of each.
 */
function clear(a: Box, from: readonly Box[], axis: keyof Vec3, sign: 1 | -1, gap: number): number {
  const past = from.map((b) => (sign > 0 ? b[axis][1] - a[axis][0] : a[axis][1] - b[axis][0]));
  return sign * (Math.max(0, ...past) + gap);
}

const along = (axis: keyof Vec3, by: number): Vec3 => ({ x: 0, y: 0, z: 0, [axis]: by });

/** How far the group runs along an axis, from the least of its boxes to the most. */
const extent = (members: readonly Member[], axis: keyof Vec3) =>
  Math.max(...members.map((m) => m.box[axis][1])) - Math.min(...members.map((m) => m.box[axis][0]));

const center = (box: Box, axis: keyof Vec3) => (box[axis][0] + box[axis][1]) / 2;

/**
 * The groups built as units, each drawn on its own taken fully apart (spec, Drawings): the two
 * end frames, an upper drawer (two alike), the lower drawer, and a door (two alike, mirrored).
 * Each part leaves in the direction its joint lets it, a stage at a time in the reverse of the
 * build order, and clears what it leaves by a gap of a quarter of the group's depth, or of a
 * door's width. An instance moves in one stage only, so a part with joints in two directions
 * stays and the parts around it leave: the end frame's foot drops off the legs' tenons, then the
 * legs leave the end rail's. A drawer's sides come off before its bottom, which went in last: the
 * bottom slides out under the box back, and while it was still in the sides' grooves the drawing
 * could not show it passing under.
 */
export function benchSubAssemblies(outputs: WorkbenchOutputs): SubAssembly[] {
  const { params: p, geometry: g, parts, placements } = outputs.design;
  const middleX = p.overhangEnds + g.baseLength / 2;
  const placed = placements.flatMap((pl): Member[] => {
    const part = parts.find((q) => q.id === pl.partId);
    return part ? [{ pl, box: solidBox(solid(part, pl)) }] : [];
  });
  const ref = (m: Member) => ({ partId: m.pl.partId, instance: m.pl.instance });
  const move = (m: Member, stage: number, offset: Vec3): Explode => ({ ...ref(m), stage, offset });
  const left = (m: Member) => center(m.box, 'x') < middleX;
  const only = (members: readonly Member[], id: string) =>
    members.filter((m) => m.pl.partId === id);
  const one = (members: readonly Member[], id: string) => only(members, id)[0];
  const groups: SubAssembly[] = [];

  const frameIds = new Set(['leg-vise', 'leg-a', 'leg-b', 'foot', 'end-rail']);
  for (const [side, onSide] of [
    ['left', left],
    ['right', (m: Member) => !left(m)],
  ] as const) {
    const members = placed.filter((m) => frameIds.has(m.pl.partId) && onSide(m));
    const foot = one(members, 'foot');
    const rail = one(members, 'end-rail');
    const legs = members
      .filter((m) => m.pl.partId.startsWith('leg-'))
      .sort((a, b) => a.box.y[0] - b.box.y[0]);
    const [front, back] = legs;
    if (!foot || !rail || !front || !back) continue;
    const gap = extent(members, 'y') / 4;
    const tenons = legs.map((l) => l.box);
    groups.push({
      id: `${side}-end-frame`,
      title: side === 'left' ? 'Left end frame' : 'Right end frame',
      alike: 1,
      stepId: 'end-frames',
      members: members.map(ref),
      explode: [
        move(foot, 0, along('z', clear(foot.box, tenons, 'z', -1, gap))),
        move(front, 1, along('y', clear(front.box, [rail.box], 'y', -1, gap))),
        move(back, 1, along('y', clear(back.box, [rail.box], 'y', 1, gap))),
      ],
      description: `The ${side} end frame taken apart: the foot down off the legs’ tenons, then the front leg forward and the back leg back, off the end rail’s tenons.`,
    });
  }

  for (const [size, title] of [
    ['upper', 'Upper drawer'],
    ['lower', 'Lower drawer'],
  ] as const) {
    const id = (name: string) => `${size}-drawer-${name}`;
    const fronts = only(placed, id('front'));
    const alike = fronts.length;
    // Of two alike, the left one.
    const members = placed.filter(
      (m) => m.pl.partId.startsWith(id('')) && (alike === 1 || left(m)),
    );
    const front = one(members, id('front'));
    const boxFront = one(members, id('box-front'));
    const boxBack = one(members, id('box-back'));
    const bottom = one(members, id('bottom'));
    const sideLeft = one(members, id('side-left'));
    const sideRight = one(members, id('side-right'));
    if (!front || !boxFront || !boxBack || !bottom || !sideLeft || !sideRight) continue;
    const gap = extent(members, 'y') / 4;
    // The sides hold the box front's and back's pins and the bottom's edges.
    const held = [boxFront.box, boxBack.box, bottom.box];
    groups.push({
      id: `${size}-drawer`,
      title,
      alike,
      stepId: 'drawer-screws',
      members: members.map(ref),
      explode: [
        move(front, 0, along('y', clear(front.box, [boxFront.box], 'y', -1, gap))),
        move(sideLeft, 1, along('x', clear(sideLeft.box, held, 'x', -1, gap))),
        move(sideRight, 1, along('x', clear(sideRight.box, held, 'x', 1, gap))),
        move(bottom, 2, along('y', clear(bottom.box, [boxBack.box], 'y', 1, gap))),
      ],
      description: `The ${title.toLowerCase()} taken apart: the front forward off its screws, then the sides out to each side, off the dovetail pins of the box front and back and off the bottom’s edges, then the bottom out the back, under the box back.${alike > 1 ? ' The others are alike.' : ''}`,
    });
  }

  const panels = only(placed, 'door-panel');
  const members = placed.filter((m) => m.pl.partId.startsWith('door-') && left(m));
  const panel = one(members, 'door-panel');
  const stiles = members.filter((m) => m.pl.partId.startsWith('door-stile-'));
  const rails = only(members, 'door-rail').sort((a, b) => a.box.z[0] - b.box.z[0]);
  const [lowRail, highRail] = rails;
  if (panel && lowRail && highRail && stiles.length === 2) {
    const gap = extent(members, 'x') / 4;
    const held = [...rails, panel].map((m) => m.box);
    groups.push({
      id: 'door',
      title: 'Door',
      alike: panels.length,
      stepId: 'doors',
      members: members.map(ref),
      explode: [
        ...stiles.map((s) => {
          const sign = center(s.box, 'x') < center(panel.box, 'x') ? -1 : 1;
          return move(s, 0, along('x', clear(s.box, held, 'x', sign, gap)));
        }),
        move(lowRail, 1, along('z', clear(lowRail.box, [panel.box], 'z', -1, gap))),
        move(highRail, 1, along('z', clear(highRail.box, [panel.box], 'z', 1, gap))),
      ],
      description:
        'The left door taken apart: the stiles out to each side, off the rails’ tenons and the panel, then the rails down and up, off the panel. The right door is its mirror image.',
    });
  }
  return groups;
}

export const VIEW = isometric(-1, -1);

export function drawings(outputs: WorkbenchOutputs): Drawings {
  const { params: p, geometry: g } = outputs.design;
  const scene = benchScene(outputs);
  const front = orthographic(at(0, -1, 0), at(0, 0, 1));
  const end = orthographic(at(-1, 0, 0), at(0, 0, 1));
  const s = p.legSize;
  const legX = [p.overhangEnds, p.overhangEnds + g.baseLength - s];
  const lengths: DimensionChain = {
    points: [0, legX[0] as number, (legX[1] as number) + s, p.topLength].map((x) => at(x, 0, 0)),
    side: 'below',
    offset: 2,
  };
  const heights: DimensionChain = {
    points: [0, p.footHeight, p.footHeight + p.lowRailHeight, g.underside, p.height].map((z) =>
      at(p.topLength, 0, z),
    ),
    side: 'right',
    offset: 2,
  };
  const depths: DimensionChain = {
    points: [0, p.overhangFront, p.overhangFront + g.baseDepth, p.topDepth].map((y) =>
      at(0, y, p.height),
    ),
    side: 'above',
    offset: 2,
  };
  const t = p.caseThickness;
  const band: DimensionChain = {
    points: [
      g.underside - p.drawerBand,
      g.underside - p.drawerBand + t,
      g.underside - t - p.upperOpening,
      g.underside - t,
      g.underside,
    ].map((z) => at(0, 0, z)),
    side: 'left',
    offset: 2,
  };
  // Through the middle of the right half of the case, clear of the divider.
  const sectionX = (legX[0] as number) + s + (3 * (g.caseInside + 2 * t)) / 4;
  return {
    isometric: isometricView(scene, VIEW, 'The workbench, assembled.', 'Assembled'),
    exploded: explodedView(
      scene,
      VIEW,
      benchExplode(outputs),
      'The workbench pulled apart: the top lifted, with the face vise’s chop lifted and out forward, the upper drawer shelf, and the divider, the end vise’s chop and block out, the end frames out from the case, the case sides out and its back back, and the drawers and doors forward off the case bottom, with the door panels out of their frames.',
      'Exploded',
    ),
    cutDetails: outputs.design.parts.map((part) => cutDetail(part)),
    siteLayout: null,
    elevations: [
      elevationView(
        scene,
        front,
        'The front, with the top’s length and its overhang past the legs, and the heights of the feet, low rails, and top.',
        'Front elevation',
        [lengths, heights],
      ),
      elevationView(
        scene,
        end,
        'The left end, with the top’s depth and how far it runs past the front and back legs.',
        'End elevation',
        [depths],
      ),
      sectionView(
        scene,
        end,
        { point: at(sectionX, 0, 0), normal: at(-1, 0, 0) },
        'A section through the right half of the case, looking right: the drawer shelves, the drawers, the doors, the case back, and the top where the plane cuts them.',
        'Section through the case',
        [band],
      ),
    ],
  };
}
