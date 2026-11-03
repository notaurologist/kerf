import type { BoardGuideId } from '../../knowledge/boardSelection.ts';
import { type BoardStock, panelStock } from '../../lumber/panel.ts';
import type {
  Dado,
  EdgeGroove,
  Issue,
  Notch,
  Part,
  Placement,
  Tenon,
  Vec3,
} from '../../model/types.ts';
import { formatLength } from '../../units/length.ts';
import { type CabinetGeometry, RECESS } from './geometry.ts';
import type { RecordCabinetParams } from './params.ts';
import type { Allowances } from './structural.ts';

// The parts and where each sits (spec, Part sizes and Placements, The Shaker-modern base, and
// Sliding doors on the end bays). Every part but the legs is a panel glued from the owner's board
// stock, and the legs are cut from square leg stock; every part's grain runs along its length. Coordinates: x along the cabinet from
// the top's left end, y front to back from the case's front, z up from the floor.

const SELECTION = {
  top: ['structural', 'span'],
  panel: ['structural', 'along-length'],
  shelf: ['structural', 'span'],
  rail: ['structural'],
  leg: ['structural', 'along-length'],
  frame: ['structural', 'along-length'],
} as const satisfies Record<string, readonly BoardGuideId[]>;

const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };

const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const X = at(1, 0, 0);
const Y = at(0, 1, 0);
const Z = at(0, 0, 1);
const minusX = at(-1, 0, 0);
const minusY = at(0, -1, 0);
const minusZ = at(0, 0, -1);
const RAD = Math.PI / 180;

/** Each cleat's width, across the inside of a side apron: a rule of thumb, wide enough for a screw. */
const CLEAT_WIDTH = 1;
/** The round hole's distance from the cleat's front end, and the back slot's from its back end. */
const SCREW_INSET = 1;
/** The shoulder above and below each tenon, a rule of thumb (spec, The Shaker-modern base). */
const SHOULDER = 0.25;

export type CabinetPart = Omit<Part, 'letter'>;

/** Hardwood lengths, 4 to 16 ft in 1-ft steps (Wood Handbook, ch. 6, p. 6-3). */
const DEALER_FEET = Array.from({ length: 13 }, (_, i) => i + 4);

