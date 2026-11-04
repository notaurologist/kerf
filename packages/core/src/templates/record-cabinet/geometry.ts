import { z } from 'zod';
import { oneBoardThickness } from '../../lumber/panel.ts';
import type { Issue } from '../../model/types.ts';
import { formatLength } from '../../units/length.ts';
import type { RecordCabinetParams } from './params.ts';

// Derived geometry (spec, Derived geometry) and the combinations the template refuses (spec,
// Validation and flags). Exact until display.

export const CabinetGeometry = z.object({
  /** W_c: case width, outside face to outside face of the sides. */
  caseWidth: z.number(),
  /** C: clear width between the sides. */
  clearWidth: z.number(),
  /** b: each bay's clear width. */
  bayWidth: z.number(),
  /** h_b: each bay's clear height, the case bottom to the underside of the top. */
  bayHeight: z.number(),
  /** D_t: the top's depth. */
  topDepth: z.number(),
  /** z_b: floor to the top of the aprons, where the case bottom sits: h_l + h_a. */
  baseHeight: z.number(),
  /** H: floor to the top surface: z_b + t + h_b + t. */
  height: z.number(),
  /** H_p: each side's and partition's length, between the bottoms of its two dadoes: h_b + 2j. */
  panelLength: z.number(),
  /** Each back rail's length, b + 2j. */
  railLength: z.number(),
  /** The left face of each side and partition, left to right. */
  panelX: z.array(z.number()),
  /** Wood left between a partition's back-to-back dadoes, t − 2j. */
  partitionLeft: z.number(),
  /** Each leg's length, h_l + h_a. */
  legLength: z.number(),
  /** Front and back aprons' length, tenons included: W_c − 2s + 2l_t. */
  longApron: z.number(),
  /** Side aprons' length, tenons included: D_c − 2s + 2l_t. */
  shortApron: z.number(),
  /** Each cleat's length, between the legs: D_c − 2s. */
  cleatLength: z.number(),
  /** The sliding doors and their tracks (spec, Sliding doors on the end bays); none without doors. */
  door: z
    .object({
      /** t_d: the stiles' and rails' thickness, ripped from one board (oneBoardThicknessOf). */
      thickness: z.number(),
      /** Each track's width, t_d + c_g. */
      trackWidth: z.number(),
      /** d_t: front to back across both tracks and their lands, 3l_g + 2(t_d + c_g). */
      trackZone: z.number(),
      /** Each partition's depth, behind the tracks: D_c − d_t. */
      partitionDepth: z.number(),
      /** Each door's height, seated d_b in each track: h_b + 2d_b. */
      height: z.number(),
      /** Each door's width, from its side past the partition: b + t + o_d. */
      width: z.number(),
      /** Each rail's length, its stub tenons included: width − 2w_s + 2g_s. */
      railLength: z.number(),
      /** The space between the groove bottoms across the panel's grain: width − 2w_s + 2g_s. */
      panelSpan: z.number(),
      /** The panel along its grain, 1/32" short of each groove bottom: height − 2w_s + 2g_s − 1/16. */
      panelLength: z.number(),
    })
    .optional(),
});
export type CabinetGeometry = z.infer<typeof CabinetGeometry>;

/** The finger recess in each door's outer stile, centered on it: rules of thumb (spec, Sliding doors). */
export const RECESS = { along: 3, across: 0.75, depth: 0.25 } as const;
/** A floating panel's margin at each end, along its grain (DOMAIN.md, Joints that let wood move). */
export const PANEL_END_GAP = 1 / 32;

/**
 * What a part ripped from one board comes out at, such as a door's stiles and rails or an apron:
 * the board's thickness, or the panel thickness planed from it when that is thinner than the
 * board less the flattening allowance.
 */
export const oneBoardThicknessOf = (p: RecordCabinetParams) =>
  oneBoardThickness(
    p.panelThickness,
    { thickness: p.board.source === 'store' ? p.board.thickness : p.board.surfaced },
    p.allowances,
  );

function doorGeometry(p: RecordCabinetParams, bayWidth: number): CabinetGeometry['door'] {
  const d = p.door;
  if (p.doors === 'none' || !d) return undefined;
  const thickness = oneBoardThicknessOf(p);
  const trackWidth = thickness + d.clearance;
  const trackZone = 3 * d.land + 2 * trackWidth;
  const height = p.bayHeight + 2 * d.bottomDepth;
  const width = bayWidth + p.panelThickness + d.overlap;
  const between = width - 2 * d.frameWidth + 2 * d.grooveDepth;
  return {
    thickness,
    trackWidth,
    trackZone,
    partitionDepth: p.caseDepth - trackZone,
    height,
    width,
    railLength: between,
    panelSpan: between,
    panelLength: height - 2 * d.frameWidth + 2 * d.grooveDepth - 2 * PANEL_END_GAP,
  };
}

export function cabinetGeometry(p: RecordCabinetParams): CabinetGeometry {
  const t = p.panelThickness;
  const s = p.legStock.size;
  const caseWidth = p.width - 2 * p.endOverhang;
  const clearWidth = caseWidth - 2 * t;
  const bayWidth = (clearWidth - (p.bays - 1) * t) / p.bays;
  const panelX = Array.from({ length: p.bays + 1 }, (_, k) => p.endOverhang + k * (bayWidth + t));
  const baseHeight = p.legShowing + p.apronHeight;
  return {
    caseWidth,
    clearWidth,
    bayWidth,
    bayHeight: p.bayHeight,
    topDepth: p.caseDepth + p.frontOverhang,
    baseHeight,
    height: baseHeight + t + p.bayHeight + t,
    panelLength: p.bayHeight + 2 * p.dadoDepth,
    railLength: bayWidth + 2 * p.dadoDepth,
    panelX,
    partitionLeft: t - 2 * p.dadoDepth,
    legLength: baseHeight,
    longApron: caseWidth - 2 * s + 2 * p.tenonLength,
    shortApron: p.caseDepth - 2 * s + 2 * p.tenonLength,
    cleatLength: p.caseDepth - 2 * s,
    ...(p.doors === 'sliding' ? { door: doorGeometry(p, bayWidth) } : {}),
  };
}

