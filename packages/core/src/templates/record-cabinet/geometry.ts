import { z } from 'zod';
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
});
export type CabinetGeometry = z.infer<typeof CabinetGeometry>;

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
