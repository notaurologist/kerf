import { z } from 'zod';

// Parameters (docs/templates/record-cabinet.md, Parameters, and The Shaker-modern base). Lengths
// in inches. Every number has a range (spec, Ranges that bound generation): a board's width and the
// jointing allowance set how many boards each panel takes, and a range on each keeps that count
// and the time to generate bounded.

/** The smallest length Kerf shows; a router depth is set in sixteenths. */
const SIXTEENTH = 0.0625;
/** Boards from a 1x2 (1-1/2") to a 1x12 (11-1/4"), rounded out to 12. */
const BOARD_WIDTH = { min: 1.5, max: 12 } as const;
/** Thinner than the thinnest panel makes nothing; 2" is past 8/4 surfaced. */
const BOARD_THICKNESS = { min: 0.625, max: 2 } as const;
/** Feet: lengths sold, up to the 16' a dealer's hardwood comes in. */
const LENGTHS = z.array(z.number().int().min(1).max(16)).min(1).max(4);

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
  dadoDepth: z.number().min(SIXTEENTH).max(0.5),
  /** s_d: how far the top's and the case bottom's dadoes stop short of the case's front edge. */
  stoppedSetback: z.number().min(SIXTEENTH).max(20),
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
    lengths: LENGTHS,
  }),
  /** s_f: each leg's foot, after the inside faces are tapered. */
  footSize: z.number().min(SIXTEENTH).max(3),
  /** r_a: how far each apron's face sits back from its legs' outside faces. */
  apronSetback: z.number().min(0).max(3),
  /** t_t: each tenon's thickness. */
  tenonThickness: z.number().min(SIXTEENTH).max(BOARD_THICKNESS.max),
  /** l_t: each tenon's length into its leg. */
  tenonLength: z.number().min(SIXTEENTH).max(3),
  /** Sliding doors on the end bays (#339), or none. */
  doors: z.enum(['sliding', 'none']),
  /** The doors' tracks and frames (spec, Sliding doors on the end bays). */
  door: z.object({
    /** c_g: each track groove is the door's thickness plus this. */
    clearance: z.number().min(0).max(0.125),
    /** l_g: wood between and around the track grooves. */
    land: z.number().min(0.125).max(0.5),
    /** d_b: each bottom track's depth. */
    bottomDepth: z.number().min(0.125).max(0.5),
    /** d_u: each top track's depth, deeper so a door lifts in. */
    topDepth: z.number().min(0.25).max(1),
    /** o_d: how far each door runs past the partition, over the next bay. */
    overlap: z.number().min(0).max(2),
    /** w_s: each stile's and rail's width. */
    frameWidth: z.number().min(1.5).max(4),
    /** g_s: the panel grooves' depth, and the rails' stub tenons' length. */
    grooveDepth: z.number().min(0.25).max(0.5),
  }),
  /** h_r: vertical width of each back rail. */
  railHeight: z.number().min(2).max(4),
  /** s_r: one of the owner's record jackets, measured. */
  jacket: z.number().min(SIXTEENTH).max(18),
  /** The largest item that stands on the top: its footprint, and its height at its tallest. */
  topItem: z.object({
    width: z.number().min(SIXTEENTH).max(72),
    depth: z.number().min(SIXTEENTH).max(72),
    height: z.number().min(SIXTEENTH).max(72),
  }),
  /** The boards every panel is glued from: a store's fixed-width boards (#278), or a dealer's (#296). */
  board: z.discriminatedUnion('source', [
    z.object({
      source: z.literal('store'),
      thickness: z.number().min(BOARD_THICKNESS.min).max(BOARD_THICKNESS.max),
      width: z.number().min(BOARD_WIDTH.min).max(BOARD_WIDTH.max),
      /** Lengths the store sells, in feet, entered in order. */
      lengths: LENGTHS,
    }),
    z.object({
      source: z.literal('dealer'),
      /** The thickness class in quarter inches: 4 for 4/4. */
      quarters: z.union([z.literal(4), z.literal(5), z.literal(6), z.literal(8)]),
      /** Actual thickness as surfaced two sides. */
      surfaced: z.number().min(BOARD_THICKNESS.min).max(BOARD_THICKNESS.max),
      /** The board width the plan counts on; wider boards need fewer. */
      planWidth: z.number().min(BOARD_WIDTH.min).max(BOARD_WIDTH.max),
      /** Extra board feet for defects and offcuts, in percent. */
      wastePercent: z.number().min(0).max(100),
    }),
  ]),
  /**
   * Extra wood for the panels (lumber/panel.ts), each up to four times its suggestion. A
   * jointing allowance near half a board's width would make a panel of thousands of boards.
   */
  allowances: z.object({
    jointPerEdge: z.number().min(0).max(0.25),
    rip: z.number().min(0).max(2),
    trimPerEnd: z.number().min(0).max(4),
    flatten: z.number().min(0).max(0.25),
  }),
});
export type RecordCabinetParams = z.infer<typeof RecordCabinetParams>;
