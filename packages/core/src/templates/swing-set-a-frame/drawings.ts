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
import type { Placement } from '../types.ts';
import type { SwingSetOutputs } from './definition.ts';

// The swing set's drawings (#90): what the generic views need from this template, as data. The
// views draw from the stored parts, placements, and site layout, so a plan's drawings show the
// numbers it was made with.

/** From the front left, above: the frame nearest the viewer is the left one. */
const VIEW = isometric(-1, -1);

/** How far the exploded view pulls parts out: the beam up, crossbars and gussets outward. */
const PULL = { beam: 30, board: 24 };

/** The exploded view's offsets: the beam up, each crossbar and gusset outward along the beam. */
export function explodeOffsets(placements: readonly Placement[]): Explode[] {
  return placements.flatMap((pl): Explode[] => {
    const { partId, instance } = pl;
    if (partId === 'beam') return [{ partId, instance, offset: { x: 0, y: 0, z: PULL.beam } }];
    if (partId === 'crossbar' || partId === 'gusset') {
      const x = instance === 0 ? -PULL.board : PULL.board;
      return [{ partId, instance, offset: { x, y: 0, z: 0 } }];
    }
    return [];
  });
}

/**
 * What the 3D views are drawn from (#90, #118): every part in place on sloped ground, the chains
 * and seats as phantoms, the viewpoint, and how far the exploded and action views pull parts
 * apart. Null for a plan made before placements.
 */
export function assembly(
  outputs: SwingSetOutputs,
): { scene: Scene; view: typeof VIEW; explode: Explode[] } | null {
  const { design } = outputs;
  const p = design.params;
  const k = p.groundSlope / 12;
  const placements = design.placements ?? [];
  if (placements.length === 0) return null;
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
  return { scene, view: VIEW, explode: explodeOffsets(placements) };
}

export function drawings(outputs: SwingSetOutputs): Drawings {
  const { design } = outputs;
  const p = design.params;
  const views = assembly(outputs);
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
    isometric: views ? isometricView(views.scene, views.view, 'The swing set, assembled.') : null,
    exploded: views
      ? explodedView(
          views.scene,
          views.view,
          views.explode,
          'The beam lifted, and the crossbars and gussets pulled out along the beam, with guidelines to where each goes.',
        )
      : null,
    cutDetails: design.parts.map((part) => cutDetail(part)),
    siteLayout: planView(
      areas,
      [
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
      ],
      "Site plan, front at the bottom: the clear area and swing zones around the frame's footprint.",
    ),
  };
}
