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
  sectionView,
} from '../../geometry/index.ts';
import type { Vec3 } from '../../model/types.ts';
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
