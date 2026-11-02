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
import type { StoredRecordCabinetOutputs } from './outputs.ts';

// The cabinet's drawings (spec, Hardware, operations, build steps, drawings): each part's cut
// detail, the assembled and exploded views, front and end elevations with the bay widths and
// heights, and a section through the first bay. The largest item on the top is in phantom lines,
// since it is not in the cut list. Drawn from stored outputs on read.

const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** A box's twelve edges as phantom polylines. */
function box(min: Vec3, max: Vec3): Vec3[][] {
  const c = (i: number, j: number, k: number) =>
    at(i ? max.x : min.x, j ? max.y : min.y, k ? max.z : min.z);
  return [
    [c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0), c(0, 0, 0)],
    [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1), c(0, 0, 1)],
    [c(0, 0, 0), c(0, 0, 1)],
    [c(1, 0, 0), c(1, 0, 1)],
    [c(1, 1, 0), c(1, 1, 1)],
    [c(0, 1, 0), c(0, 1, 1)],
  ];
}

export function cabinetScene(outputs: StoredRecordCabinetOutputs): Scene {
  const { params: p, geometry: g, parts, placements } = outputs.design;
  const y0 = -p.frontOverhang;
  const mid = (depth: number) => y0 + (g.topDepth - depth) / 2;
  // The largest item at the left end of the top, centered front to back: a layout to show its
  // size, not a position Kerf chooses for it.
  const item = p.topItem;
  const phantoms = box(
    at(0, mid(item.depth), g.height),
    at(item.width, mid(item.depth) + item.depth, g.height + item.height),
  );
  return { parts, placements, ground: { point: at(0, 0, 0), up: at(0, 0, 1) }, phantoms };
}

/**
 * How the exploded view pulls the cabinet apart: the case off the base, then its top up, the
 * sides out, the rails back, and the doors forward, their panels farther; the base's aprons and
 * cleats out from the legs, which stay on the floor. Far enough that the top, sides, doors, and
 * base each stand clear of the others (#352).
 */
export function cabinetExplode(outputs: StoredRecordCabinetOutputs): Explode[] {
  const { params: p } = outputs.design;
  const gap = p.caseDepth / 2;
  const base = p.legStock.size * 2;
  // The case and its doors rise off the base, which stays on the floor, so neither hides the other.
  const lift = gap;
  const offsets: Record<string, Vec3> = {
    top: at(0, 0, lift + 3 * gap),
    'side-left': at(-1.5 * gap, 0, lift + gap),
    'side-right': at(1.5 * gap, 0, lift + gap),
    partition: at(0, 0, lift + 1.5 * gap),
    rail: at(0, gap, lift + gap),
    bottom: at(0, 0, lift),
    cleat: at(0, 0, base / 2),
    'door-stile-outer': at(0, -3 * gap, lift),
    'door-stile-inner': at(0, -3 * gap, lift),
    'door-rail': at(0, -3 * gap, lift),
    'door-panel': at(0, -4 * gap, lift),
  };
  return outputs.design.placements.flatMap((pl): Explode[] => {
    const offset =
      pl.partId === 'apron-long'
        ? at(0, pl.instance === 0 ? -base : base, 0)
        : pl.partId === 'apron-short'
          ? at(pl.instance === 0 ? -base : base, 0, 0)
          : offsets[pl.partId];
    return offset ? [{ partId: pl.partId, instance: pl.instance, offset }] : [];
  });
}

export const VIEW = isometric(-1, -1);

export function drawings(outputs: StoredRecordCabinetOutputs): Drawings {
  const { params: p, geometry: g } = outputs.design;
  const t = p.panelThickness;
  const scene = cabinetScene(outputs);
  const front = orthographic(at(0, -1, 0), at(0, 0, 1));
  const end = orthographic(at(-1, 0, 0), at(0, 0, 1));
  // Bay widths between the panels' inside faces, and the heights up the right end.
  const bays: DimensionChain = {
    points: g.panelX.flatMap((x) => [at(x, 0, 0), at(x + t, 0, 0)]),
    side: 'below',
    offset: 2,
  };
  const heights: DimensionChain = {
    // A plan from before the leg base has no legs to dimension.
    points: [
      0,
      ...(g.legLength === undefined ? [] : [p.legShowing]),
      g.baseHeight,
      g.baseHeight + t,
      g.height - t,
      g.height,
    ].map((z) => at(p.width, 0, z)),
    side: 'right',
    offset: 2,
  };
  const depths: DimensionChain = {
    points: [at(0, -p.frontOverhang, g.height), at(0, 0, g.height), at(0, p.caseDepth, g.height)],
    side: 'above',
    offset: 2,
  };
  const firstBay = (g.panelX[0] as number) + t + g.bayWidth / 2;
  return {
    isometric: isometricView(
      scene,
      VIEW,
      'The record cabinet, assembled, with the largest item on the top in phantom lines.',
      'Assembled',
    ),
    exploded: explodedView(
      scene,
      VIEW,
      cabinetExplode(outputs),
      g.door
        ? 'The record cabinet pulled apart: the top lifted, the sides out, the back rails back, the case bottom off the base, the base’s aprons and cleats out from the legs, and the doors forward, out of their tracks, with their panels out of their frames.'
        : 'The record cabinet pulled apart: the top lifted, the sides out, the back rails back, the case bottom off the base, and the base’s aprons and cleats out from the legs.',
      'Exploded',
    ),
    cutDetails: outputs.design.parts.map((part) => cutDetail(part)),
    siteLayout: null,
    elevations: [
      elevationView(
        scene,
        front,
        'The front, with each bay’s clear width, and the heights of the legs, aprons, case bottom, and top.',
        'Front elevation',
        [bays, heights],
      ),
      elevationView(
        scene,
        end,
        'The left end, with the top’s overhang and the case depth.',
        'End elevation',
        [depths],
      ),
      sectionView(
        scene,
        end,
        { point: at(firstBay, 0, 0), normal: at(-1, 0, 0) },
        'A section through the middle of the first bay, looking right: the case bottom, the back rail, the top, and the front and back aprons where the plane cuts them, and the partition beyond with its dadoes.',
        'Section through the first bay',
        [heights],
      ),
    ],
  };
}
