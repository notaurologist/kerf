import { z } from 'zod';
import { boundsOf, type Drawing, type Point2, type Primitive } from '../geometry/primitives.ts';
import { isometric, project } from '../geometry/projection.ts';
import { add, cross, dot, sub, type Vec3 } from '../geometry/vec.ts';

// Drawings for glossary terms a picture explains best, in the drawing standard's language
// (docs/design/diagrams.html): face views drawn as cut details are, and the miter and bevel in
// isometric with shaded faces. They show a short length of a 2x4, at a sample angle chosen to be
// easy to see. Every label is words, never a number, so nothing reads as a value from a plan.

export const ILLUSTRATION_IDS = [
  'kerf',
  'long-and-short-point',
  'miter',
  'bevel',
  'saw-setting',
  'bow',
  'crook',
  'twist',
  'bolt-distances',
] as const;
export const IllustrationId = z.enum(ILLUSTRATION_IDS);
export type IllustrationId = z.infer<typeof IllustrationId>;

const RAD = Math.PI / 180;
/** A 2x4's actual width and thickness, in inches (NDS Supplement Table 1B). */
const W = 3.5;
const T = 1.5;
/** The sample angle for face views and the miter, and the steeper one for the bevel. */
const SAMPLE = 30;
const STEEP = 45;
const tan = (deg: number) => Math.tan(deg * RAD);

function text(at: Point2, words: string, anchor: 'start' | 'middle' | 'end'): Primitive {
  return { kind: 'text', role: 'label', at, text: words, anchor };
}

function leader(from: Point2, to: Point2): Primitive {
  return { kind: 'line', role: 'leader', points: [from, to] };
}

function line(
  role: 'visible' | 'extension' | 'break' | 'center' | 'phantom',
  ...points: Point2[]
): Primitive {
  return { kind: 'line', role, points };
}

/** A label with a leader to the point it names, starting just past the label's anchor. */
function labeled(words: string, at: Point2, to: Point2, anchor: 'start' | 'end'): Primitive[] {
  return [
    text(at, words, anchor),
    leader({ x: at.x + (anchor === 'start' ? -0.15 : 0.15), y: at.y }, to),
  ];
}

/** The zigzag across a board that is drawn short, as cut details draw it. */
function breakLine(x: number): Primitive {
  return line(
    'break',
    { x, y: 0.15 * W },
    { x, y: -0.4 * W },
    { x: x - 0.12 * W, y: -0.5 * W },
    { x: x + 0.12 * W, y: -0.6 * W },
    { x, y: -0.7 * W },
    { x, y: -1.15 * W },
  );
}

/** A point at `deg` (counterclockwise on the page) and distance `r` from `o`. */
function polar(o: Point2, deg: number, r: number): Point2 {
  return { x: o.x + r * Math.cos(deg * RAD), y: o.y - r * Math.sin(deg * RAD) };
}

function drawing(title: string, description: string, prims: Primitive[], notes: string[]): Drawing {
  return { title, description, bounds: boundsOf(prims, 0.3 * W), primitives: prims, notes };
}

// Face views: the face in its own plane, the reference edge at the bottom (y = 0), the face
// above it to y = −W, as in a cut detail.

function kerf(): Drawing {
  const cut = 8;
  const gap = 0.5;
  const end = 12.5;
  const face = (x0: number, x1: number): Primitive => ({
    kind: 'polygon',
    role: 'visible',
    points: [
      { x: x0, y: 0 },
      { x: x1, y: 0 },
      { x: x1, y: -W },
      { x: x0, y: -W },
    ],
    fill: 2,
  });
  const above = -W - 0.9;
  return drawing(
    'Kerf',
    'A board cut in two at a pencil mark: the part on the left keeps the mark, and the saw cut, the kerf, is on the waste side, to the right of the mark.',
    [
      face(0, cut),
      face(cut + gap, end),
      breakLine(0),
      text({ x: cut / 2, y: -W / 2 }, 'Part', 'middle'),
      text({ x: (cut + gap + end) / 2, y: -W / 2 }, 'Waste', 'middle'),
      // The kerf's width, with arrows pointing in from outside, as for a narrow dimension.
      line('extension', { x: cut, y: -W }, { x: cut, y: above - 0.15 }),
      line('extension', { x: cut + gap, y: -W }, { x: cut + gap, y: above - 0.15 }),
      {
        kind: 'line',
        role: 'dimension',
        points: [
          { x: cut - 1.2, y: above },
          { x: cut, y: above },
        ],
        arrows: 'end',
      },
      {
        kind: 'line',
        role: 'dimension',
        points: [
          { x: cut + gap + 1.2, y: above },
          { x: cut + gap, y: above },
        ],
        arrows: 'end',
      },
      text({ x: cut + gap / 2, y: above - 0.6 }, 'Kerf', 'middle'),
      // The mark, still on the part's end after the cut.
      ...labeled('Mark', { x: cut - 1.4, y: 1.2 }, { x: cut, y: 0 }, 'end'),
    ],
    ['The kerf is drawn wider than a blade cuts, so it shows.'],
  );
}