/** Combinations the spec refuses, each with the parameters involved. */
export function validate(p: RecordCabinetParams, g: CabinetGeometry): Issue[] {
  const issues: Issue[] = [];
  const refuse = (code: string, message: string, params: string[]) =>
    issues.push({ code, message, params });
  const len = formatLength;
  if (2 * p.dadoDepth >= p.panelThickness) {
    refuse(
      'dadoes-meet',
      `Dadoes ${len(p.dadoDepth)} deep on both faces of a ${len(p.panelThickness)} partition leave no wood between them.`,
      ['dadoDepth', 'panelThickness'],
    );
  }
  if (p.stoppedSetback >= p.caseDepth) {
    refuse('setback-too-deep', 'The stopped dadoes would stop past the back of the case.', [
      'stoppedSetback',
    ]);
  }
  if (g.bayHeight < p.jacket) {
    refuse(
      'bay-too-low',
      `Each bay is ${len(g.bayHeight)} high, less than a ${len(p.jacket)} record jacket.`,
      ['bayHeight', 'jacket'],
    );
  }
  const s = p.legStock.size;
  if (p.footSize >= s) {
    refuse(
      'foot-not-tapered',
      `A ${len(p.footSize)} foot is no smaller than the ${len(s)} leg, so the leg has no taper.`,
      ['footSize', 'legStock.size'],
    );
  }
  if (p.tenonLength >= s) {
    refuse(
      'tenon-too-long',
      `A ${len(p.tenonLength)} tenon would come out the far side of the ${len(s)} leg.`,
      ['tenonLength', 'legStock.size'],
    );
  }
  if (p.apronSetback + p.tenonThickness >= s) {
    refuse(
      'apron-off-leg',
      `An apron set back ${len(p.apronSetback)} would put its tenon past the ${len(s)} leg.`,
      ['apronSetback', 'tenonThickness', 'legStock.size'],
    );
  }
  const d = p.door;
  if (g.door && d && d.topDepth < 2 * d.bottomDepth) {
    refuse(
      'door-cannot-lift',
      `A door seated ${len(d.bottomDepth)} in its bottom track lifts out of it only if the top track is at least ${len(2 * d.bottomDepth)} deep.`,
      ['door.topDepth', 'door.bottomDepth'],
    );
  }
  // The top is at least 13" deep, wider than any board, so it is always glued up to t.
  if (g.door && d && d.topDepth >= p.panelThickness) {
    const lift = 2 * d.bottomDepth;
    const fix =
      lift < p.panelThickness
        ? `Make the tracks at least ${len(lift)} deep, enough to lift a door in, and less than ${len(p.panelThickness)}, or make the top thicker.`
        : `A door seated ${len(d.bottomDepth)} in its bottom track needs a top track ${len(lift)} deep to lift in, so the top must be thicker than that, or the bottom tracks shallower.`;
    refuse(
      'track-through-top',
      `Top tracks ${len(d.topDepth)} deep cut through the ${len(p.panelThickness)} top. ${fix}`,
      ['door.topDepth', 'panelThickness', 'door.bottomDepth'],
    );
  }
  if (g.door && d && d.grooveDepth >= d.frameWidth) {
    refuse(
      'groove-past-frame',
      `A ${len(d.grooveDepth)} panel groove is as deep as the ${len(d.frameWidth)} stiles and rails are wide.`,
      ['door.grooveDepth', 'door.frameWidth'],
    );
  }
  if (g.door && p.tenonThickness >= p.panelThickness) {
    refuse(
      'panel-no-tongue',
      `A ${len(p.tenonThickness)} groove leaves no tongue to cut on a ${len(p.panelThickness)} panel.`,
      ['tenonThickness', 'panelThickness'],
    );
  }
  if (g.door && d) {
    // The recess and the panel groove overlap across the stile; the recess must stop above it.
    const reaches = d.frameWidth / 2 + RECESS.across / 2 > d.frameWidth - d.grooveDepth;
    if (reaches && RECESS.depth >= (g.door.thickness - p.tenonThickness) / 2) {
      refuse(
        'recess-into-groove',
        `On a ${len(d.frameWidth)} stile, the ${len(RECESS.depth)} deep finger recess would break into the panel groove.`,
        ['door.frameWidth', 'door.grooveDepth', 'tenonThickness'],
      );
    }
  }
  if (p.caseDepth < p.jacket) {
    refuse(
      'case-too-shallow',
      `The case is ${len(p.caseDepth)} deep, less than a ${len(p.jacket)} record jacket.`,
      ['caseDepth', 'jacket'],
    );
  }
  if (p.topItem.width > p.width) {
    refuse(
      'top-item-too-wide',
      `The largest item on the top is ${len(p.topItem.width)} wide, more than the ${len(p.width)} top.`,
      ['topItem.width', 'width'],
    );
  }
  if (p.topItem.depth > g.topDepth) {
    refuse(
      'top-item-too-deep',
      `The largest item on the top is ${len(p.topItem.depth)} deep, more than the ${len(g.topDepth)} top.`,
      ['topItem.depth', 'caseDepth', 'frontOverhang'],
    );
  }
  return issues;
}
