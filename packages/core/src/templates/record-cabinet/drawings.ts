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
import type { RecordCabinetOutputs } from './outputs.ts';

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

export function cabinetScene(outputs: RecordCabinetOutputs): Scene {
  const { params: p, geometry: g, parts, placements } = outputs.design;
  const y0 = -p.frontOverhang;
  const mid = (depth: number) => y0 + (g.topDepth - depth) / 2;
  // The largest item at the left end of the top, centered front to back: a layout to show its
  // size, not a position Kerf chooses for it.
  const item = p.topItem;
  const phantoms = box(
    at(0, mid(item.depth), p.height),
    at(item.width, mid(item.depth) + item.depth, p.height + item.height),
  );
  return { parts, placements, ground: { point: at(0, 0, 0), up: at(0, 0, 1) }, phantoms };
}

/** How the exploded view pulls the case apart: the top up, the sides out, shelves and rails away. */
export function cabinetExplode(outputs: RecordCabinetOutputs): Explode[] {
  const { params: p } = outputs.design;
  const gap = p.caseDepth / 2;
  return outputs.design.placements.flatMap((pl): Explode[] => {
    const offset =
      pl.partId === 'top'
        ? at(0, 0, gap)
        : pl.partId === 'side-left'
          ? at(-gap, 0, 0)
          : pl.partId === 'side-right'
            ? at(gap, 0, 0)
            : pl.partId === 'shelf'
              ? at(0, -gap, 0)
              : pl.partId === 'rail'
                ? at(0, gap, 0)
                : null;
    return offset ? [{ partId: pl.partId, instance: pl.instance, offset }] : [];
  });
}

export const VIEW = isometric(-1, -1);

export function drawings(outputs: RecordCabinetOutputs): Drawings {
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
    points: [0, p.shelfHeight, p.shelfHeight + t, p.height - t, p.height].map((z) =>
      at(p.width, 0, z),
    ),
    side: 'right',
    offset: 2,
  };
  const depths: DimensionChain = {
    points: [at(0, -p.frontOverhang, p.height), at(0, 0, p.height), at(0, p.caseDepth, p.height)],
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
      'The record cabinet pulled apart: the top lifted, the sides out, the shelves forward, and the back rails back.',
      'Exploded',
    ),
    cutDetails: outputs.design.parts.map((part) => cutDetail(part)),
    siteLayout: null,
    elevations: [
      elevationView(
        scene,
        front,
        'The front, with each bay’s clear width and the heights of the shelves and top.',
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
        'A section through the middle of the first bay, looking right: the shelf, the back rail, and the top where the plane cuts them, and the partition beyond with its dadoes.',
        'Section through the first bay',
        [heights],
      ),
    ],
  };
}
