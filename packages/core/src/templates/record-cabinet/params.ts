import { z } from 'zod';
import { PanelAllowances } from '../../lumber/panel.ts';

// Parameters (docs/templates/record-cabinet.md, Parameters, and The Shaker-modern base). Lengths
// in inches.

export const RecordCabinetParams = z.object({
  /** W: the top's length, end to end. */
  width: z.number().min(30).max(72),
  /** h_b: each bay's clear height, from the case bottom to the underside of the top. */
  bayHeight: z.number().min(12).max(18),
  /** D_c: front to back of the sides, partitions, and shelves. */
  caseDepth: z.number().min(13).max(20),
  /** n: equal bays. */
  bays: z.number().int().min(2).max(4),
  /** t: every panel, after flattening. */
  panelThickness: z.number().min(0.625).max(1),
  /** j: every dado. */
  dadoDepth: z.number().positive(),
  /** s_d: how far the top's and the case bottom's dadoes stop short of the case's front edge. */
  stoppedSetback: z.number().positive(),
  /** o_s: the top past each side. */
  endOverhang: z.number().min(0).max(2),
  /** o_f: the top past the case's front. */
  frontOverhang: z.number().min(0).max(2),
  /** h_l: each leg showing below the aprons, floor to the aprons' bottom edge. */
  legShowing: z.number().min(2).max(12),
  /** h_a: each apron's height. */
  apronHeight: z.number().min(1.5).max(5),
  /** The square stock the legs are cut from, as the store sells it (#344). */
  legStock: z.object({
    /** s: its actual size, both ways. */
    size: z.number().min(1).max(3),
    /** Lengths sold, in feet, entered in order. */
    lengths: z.array(z.number().int().positive()).min(1).max(4),
  }),
  /** s_f: each leg's foot, after the inside faces are tapered. */
  footSize: z.number().positive(),
  /** r_a: how far each apron's face sits back from its legs' outside faces. */
  apronSetback: z.number().min(0),
  /** t_t: each tenon's thickness. */
  tenonThickness: z.number().positive(),
  /** l_t: each tenon's length into its leg. */
  tenonLength: z.number().positive(),
  /** h_r: vertical width of each back rail. */
  railHeight: z.number().min(2).max(4),
  /** s_r: one of the owner's record jackets, measured. */
  jacket: z.number().positive(),
  /** The largest item that stands on the top: its footprint, and its height at its tallest. */
  topItem: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
  }),
  /** The boards every panel is glued from: a store's fixed-width boards (#278), or a dealer's (#296). */
  board: z.discriminatedUnion('source', [
    z.object({
      source: z.literal('store'),
      thickness: z.number().positive(),
      width: z.number().positive(),
      /** Lengths the store sells, in feet, entered in order. */
      lengths: z.array(z.number().int().positive()).min(1).max(4),
    }),
    z.object({
      source: z.literal('dealer'),
      /** The thickness class in quarter inches: 4 for 4/4. */
      quarters: z.union([z.literal(4), z.literal(5), z.literal(6), z.literal(8)]),
      /** Actual thickness as surfaced two sides. */
      surfaced: z.number().positive(),
      /** The board width the plan counts on; wider boards need fewer. */
      planWidth: z.number().positive(),
      /** Extra board feet for defects and offcuts, in percent. */
      wastePercent: z.number().min(0).max(100),
    }),
  ]),
  allowances: PanelAllowances,
});
export type RecordCabinetParams = z.infer<typeof RecordCabinetParams>;