/** A face with angled ends at both ends, long points on the reference edge. */
function angledFace(length: number, setting: number): Primitive[] {
  const run = W * tan(setting);
  const a = { x: 0, y: 0 };
  const b = { x: length, y: 0 };
  const c = { x: length - run, y: -W };
  const d = { x: run, y: -W };
  return [{ kind: 'polygon', role: 'visible', points: [a, b, c, d], fill: 2 }];
}

function longAndShortPoint(): Drawing {
  const length = 14;
  const run = W * tan(SAMPLE);
  const below = 0.9;
  return drawing(
    'Long point and short point',
    'A part with both ends cut at an angle. At each end the long point is on the bottom edge and the short point on the top edge; the length is measured along the bottom edge, from long point to long point.',
    [
      ...angledFace(length, SAMPLE),
      ...labeled('Long point', { x: -0.6, y: 1.9 }, { x: 0, y: 0 }, 'end'),
      ...labeled('Short point', { x: run - 0.6, y: -W - 1.2 }, { x: run, y: -W }, 'end'),
      line('extension', { x: 0, y: 0.15 }, { x: 0, y: below + 0.15 }),
      line('extension', { x: length, y: 0.15 }, { x: length, y: below + 0.15 }),
      {
        kind: 'line',
        role: 'dimension',
        points: [
          { x: 0, y: below },
          { x: length, y: below },
        ],
        arrows: true,
      },
      text({ x: length / 2, y: below + 0.6 }, 'Length', 'middle'),
    ],
    [],
  );
}

function sawSetting(): Drawing {
  const length = 10;
  const run = W * tan(SAMPLE);
  const o = { x: 0, y: 0 };
  const cutDeg = 90 - SAMPLE;
  const setting = 0.75 * W;
  const edge = 0.45 * W;
  return drawing(
    'Saw setting and angle to the edge',
    'An angled end cut. The saw setting is the angle between the cut and a line square across the board; the angle to the edge is the angle between the cut and the board’s edge. Together they make a right angle.',
    [
      {
        kind: 'polygon',
        role: 'visible',
        points: [o, { x: length, y: 0 }, { x: length, y: -W }, { x: run, y: -W }],
        fill: 2,
        outline: false,
      },
      line('visible', { x: length, y: 0 }, o, { x: run, y: -W }, { x: length, y: -W }),
      breakLine(length),
      // The square line from the long point, and the two arcs from the cut.
      line('extension', o, polar(o, 90, 1.15 * W)),
      { kind: 'arc', role: 'dimension', center: o, radius: setting, start: cutDeg, end: 90 },
      { kind: 'arc', role: 'dimension', center: o, radius: edge, start: 0, end: cutDeg },
      ...labeled(
        'Saw setting',
        { x: -0.6, y: -W - 0.4 },
        polar(o, 90 - SAMPLE / 2, setting),
        'end',
      ),
      ...labeled('Square line', { x: -0.6, y: -1.2 * W - 0.9 }, polar(o, 90, 1.15 * W), 'end'),
      ...labeled('Angle to the edge', { x: 3.5, y: 1.4 }, polar(o, cutDeg / 2, edge), 'start'),
    ],
    [],
  );
}

/** How far warp is drawn from straight: far more than a board worth choosing has, so it shows. */
const WARP = 0.9;
const WARP_NOTE = 'The warp is drawn far larger than in a board worth choosing, so it shows.';

/**
 * A board seen from one side, curving up away from a straight line between its ends: `depth` is
 * the board's size across the view, its thickness for bow and its width for crook.
 */
function curved(title: string, description: string, depth: number, seen: string): Drawing {
  const length = 16;
  const steps = 24;
  const rise = (x: number) => WARP * Math.sin((Math.PI * x) / length);
  const lower = Array.from({ length: steps + 1 }, (_, i) => {
    const x = (length * i) / steps;
    return { x, y: -rise(x) };
  });
  const upper = lower.map((p) => ({ x: p.x, y: p.y - depth })).reverse();
  const middle = { x: length / 2, y: -WARP };
  return drawing(
    title,
    description,
    [
      { kind: 'polygon', role: 'visible', points: [...lower, ...upper], fill: 2 },
      line('phantom', { x: -0.6, y: 0 }, { x: length + 0.6, y: 0 }),
      ...labeled('Straight line', { x: length + 0.8, y: 1.1 }, { x: length + 0.3, y: 0 }, 'start'),
      ...labeled(title, { x: middle.x - 2.5, y: 1.6 }, middle, 'end'),
      text({ x: length / 2, y: -WARP - depth - 0.7 }, seen, 'middle'),
    ],
    [WARP_NOTE],
  );
}

