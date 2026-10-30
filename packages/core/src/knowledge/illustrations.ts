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

function line(role: 'visible' | 'extension' | 'break', ...points: Point2[]): Primitive {
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

// Isometric views: a short length of board lying on its wide face, length along x, width along
// y, thickness up z, seen from above the cut end.

const VIEW = isometric(1, -1);

/** The faces of a straight prism, `base` swept by `along`, that face the viewer, shaded. */
function prism(base: readonly Vec3[], along: Vec3): Primitive[] {
  const top = base.map((p) => add(p, along));
  const n = base.length;
  const faces = [
    [...base].reverse(),
    top,
    ...base.map((p, i) => [p, base[(i + 1) % n] as Vec3, top[(i + 1) % n] as Vec3, top[i] as Vec3]),
  ];
  const all = [...base, ...top];
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
};