export function cabinetParts(
  p: RecordCabinetParams,
  g: CabinetGeometry,
  /** The case bottom's slots and the door panels' gaps, from the wood's movement. */
  allowances: Allowances,
): { ok: true; parts: CabinetPart[]; placements: Placement[] } | { ok: false; issues: Issue[] } {
  const { slot, panelGap } = allowances;
  const t = p.panelThickness;
  const j = p.dadoDepth;
  const board: BoardStock =
    p.board.source === 'store'
      ? {
          // Named by its size, which is what the store's label gives.
          nominal: `${formatLength(p.board.thickness)} x ${formatLength(p.board.width)}`,
          thickness: p.board.thickness,
          width: p.board.width,
          buyableFeet: p.board.lengths,
        }
      : {
          nominal: `${p.board.quarters}/4 hardwood`,
          thickness: p.board.surfaced,
          width: p.board.planWidth,
          buyableFeet: DEALER_FEET,
          byBoardFoot: {
            nominalThickness: p.board.quarters / 4,
            waste: p.board.wastePercent / 100,
          },
        };
  const issues: Issue[] = [];
  const stockFor = (width: number, length: number) => {
    const made = panelStock({ thickness: t, width, length, board, allowances: p.allowances });
    if (made.ok) return made.stock;
    issues.push({ ...made.issue, params: ['board', 'panelThickness', 'allowances'] });
    return null;
  };

  const s = p.legStock.size;
  const H = g.height;
  const zb = g.baseHeight;
  const xr = p.width - p.endOverhang;
  const panelIds = [
    'side-left',
    ...Array.from({ length: p.bays - 1 }, () => 'partition'),
    'side-right',
  ];
  const door = g.door;
  const sizes = door && p.door;
  // With doors, the partitions start behind the tracks.
  const dt = door?.trackZone ?? 0;
  const partitionDepth = door?.partitionDepth ?? p.caseDepth;
  // The top's dadoes across its underside, and the case bottom's across its top face, each from
  // the back edge to s_d short of its panel's front.
  const housed = (face: Dado['face'], v0: number, v1: number, dx: number): Dado[] =>
    g.panelX.map((x, k) => {
      const id = panelIds[k] as string;
      return {
        withPart: id,
        face,
        u0: x - dx,
        u1: x - dx + t,
        v0: v0 + (id === 'partition' ? dt : 0),
        v1,
        depth: j,
      };
    });
  // Each door's track, between the sides' inside faces: the front one first.
  const tracks = (
    face: Dado['face'],
    v: number,
    dx: number,
    depth: 'topDepth' | 'bottomDepth',
  ): Dado[] =>
    door && sizes
      ? [0, 1].map((k) => ({
          withPart: 'door-rail',
          face,
          u0: (g.panelX[0] as number) + t - dx,
          u1: (g.panelX[p.bays] as number) - dx,
          v0: v + sizes.land + k * (sizes.land + door.trackWidth),
          v1: v + (k + 1) * (sizes.land + door.trackWidth),
          depth: sizes[depth],
        }))
      : [];
  const topDadoes = [
    ...housed('near', p.frontOverhang + p.stoppedSetback, g.topDepth, 0),
    ...tracks('near', p.frontOverhang, 0, 'topDepth'),
  ];
  const bottomDadoes = [
    ...housed('far', p.stoppedSetback, p.caseDepth, p.endOverhang),
    ...tracks('far', 0, p.endOverhang, 'bottomDepth'),
  ];

  const topStock = stockFor(g.topDepth, p.width);
  const bottomStock = stockFor(p.caseDepth, g.caseWidth);
  const panelStockFor = stockFor(p.caseDepth, g.panelLength);
  const partitionStock = stockFor(partitionDepth, g.panelLength);
  const railStock = stockFor(p.railHeight, g.railLength);
  const longApronStock = stockFor(p.apronHeight, g.longApron);
  const shortApronStock = stockFor(p.apronHeight, g.shortApron);
  const cleatStock = stockFor(CLEAT_WIDTH, g.cleatLength);
  // Each door's stiles and rails are ripped from one board; its panel is glued up like the others.
  const panelWidth = (door?.panelSpan ?? 0) - 2 * panelGap.length;
  const doorStock = door &&
    sizes && {
      stile: stockFor(sizes.frameWidth, door.height),
      rail: stockFor(sizes.frameWidth, door.railLength),
      panel: stockFor(panelWidth, door.panelLength),
    };
  if (
    !topStock ||
    !bottomStock ||
    !panelStockFor ||
    !partitionStock ||
    !railStock ||
    !longApronStock ||
    !shortApronStock ||
    !cleatStock ||
    (doorStock && (!doorStock.stile || !doorStock.rail || !doorStock.panel))
  ) {
    return { ok: false, issues };
  }
  // A rail, apron, or cleat of one board is not flattened, so it is as thick as the board.
  const r = railStock.thickness;
  const ta = longApronStock.thickness;
  const tc = cleatStock.thickness;
  // Each side and partition runs from the bottom of the case bottom's dado to the top of the top's.
  const z0 = zb + t - j;

  if (door && partitionDepth - r < p.jacket) {
    issues.push({
      code: 'records-behind-tracks',
      message: `Behind the doors' tracks and in front of the back rails, each bay is ${formatLength(partitionDepth - r)} deep, less than a ${formatLength(p.jacket)} record jacket.`,
      params: ['caseDepth', 'jacket', 'door.land', 'door.clearance'],
    });
    return { ok: false, issues };
  }
  // A side or partition, on the face toward a bay: the back rail's dado.
  const housings = (face: Dado['face'], depth: number): Dado[] => [
    {
      withPart: 'rail',
      face,
      u0: H - t - p.railHeight - z0,
      u1: H - t - z0,
      v0: depth - r,
      v1: depth,
      depth: j,
    },
  ];
  // The front corner at each end, s_d long and j deep, fits the stopped dadoes.
  const notches: Notch[] = ([0, 1] as const).map((end) => ({
    end,
    edge: 'reference',
    along: j,
    across: p.stoppedSetback,
  }));

  // Tenons, centered in the apron's thickness, with shoulders of SHOULDER above and below.
  const tenonWidth = p.apronHeight - 2 * SHOULDER;
  const n0 = (ta - p.tenonThickness) / 2;
  const tenons: Tenon[] = ([0, 1] as const).map((end) => ({
    end,
    length: p.tenonLength,
    n0,
    thickness: p.tenonThickness,
    v0: SHOULDER,
    width: tenonWidth,
  }));
  // Each leg's two mortises, one in each inside face, where its two aprons' tenons go.
  const a0 = s - p.apronSetback - ta + n0;
  const mortise = {
    u0: p.legShowing + SHOULDER,
    u1: p.legShowing + SHOULDER + tenonWidth,
    a0,
    a1: a0 + p.tenonThickness,
    depth: p.tenonLength,
  };
  const taper = Math.atan((s - p.footSize) / p.legShowing) / RAD;
  const taperOf = (description: string, plane?: 'thickness') => ({
    description,
    start: { u: p.legShowing, v: 0 },
    end: { u: 0, v: s - p.footSize },
    angleToEdge: taper,
    ...(plane ? { plane } : {}),
  });
  const legStock: BoardStock = {
    nominal: `${formatLength(s)} x ${formatLength(s)}`,
    thickness: s,
    width: s,
    buyableFeet: p.legStock.lengths,
  };
  // Screws up through each cleat into the case bottom: round at the front, slotted behind.
  const screwAt = (u: number, slotted: boolean) => ({
    hardwareId: 'screws',
    u,
    v: CLEAT_WIDTH / 2,
    slot: slotted ? slot.length : 0,
    direction: 'along' as const,
  });

  const base = {
    markLengths: [],
    ends: [square, square] as Part['ends'],
    endsParallel: true,
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
  };
  const panel = (id: string, name: string, quantity: number, dadoes: Dado[], note: string) => ({
    ...base,
    id,
    name,
    role: id === 'partition' ? 'partition' : 'side',
    stock: id === 'partition' ? partitionStock : panelStockFor,
    quantity,
    length: g.panelLength,
    notes: [note],
    selection: [...SELECTION.panel],
    referenceEdge: 'front edge',
    dadoes,
    notches,
  });
  const apron = (id: string, name: string, length: number, stock: typeof longApronStock) => ({
    ...base,
    id,
    name,
    role: 'apron',
    stock,
    quantity: 2,
    length,
    notes: [
      'A tenon at each end goes into a leg; miter the tenons’ ends where two meet inside it.',
    ],
    selection: [...SELECTION.rail],
    referenceEdge: 'bottom edge',
    tenons,
  });
  const doorParts = (): CabinetPart[] => {
    if (!door || !sizes || !doorStock?.stile || !doorStock.rail || !doorStock.panel) return [];
    const ws = sizes.frameWidth;
    const gs = sizes.grooveDepth;
    const td = doorStock.stile.thickness;
    // The panel grooves and the rails' stub tenons, centered in the frame's thickness.
    const n0 = (td - p.tenonThickness) / 2;
    const groove = (length: number): EdgeGroove => ({
      edge: 'far',
      u0: 0,
      u1: length,
      n0,
      width: p.tenonThickness,
      depth: gs,
    });
    const stile = {
      ...base,
      role: 'stile',
      stock: doorStock.stile,
      quantity: 2,
      length: door.height,
      selection: [...SELECTION.frame],
      referenceEdge: 'edge away from the panel',
      grooves: [groove(door.height)],
    };
    const tongue = (p.panelThickness - p.tenonThickness) / 2;
    return [
      {
        ...stile,
        id: 'door-stile-outer',
        name: 'Outer stile',
        notes: [
          'The door’s outer edge, against its side when the door is closed, with the finger recess in its front face.',
        ],
        recesses: [
          {
            face: 'far',
            u: door.height / 2,
            v: ws / 2,
            width: RECESS.along,
            height: RECESS.across,
            depth: RECESS.depth,
          },
        ],
      },
      {
        ...stile,
        id: 'door-stile-inner',
        name: 'Inner stile',
        notes: ['The door’s edge that runs past the partition.'],
      },
      {
        ...base,
        id: 'door-rail',
        name: 'Door rail',
        role: 'door-rail',
        stock: doorStock.rail,
        quantity: 4,
        length: door.railLength,
        notes: [
          'A stub tenon at each end fits the stiles’ grooves. Each door’s bottom rail runs in the bottom track and its top rail in the top track.',
        ],
        selection: [...SELECTION.frame],
        referenceEdge: 'outer edge',
        tenons: ([0, 1] as const).map((end) => ({
          end,
          length: gs,
          n0,
          thickness: p.tenonThickness,
          v0: 0,
          width: ws,
        })),
        grooves: [groove(door.railLength)],
      },
      {
        ...base,
        id: 'door-panel',
        name: 'Door panel',
        role: 'door-panel',
        stock: doorStock.panel,
        quantity: 2,
        length: door.panelLength,
        notes: [
          'Its grain runs up and down. Rabbeted on both faces at every edge, to a tongue that fits the grooves.',
          panelGap.basis,
          'Finish it before the frame is glued around it, so no bare wood shows at its edges when it shrinks.',
        ],
        selection: [...SELECTION.panel],
        referenceEdge: 'left edge',
        rabbets: (['reference', 'far', 'first-end', 'second-end'] as const).flatMap((edge) =>
          (['near', 'far'] as const).map((face) => ({ edge, face, width: gs, depth: tongue })),
        ),
      },
    ];
  };
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
    },
    {
      ...base,
      id: 'bottom',
      name: 'Case bottom',
      role: 'bottom',
      stock: bottomStock,
      quantity: 1,
      length: g.caseWidth,
      notes: ['The face shown is its top face, with the dadoes; it is the floor of every bay.'],
      selection: [...SELECTION.shelf],
      referenceEdge: 'front edge',
      dadoes: bottomDadoes,
    },
    panel(
      'side-left',
      'Left side',
      1,
      housings('near', p.caseDepth),
      'Its dadoes face right, into the cabinet.',
    ),
    panel(
      'side-right',
      'Right side',
      1,
      housings('far', p.caseDepth),
      'Its dadoes face left, into the cabinet.',
    ),
    ...(p.bays > 1
      ? [
          panel(
            'partition',
            'Partition',
            p.bays - 1,
            [...housings('near', partitionDepth), ...housings('far', partitionDepth)],
            door
              ? 'Dadoes on both faces, opposite each other. It stops behind the doors’ tracks.'
              : 'Dadoes on both faces, opposite each other.',
          ),
        ]
      : []),
    {
      ...base,
      id: 'rail',
      name: 'Back rail',
      role: 'rail',
      stock: railStock,
      quantity: p.bays,
      length: g.railLength,
      notes: ['Under the top at the back of its bay, its ends in the back of the dadoes.'],
      selection: [...SELECTION.rail],
      referenceEdge: 'bottom edge',
    },
    {
      ...base,
      id: 'leg',
      name: 'Leg',
      role: 'leg',
      stock: legStock,
      quantity: 4,
      length: g.legLength,
      notes: [
        'Its two tapered faces and its two mortises face into the cabinet; the foot is the first end.',
      ],
      selection: [...SELECTION.leg],
      referenceEdge: 'inside face',
      tapers: [taperOf('Inside face'), taperOf('Other inside face', 'thickness')],
      mortises: [
        { withPart: 'apron', side: 'near', ...mortise },
        { withPart: 'apron', side: 'reference-edge', ...mortise },
      ],
    },
    apron('apron-long', 'Front and back apron', g.longApron, longApronStock),
    apron('apron-short', 'Side apron', g.shortApron, shortApronStock),
    {
      ...base,
      id: 'cleat',
      name: 'Cleat',
      role: 'cleat',
      stock: cleatStock,
      quantity: 2,
      length: g.cleatLength,
      notes: [
        'Glued to the inside of a side apron, flush with its top; the case bottom is screwed down through it.',
        slot.basis,
      ],
      selection: [...SELECTION.rail],
      referenceEdge: 'inside edge',
      screwHoles: [
        screwAt(SCREW_INSET, false),
        screwAt(g.cleatLength / 2, true),
        screwAt(g.cleatLength - SCREW_INSET, true),
      ],
    },
    ...doorParts(),
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
  place('top', 0, at(0, -p.frontOverhang, H - t), X, Y, Z);
  // The case bottom lies on the aprons, its top face, with the dadoes, up.
  place('bottom', 0, at(p.endOverhang, 0, zb), X, Y, Z);
  // Sides and partitions stand in the case bottom's dadoes, along z, across y; through runs −x,
  // so the near face is the right face and the far face the left.
  g.panelX.forEach((x, k) => {
    const id = panelIds[k] as string;
    const instance = id === 'partition' ? k - 1 : 0;
    place(id, instance, at(x + t, id === 'partition' ? dt : 0, z0), Z, Y, minusX);
  });
  // Each bay's back rail, from j inside the panel on its left, standing on edge at the back.
  for (let k = 0; k < p.bays; k++) {
    const left = (g.panelX[k] as number) + t - j;
    place('rail', k, at(left, p.caseDepth, H - t - p.railHeight), X, Z, minusY);
  }
  // Legs at the case's corners, along z from the floor, each with its reference edge (v = 0) and
  // near face (n = 0) toward the inside, where the tapers and mortises are.
  const xl = p.endOverhang;
  const xs = [xl + s, xr - s];
  const ys = [s, p.caseDepth - s];
  place('leg', 0, at(xs[0] as number, ys[0] as number, 0), Z, minusX, minusY);
  place('leg', 1, at(xs[1] as number, ys[0] as number, 0), Z, minusY, X);
  place('leg', 2, at(xs[0] as number, ys[1] as number, 0), Z, Y, minusX);
  place('leg', 3, at(xs[1] as number, ys[1] as number, 0), Z, X, Y);
  // Aprons between the legs, r_a in from the legs' outside faces, their bottom edge at h_l.
  const r0 = p.apronSetback;
  place('apron-long', 0, at(xl + s - p.tenonLength, r0 + ta, p.legShowing), X, Z, minusY);
  place('apron-long', 1, at(xl + s - p.tenonLength, p.caseDepth - r0, p.legShowing), X, Z, minusY);
  place('apron-short', 0, at(xl + r0, s - p.tenonLength, p.legShowing), Y, Z, X);
  place('apron-short', 1, at(xr - r0 - ta, s - p.tenonLength, p.legShowing), Y, Z, X);
  // A cleat inside each side apron, lying flat and flush with its top.
  place('cleat', 0, at(xl + r0 + ta, s, zb), Y, X, minusZ);
  place('cleat', 1, at(xr - r0 - ta, s, zb - tc), Y, minusX, Z);
  if (door && sizes) {
    const ws = sizes.frameWidth;
    const gs = sizes.grooveDepth;
    // The left door runs in the front track and the right door in the back one, each against its
    // side when closed, centered in its track, and seated d_b in the bottom track.
    const td = door.thickness;
    const x1 = (g.panelX[0] as number) + t;
    const x2 = g.panelX[p.bays] as number;
    const z = zb + t - sizes.bottomDepth;
    const top = z + door.height;
    for (const k of [0, 1]) {
      const x = k === 0 ? x1 : x2 - door.width;
      const xe = x + door.width;
      const y = sizes.land + k * (sizes.land + door.trackWidth) + sizes.clearance / 2;
      // Each stile's reference edge is away from the panel, and the outer stile's front face is
      // its far face, the face its cut detail shows, where the recess is: the left door's is
      // turned end for end.
      if (k === 0) {
        place('door-stile-outer', 0, at(x, y + td, top), minusZ, X, minusY);
        place('door-stile-inner', 0, at(xe, y + td, z), Z, minusX, minusY);
      } else {
        place('door-stile-inner', 1, at(x, y, z), Z, X, Y);
        place('door-stile-outer', 1, at(xe, y + td, z), Z, minusX, minusY);
      }
      const xr0 = x + ws - gs;
      place('door-rail', 2 * k, at(xr0, y + td, z), X, Z, minusY);
      place('door-rail', 2 * k + 1, at(xr0, y, top), X, minusZ, Y);
      const end = (door.height - 2 * ws + 2 * gs - door.panelLength) / 2;
      place(
        'door-panel',
        k,
        at(xr0 + panelGap.length, y + (td - t) / 2, z + ws - gs + end),
        Z,
        X,
        Y,
      );
    }
  }
  return { ok: true, parts, placements };
}
