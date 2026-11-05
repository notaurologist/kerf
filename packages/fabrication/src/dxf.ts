import { geometry, type Part } from '@kerf/core';
import { faceHoles } from './marks.ts';

// A part as an ASCII DXF file, the format CAM programs for a CNC router read: its face outline as
// one closed polyline and its holes as circles, each kind on its own layer so the CAM program can
// give each its own depth. Coordinates are core's, in inches, in the part's frame: x along the
// part from the first end's long point, y across it from the reference edge, looking at the face
// the drawings show. Written unrounded.
//
// Group codes from Autodesk's DXF Reference (AutoCAD 2024): the HEADER section's $ACADVER (code 1)
// and $INSUNITS (code 70, 1 = inches); POLYLINE (66 entities-follow flag, now ignored if present;
// 10/20/30 a dummy point; 70 flag, 1 = closed), VERTEX (10/20/30), and SEQEND; CIRCLE (10/20/30
// center, 40 radius); 8 a layer name. Its "Writing a DXF File" page says the HEADER may be
// omitted, layers named in ENTITIES are created when read, and the file must end with EOF. The
// file is labeled AC1009 (R12), whose POLYLINE nearly every DXF reader accepts; LWPOLYLINE and
// handles came later. $INSUNITS is newer than R12, and a reader that does not know it ignores it.

/** Layer names, in capitals as DXF writers use them. */
export const LAYERS = {
  outline: 'OUTLINE',
  /** Holes through the part. */
  through: 'THROUGH_HOLES',
  /** Stopped holes bored into the face shown, to the depth in the part's notes. */
  stopped: 'STOPPED_HOLES',
  /** Stopped holes bored into the other face: cut with the part turned over. */
  back: 'BACK_HOLES',
} as const;

/** Numbers written in full; -0 written as 0. */
const n = (x: number) => String(x + 0);

/** One group: its code, then its value, each on a line. */
const group = (code: number, value: string | number) =>
  `${code}\n${typeof value === 'number' ? n(value) : value}`;

interface DxfHole {
  x: number;
  y: number;
  radius: number;
  layer: (typeof LAYERS)[keyof typeof LAYERS];
}

/** The outline and holes a part's DXF holds, before they are written. */
function dxfShapes(part: Part): { outline: { x: number; y: number }[]; holes: DxfHole[] } {
  const outline = geometry.partOutline(part).map((p) => ({ x: p.u, y: p.v }));
  const holes = faceHoles(part).map((h) => ({
    x: h.at.u,
    y: h.at.v,
    radius: h.diameter / 2,
    layer: h.through ? LAYERS.through : h.from === 'shown' ? LAYERS.stopped : LAYERS.back,
  }));
  return { outline, holes };
}

/** The part as the text of an ASCII DXF file. */
export function partDxf(part: Part): string {
  const { outline, holes } = dxfShapes(part);
  const lines = [
    group(0, 'SECTION'),
    group(2, 'HEADER'),
    group(9, '$ACADVER'),
    group(1, 'AC1009'),
    group(9, '$INSUNITS'),
    group(70, 1),
    group(0, 'ENDSEC'),
    group(0, 'SECTION'),
    group(2, 'ENTITIES'),
    group(0, 'POLYLINE'),
    group(8, LAYERS.outline),
    group(66, 1),
    group(10, 0),
    group(20, 0),
    group(30, 0),
    group(70, 1),
    ...outline.flatMap((p) => [
      group(0, 'VERTEX'),
      group(8, LAYERS.outline),
      group(10, p.x),
      group(20, p.y),
      group(30, 0),
    ]),
    group(0, 'SEQEND'),
    group(8, LAYERS.outline),
    ...holes.flatMap((h) => [
      group(0, 'CIRCLE'),
      group(8, h.layer),
      group(10, h.x),
      group(20, h.y),
      group(30, 0),
      group(40, h.radius),
    ]),
    group(0, 'ENDSEC'),
    group(0, 'EOF'),
  ];
  return `${lines.join('\n')}\n`;
}