function bow(): Drawing {
  return curved(
    'Bow',
    'A board seen from its narrow edge, curving away from a straight line between its ends: its wide face is not flat from end to end.',
    T,
    'Seen from the narrow edge',
  );
}

function crook(): Drawing {
  return curved(
    'Crook',
    'A board seen from its wide face, curving away from a straight line between its ends: its narrow edge is not straight from end to end.',
    W,
    'Seen from the wide face',
  );
}

function boltDistances(): Drawing {
  const length = 10;
  const end = 2.6;
  const hole = { x: end, y: -W / 2 };
  const below = 0.9;
  const across = 5;
  const grain = -W - 0.9;
  return drawing(
    'Edge distance and end distance',
    'The end of a part with a bolt hole. The end distance runs along the grain from the end of the part to the bolt’s center; the edge distance runs across the grain from the edge to the bolt’s center.',
    [
      {
        kind: 'polygon',
        role: 'visible',
        points: [
          { x: 0, y: 0 },
          { x: length, y: 0 },
          { x: length, y: -W },
          { x: 0, y: -W },
        ],
        fill: 2,
      },
      breakLine(length),
      { kind: 'circle', role: 'visible', center: hole, radius: 0.3 },
      line('center', { x: hole.x, y: -W - 0.3 }, { x: hole.x, y: below + 0.15 }),
      line('center', { x: hole.x - 0.6, y: hole.y }, { x: across + 0.3, y: hole.y }),
      // Along the grain: the end of the part to the bolt's center, below the part.
      line('extension', { x: 0, y: 0.15 }, { x: 0, y: below + 0.15 }),
      {
        kind: 'line',
        role: 'dimension',
        points: [
          { x: 0, y: below },
          { x: hole.x, y: below },
        ],
        arrows: true,
      },
      text({ x: hole.x / 2, y: below + 0.6 }, 'End distance', 'middle'),
      // Across the grain: the edge to the bolt's center, beside the hole.
      {
        kind: 'line',
        role: 'dimension',
        points: [
          { x: across, y: 0 },
          { x: across, y: hole.y },
        ],
        arrows: true,
      },
      text({ x: across + 0.3, y: hole.y / 2 + 0.2 }, 'Edge distance', 'start'),
      {
        kind: 'line',
        role: 'leader',
        points: [
          { x: 4, y: grain },
          { x: 7.5, y: grain },
        ],
        arrows: 'end',
      },
      text({ x: 3.6, y: grain + 0.2 }, 'Grain', 'end'),
    ],
    [],
  );
}

// Isometric views: a short length of board lying on its wide face, length along x, width along
// y, thickness up z, seen from above the cut end.

const VIEW = isometric(1, -1);

/** The faces of a straight prism, `base` swept by `along`, that face the viewer, shaded. */
function prism(base: readonly Vec3[], along: Vec3): Primitive[] {
  const top = base.map((p) => add(p, along));
  const n = base.length;
  return shaded([
    [...base].reverse(),
    top,
    ...base.map((p, i) => [p, base[(i + 1) % n] as Vec3, top[(i + 1) % n] as Vec3, top[i] as Vec3]),
  ]);
}

/** The faces of a closed solid that face the viewer, shaded by which way they point. */
function shaded(faces: readonly (readonly Vec3[])[]): Primitive[] {
  const all = faces.flat();
  const centre = {
    x: all.reduce((s, p) => s + p.x, 0) / all.length,
    y: all.reduce((s, p) => s + p.y, 0) / all.length,
    z: all.reduce((s, p) => s + p.z, 0) / all.length,
  };
  return faces.flatMap((face): Primitive[] => {
    const [p0, p1, p2] = face as [Vec3, Vec3, Vec3];
    let normal = cross(sub(p1, p0), sub(p2, p0));
    const mid = face.reduce((s, p) => add(s, p), { x: 0, y: 0, z: 0 });
    const out = sub(
      { x: mid.x / face.length, y: mid.y / face.length, z: mid.z / face.length },
      centre,
    );
    if (dot(normal, out) < 0) normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    if (dot(normal, VIEW.toViewer) <= 1e-9) return [];
    const len = Math.hypot(normal.x, normal.y, normal.z);
    const tone = normal.z / len > 0.9 ? 1 : Math.abs(normal.y / len) > 0.9 ? 2 : 3;
    return [
      { kind: 'polygon', role: 'visible', points: face.map((p) => project(VIEW, p)), fill: tone },
    ];
  });
}

