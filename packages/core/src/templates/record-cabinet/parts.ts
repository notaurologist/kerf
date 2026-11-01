import type { BoardGuideId } from '../../knowledge/boardSelection.ts';
import { type BoardStock, panelStock } from '../../lumber/panel.ts';
import type { Cutout, Dado, Issue, Notch, Part, Placement, Vec3 } from '../../model/types.ts';
import { formatLength } from '../../units/length.ts';
import type { CabinetGeometry } from './geometry.ts';
import type { RecordCabinetParams } from './params.ts';

// The parts and where each sits (spec, Part sizes and Placements). Every part is a panel glued
// from the owner's board stock; its grain runs along its length. Coordinates: x along the cabinet
// from the top's left end, y front to back from the case's front, z up from the floor.

const SELECTION = {
  top: ['structural', 'span'],
  panel: ['structural', 'along-length'],
  shelf: ['structural', 'span'],
  rail: ['structural'],
} as const satisfies Record<string, readonly BoardGuideId[]>;

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };

const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const X = at(1, 0, 0);
const Y = at(0, 1, 0);
const Z = at(0, 0, 1);
const minusX = at(-1, 0, 0);
const minusY = at(0, -1, 0);

export type CabinetPart = Omit<Part, 'letter'>;

export function cabinetParts(
  p: RecordCabinetParams,
  g: CabinetGeometry,
): { ok: true; parts: CabinetPart[]; placements: Placement[] } | { ok: false; issues: Issue[] } {
  const t = p.panelThickness;
  const j = p.dadoDepth;
  const board: BoardStock = {
    // Named by its size, which is what the store's label gives.
    nominal: `${formatLength(p.board.thickness)} x ${formatLength(p.board.width)}`,
    thickness: p.board.thickness,
    width: p.board.width,
    buyableFeet: p.board.lengths,
  };
  const issues: Issue[] = [];
  const stockFor = (width: number, length: number) => {
    const made = panelStock({ thickness: t, width, length, board, allowances: p.allowances });
    if (made.ok) return made.stock;
    issues.push({ ...made.issue, params: ['board', 'panelThickness', 'allowances'] });
    return null;
  };

  const panelIds = [
    'side-left',
    ...Array.from({ length: p.bays - 1 }, () => 'partition'),
    'side-right',
  ];
  // The top: its dadoes across the underside, from the back edge to s_d short of the case front.
  const topDadoes: Dado[] = g.panelX.map((x, k) => ({
    withPart: panelIds[k] as string,
    face: 'near',
    u0: x,
    u1: x + t,
    v0: p.frontOverhang + p.stoppedSetback,
    v1: g.topDepth,
    depth: j,
  }));
  // A side or partition, on the face toward a bay: the shelf's dado, and the back rail's.
  const housings = (face: Dado['face']): Dado[] => [
    {
      withPart: 'shelf',
      face,
      u0: p.shelfHeight,
      u1: p.shelfHeight + t,
      v0: 0,
      v1: p.caseDepth,
      depth: j,
    },
    {
      withPart: 'rail',
      face,
      u0: p.height - t - p.railHeight,
      u1: p.height - t,
      v0: p.caseDepth - t,
      v1: p.caseDepth,
      depth: j,
    },
  ];
  const notches: Notch[] = [{ end: 1, edge: 'reference', along: j, across: p.stoppedSetback }];
  const cutouts: Cutout[] =
    p.cutoutHeight > 0
      ? [{ end: 0, v0: p.footWidth, v1: p.caseDepth - p.footWidth, depth: p.cutoutHeight }]
      : [];

  const base = {
    markLengths: [],
    ends: [square, square] as Part['ends'],
    endsParallel: true,
    holes: [],
    boltAreas: [],
    tapers: [],
  };
  const topStock = stockFor(g.topDepth, p.width);
  const panelStockFor = stockFor(p.caseDepth, g.panelLength);
  const shelfStock = stockFor(p.caseDepth, g.shelfLength);
  const railStock = stockFor(p.railHeight, g.shelfLength);
  if (!topStock || !panelStockFor || !shelfStock || !railStock) return { ok: false, issues };

  const panel = (id: string, name: string, quantity: number, dadoes: Dado[], note: string) => ({
    ...base,
    id,
    name,
    role: id === 'partition' ? 'partition' : 'side',
    stock: panelStockFor,
    quantity,
    length: g.panelLength,
    notes: [note],
    selection: [...SELECTION.panel],
    referenceEdge: 'front edge',
    dadoes,
    notches,
    cutouts,
  });
  const parts: CabinetPart[] = [
    {
      ...base,
      id: 'top',
      name: 'Top',
      role: 'top',
      stock: topStock,
      quantity: 1,
      length: p.width,
      notes: ['The face shown is the top surface; its dadoes are in the underside.'],
      selection: [...SELECTION.top],
      referenceEdge: 'front edge',
      dadoes: topDadoes,
      notches: [],
      cutouts: [],
    },
    panel(
      'side-left',
      'Left side',
      1,
      housings('near'),
      'Its dadoes face right, into the cabinet.',
    ),
    panel(
      'side-right',
      'Right side',
      1,
      housings('far'),
      'Its dadoes face left, into the cabinet.',
    ),
    ...(p.bays > 1
      ? [
          panel(
            'partition',
            'Partition',
            p.bays - 1,
            [...housings('near'), ...housings('far')],
            'Dadoes on both faces, opposite each other.',
          ),
        ]
      : []),
    {
      ...base,
      id: 'shelf',
      name: 'Bottom shelf',
      role: 'shelf',
      stock: shelfStock,
      quantity: p.bays,
      length: g.shelfLength,
      notes: ['Its ends sit in the dadoes on either side of its bay.'],
      selection: [...SELECTION.shelf],
      referenceEdge: 'front edge',
      dadoes: [],
      notches: [],
      cutouts: [],
    },
    {
      ...base,
      id: 'rail',
      name: 'Back rail',
      role: 'rail',
      stock: railStock,
      quantity: p.bays,
      length: g.shelfLength,
      notes: ['Under the top at the back of its bay, its ends in the back of the dadoes.'],
      selection: [...SELECTION.rail],
      referenceEdge: 'bottom edge',
      dadoes: [],
      notches: [],
      cutouts: [],
    },
  ];

  // Placements (DOMAIN.md, Geometry): along × across = through.
  const placements: Placement[] = [];
  const place = (
    partId: string,
    instance: number,
    origin: Vec3,
    along: Vec3,
    across: Vec3,
    through: Vec3,
  ) => placements.push({ partId, instance, origin, along, across, through });
  // The top lies flat, its underside at z = H − t, its front edge at y = −o_f.
  place('top', 0, at(0, -p.frontOverhang, p.height - t), X, Y, Z);
  // Sides and partitions stand on the floor, along z, across y; through runs −x, so the near face
  // is the right face and the far face the left.
  g.panelX.forEach((x, k) => {
    const id = panelIds[k] as string;
    const instance = id === 'partition' ? k - 1 : 0;
    place(id, instance, at(x + t, 0, 0), Z, Y, minusX);
  });
  // Each bay's shelf and back rail, from j inside the panel on its left.
  for (let k = 0; k < p.bays; k++) {
    const left = (g.panelX[k] as number) + t - j;
    place('shelf', k, at(left, 0, p.shelfHeight), X, Y, Z);
    // Standing on edge at the back, along x, across z; through runs −y, from the back face.
    place('rail', k, at(left, p.caseDepth, p.height - t - p.railHeight), X, Z, minusY);
  }
  return { ok: true, parts, placements };
}
