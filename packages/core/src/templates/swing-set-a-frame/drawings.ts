import {
  cutDetail,
  type Drawings,
  type Explode,
  explodedView,
  isometric,
  isometricView,
  type PlanArea,
  planView,
  type Scene,
} from '../../geometry/index.ts';
import type { SwingSetOutputs } from './definition.ts';

// The swing set's drawings (#90): what the generic views need from this template, as data. The
// views draw from the stored parts, placements, and site layout, so a plan's drawings show the
// numbers it was made with.

/** From the front left, above: the frame nearest the viewer is the left one. */
const VIEW = isometric(-1, -1);

/** How far the exploded view pulls parts out: the beam up, crossbars and gussets outward. */
const PULL = { beam: 30, board: 24 };

export function drawings(outputs: SwingSetOutputs): Drawings {
  const { design } = outputs;
  const p = design.params;
  const k = p.groundSlope / 12;
  const placements = design.placements ?? [];
  const H = p.beamHeight;
  const seat = p.swings.seatHeight;
  const scene: Scene = {
    parts: design.parts,
    placements,
    // The ground rises k per inch toward the back, through the point under the beam (spec,
    // Coordinates): z = k·y.
    ground: { point: { x: 0, y: 0, z: 0 }, up: { x: 0, y: -k, z: 1 } },
    phantoms: [
      ...design.swings.hangersX.map((x) => [
        { x, y: 0, z: H },
        { x, y: 0, z: seat },
      ]),
      ...design.swings.seats.map((s) => [
        { x: s.xMin, y: 0, z: seat },
        { x: s.xMax, y: 0, z: seat },
      ]),
    ],
  };
  const explode: Explode[] = placements.flatMap((pl): Explode[] => {
    const { partId, instance } = pl;
    if (partId === 'beam') return [{ partId, instance, offset: { x: 0, y: 0, z: PULL.beam } }];
    if (partId === 'crossbar' || partId === 'gusset') {
      const x = instance === 0 ? -PULL.board : PULL.board;
      return [{ partId, instance, offset: { x, y: 0, z: 0 } }];
    }
    return [];
  });
  const has3d = placements.length > 0;
  const { footprint, clearArea, swingZones } = design.layout;
  const areas: PlanArea[] = [
    { ...clearArea, kind: 'zone', dimensioned: true },
    ...swingZones.map((z): PlanArea => ({ ...z, kind: 'zone' })),
    { ...footprint, kind: 'outline', dimensioned: true },
  ];
  // The beam's plies side by side: one ply's thickness times the number of plies.
  const beam = design.parts.find((x) => x.id === 'beam');
  const beamWidth = (beam?.stock.thickness ?? 0) * (beam?.quantity ?? 1);
  return {
    isometric: has3d ? isometricView(scene, VIEW) : null,
    exploded: has3d ? explodedView(scene, VIEW, explode) : null,
    cutDetails: design.parts.map((part) => cutDetail(part)),
    siteLayout: planView(areas, [
      {
        role: 'visible',
        points: [
          { x: 0, y: beamWidth / 2 },
          { x: p.beamLength, y: beamWidth / 2 },
        ],
      },
      {
        role: 'visible',
        points: [
          { x: 0, y: -beamWidth / 2 },
          { x: p.beamLength, y: -beamWidth / 2 },
        ],
      },
      ...design.swings.seats.map((s) => ({
        role: 'phantom' as const,
        points: [
          { x: s.xMin, y: 0 },
          { x: s.xMax, y: 0 },
        ],
      })),
    ]),
  };
}