function centreOf(points: readonly Vec3[]): Point2 {
  const pts = points.map((p) => project(VIEW, p));
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function twist(): Drawing {
  const length = 12;
  const lift = 1.4;
  // The corners of the board's bottom face, the far corner of its near edge lifted off the surface.
  const b = [
    { x: 0, y: 0, z: 0 },
    { x: length, y: 0, z: lift },
    { x: length, y: W, z: 0 },
    { x: 0, y: W, z: 0 },
  ] as const;
  const t = b.map((p) => ({ ...p, z: p.z + T }));
  const [b0, b1, b2, b3] = b;
  const [t0, t1, t2, t3] = t as [Vec3, Vec3, Vec3, Vec3];
  const surface: Vec3[] = [
    { x: -1.5, y: -1.5, z: 0 },
    { x: length + 2, y: -1.5, z: 0 },
    { x: length + 2, y: W + 1.5, z: 0 },
    { x: -1.5, y: W + 1.5, z: 0 },
  ];
  const gap = project(VIEW, { x: length, y: 0, z: lift / 2 });
  const corner = project(VIEW, { x: 0, y: -1.5, z: 0 });
  return drawing(
    'Twist',
    'A twisted board on a flat surface: it rests on three corners, and the fourth lifts off because its ends are turned in different directions.',
    [
      {
        kind: 'polygon',
        role: 'guideline',
        points: surface.map((p) => project(VIEW, p)),
        fill: 'none',
      },
      // Where the near edge would rest, so the gap under the lifted corner shows.
      line(
        'extension',
        project(VIEW, b0),
        project(VIEW, { x: length, y: 0, z: 0 }),
        project(VIEW, b1),
      ),
      ...shaded([
        [b0, b3, b2, b1],
        [t0, t1, t2, t3],
        [b0, b1, t1, t0],
        [b1, b2, t2, t1],
        [b2, b3, t3, t2],
        [b3, b0, t0, t3],
      ]),
      ...labeled('Lifts off', { x: gap.x + 2.2, y: gap.y + 1.6 }, gap, 'start'),
      ...labeled('Flat surface', { x: corner.x - 1, y: corner.y + 1.6 }, corner, 'end'),
    ],
    [WARP_NOTE],
  );
}

function miter(): Drawing {
  const length = 9;
  const run = W * tan(SAMPLE);
  const base: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: length - run, y: 0, z: 0 },
    { x: length, y: W, z: 0 },
    { x: 0, y: W, z: 0 },
  ];
  const cut = centreOf([
    { x: length - run, y: 0, z: 0 },
    { x: length, y: W, z: 0 },
    { x: length, y: W, z: T },
    { x: length - run, y: 0, z: T },
  ]);
  return drawing(
    'Miter',
    'A board lying on its wide face, its end cut at an angle across the face, square to the face.',
    [
      ...prism(base, { x: 0, y: 0, z: T }),
      ...labeled('Miter', { x: cut.x + 2.2, y: cut.y - 2.4 }, cut, 'start'),
    ],
    ['The cut angles across the face. Through the thickness it is square.'],
  );
}

function bevel(): Drawing {
  const length = 9;
  const run = T * tan(STEEP);
  const base: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: length, y: 0, z: 0 },
    { x: length - run, y: 0, z: T },
    { x: 0, y: 0, z: T },
  ];
  const cut = centreOf([
    { x: length, y: 0, z: 0 },
    { x: length, y: W, z: 0 },
    { x: length - run, y: W, z: T },
    { x: length - run, y: 0, z: T },
  ]);
  return drawing(
    'Bevel',
    'A board lying on its wide face, its end cut at an angle through the thickness, square across the face.',
    [
      ...prism(base, { x: 0, y: W, z: 0 }),
      ...labeled('Bevel', { x: cut.x + 2.2, y: cut.y - 2.4 }, cut, 'start'),
    ],
    ['The cut angles through the thickness. Across the face it is square.'],
  );
}

/** Every illustration, by ID. */
export const ILLUSTRATIONS: Record<IllustrationId, Drawing> = {
  kerf: kerf(),
  'long-and-short-point': longAndShortPoint(),
  miter: miter(),
  bevel: bevel(),
  'saw-setting': sawSetting(),
  bow: bow(),
  crook: crook(),
  twist: twist(),
  'bolt-distances': boltDistances(),
};
