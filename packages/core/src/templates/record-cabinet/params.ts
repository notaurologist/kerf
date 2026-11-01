import { z } from 'zod';
import { PanelAllowances } from '../../lumber/panel.ts';

// Parameters for template version 1 (docs/templates/record-cabinet.md, Parameters). Lengths in
// inches.

/** Where the speaker goes: on the top beside the turntable, or on one bay's shelf, from the left. */
const SpeakerPlace = z.union([z.literal('top'), z.number().int().min(1).max(4)]);

export const RecordCabinetParams = z.object({
  /** W: the top's length, end to end. */
  width: z.number().min(30).max(72),
  /** H: floor to the top surface. */
  height: z.number().min(16).max(30),
  /** D_c: front to back of the sides, partitions, and shelves. */
  caseDepth: z.number().min(13).max(20),
  /** n: equal bays. */
  bays: z.number().int().min(2).max(4),
  /** t: every panel, after flattening. */
  panelThickness: z.number().min(0.625).max(1),
  /** j: every dado. */
  dadoDepth: z.number().positive(),
  /** s_d: how far the top's dadoes stop short of the case's front edge. */
  stoppedSetback: z.number().positive(),
  /** o_s: the top past each side. */
  endOverhang: z.number().min(0).max(2),
  /** o_f: the top past the case's front. */
  frontOverhang: z.number().min(0).max(2),
  /** h_f: floor to the underside of the bottom shelves. */
  shelfHeight: z.number().min(3).max(10),
  /** h_c: height of the cutout between the feet; 0 for none. */
  cutoutHeight: z.number().min(0),
  /** f_w: front to back width of each foot. */
  footWidth: z.number().min(2),
  /** h_r: vertical width of each back rail. */
  railHeight: z.number().min(2).max(4),
  /** s_r: one of the owner's record jackets, measured. */
  jacket: z.number().positive(),
  turntable: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    /** With the lid fully open. */
    lidHeight: z.number().positive(),
  }),
  speaker: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
    place: SpeakerPlace,
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
