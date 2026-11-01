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
  /** h_b: each bay's clear height, shelf to the underside of the top. */
  bayHeight: z.number(),
  /** D_t: the top's depth. */
  topDepth: z.number(),
  /** H_p: each side's and partition's length, floor to the bottom of the top's dado. */
  panelLength: z.number(),
  /** Each shelf's and back rail's length, b + 2j. */
  shelfLength: z.number(),
  /** The left face of each side and partition, left to right. */
  panelX: z.array(z.number()),
  /** Wood left between a partition's back-to-back dadoes, t − 2j. */
  partitionLeft: z.number(),
});
export type CabinetGeometry = z.infer<typeof CabinetGeometry>;

export function cabinetGeometry(p: RecordCabinetParams): CabinetGeometry {
  const t = p.panelThickness;
  const caseWidth = p.width - 2 * p.endOverhang;
  const clearWidth = caseWidth - 2 * t;
  const bayWidth = (clearWidth - (p.bays - 1) * t) / p.bays;
  const panelX = Array.from({ length: p.bays + 1 }, (_, k) => p.endOverhang + k * (bayWidth + t));
  return {
    caseWidth,
    clearWidth,
    bayWidth,
    bayHeight: p.height - t - (p.shelfHeight + t),
    topDepth: p.caseDepth + p.frontOverhang,
    panelLength: p.height - t + p.dadoDepth,
    shelfLength: bayWidth + 2 * p.dadoDepth,
    panelX,
    partitionLeft: t - 2 * p.dadoDepth,
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
  if (p.cutoutHeight >= p.shelfHeight) {
    refuse('cutout-too-tall', 'The cutout between the feet would reach the shelf.', [
      'cutoutHeight',
      'shelfHeight',
    ]);
  }
  if (2 * p.footWidth >= p.caseDepth) {
    refuse('feet-meet', 'The front and back feet would meet.', ['footWidth', 'caseDepth']);
  }
  if (g.bayHeight < p.jacket) {
    refuse(
      'bay-too-low',
      `Each bay is ${len(g.bayHeight)} high, less than a ${len(p.jacket)} record jacket.`,
      ['height', 'shelfHeight', 'jacket'],
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
