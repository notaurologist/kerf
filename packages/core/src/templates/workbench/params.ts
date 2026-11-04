import { z } from 'zod';
import { CupHinge } from '../../model/cupHinge.ts';
import { DrawerSlide } from '../../model/drawerSlide.ts';
import { ViseScrew } from '../../model/viseScrew.ts';

// The workbench's parameters (docs/templates/workbench.md, Parameters), in inches. Every number
// has a range: the spec's where it gives one, and otherwise a few times the suggested value, so no
// entry asks for any number of parts or a size the display cannot show.

const SIXTEENTH = 0.0625;
/** Boards from a 1x2 (1-1/2") to a 1x12 (11-1/4"), rounded out to 12. */
const BOARD_WIDTH = { min: 1.5, max: 12 } as const;
/** 5/8" up to past 8/4 surfaced. */
const BOARD_THICKNESS = { min: 0.625, max: 2 } as const;
const LENGTHS = z.array(z.number().int().min(1).max(16)).min(1).max(4);
const length = (min: number, max: number) => z.number().min(min).max(max);

export const WorkbenchParams = z.object({
  /** H: floor to the top surface. */
  height: length(28, 42),
  /** L, D, T: the top's length, depth, and thickness after flattening. */
  topLength: length(36, 96),
  topDepth: length(14, 30),
  topThickness: length(1.5, 4),
  /** o_e: the top past the legs at each end; i_f, i_b: past the front and back legs. */
  overhangEnds: length(2, 12),
  overhangFront: length(0, 3),
  overhangBack: length(0, 3),
  /** s: leg size, square. */
  legSize: length(2.5, 4),
  /** h_f: foot height; the feet are s wide. f_o: feet past the legs, front and back. */
  footHeight: length(2, 4),
  footPast: length(0, 3),
  /** h_r: low rail height. h_e: end rail height. t_r: both rails' thickness, at most s. */
  lowRailHeight: length(2, 5),
  endRailHeight: length(2, 5),
  railThickness: length(1, 4),
  /** The rails' tenons: thickness, length into the leg, and shoulders above and below. */
  railTenon: z.object({
    thickness: length(SIXTEENTH, 2),
    length: length(SIXTEENTH, 4),
    shoulder: length(0, 1),
  }),
  /** The legs' tenons, into the feet and through the top: thickness, shoulder, length into the foot. */
  legTenon: z.object({
    thickness: length(SIXTEENTH, 4),
    shoulder: length(0, 1),
    footLength: length(SIXTEENTH, 4),
  }),
  /** t_c: the case's panels; j: dado depth; s_d: how far the shelves' dadoes stop from the front. */
  caseThickness: length(0.625, 1),
  dadoDepth: length(SIXTEENTH, 0.5),
  stopSetback: length(SIXTEENTH, 30),
  /** h_db: the drawer band under the top; the upper drawers' opening, the lower's the rest. */
  drawerBand: length(6, 14),
  upperOpening: length(2, 12),
  /** The case back's grooves, set `inset` in from the case's back edge; the shelves stop short of it. */
  back: z.object({
    grooveWidth: length(SIXTEENTH, 1),
    grooveDepth: length(SIXTEENTH, 1),
    inset: length(SIXTEENTH, 2),
    shelfGap: length(0, 1),
  }),
  /** The drawers' side-mount slides, from their maker (hard rule 3). */
  slides: DrawerSlide,
  /**
   * The drawers: box parts and bottom thickness, the inset front's thickness and its gap all round,
   * the box's clearance above and below in its opening, the bottom's groove (width, depth, and how
   * far up from the box's bottom edge), and the dovetails' slope, 1 in `slope`.
   */
  drawer: z.object({
    boxThickness: length(0.25, 1),
    bottomThickness: length(0.25, 1),
    frontThickness: length(0.5, BOARD_THICKNESS.max),
    frontGap: length(0, 0.25),
    clearance: length(0, 1),
    groove: z.object({
      width: length(SIXTEENTH, 0.5),
      depth: length(SIXTEENTH, 0.5),
      up: length(SIXTEENTH, 1),
    }),
    slope: z.number().int().min(6).max(8),
  }),
  /**
   * The two inset doors: their gap all round and between them, the stiles' and rails' width, the
   * panel grooves' width and depth (the stub tenons' too), each hinge's cup from its door's end,
   * and the hinge, from its maker (hard rule 3): missing until the owner enters it.
   */
  door: z.object({
    gap: length(0, 0.25),
    frameWidth: length(1, 4),
    grooveWidth: length(0.125, 0.5),
    grooveDepth: length(0.25, 0.5),
    hingeFromEnd: length(1, 12),
    hinge: CupHinge.optional(),
  }),
  /** c: both vises' chops. */
  chopThickness: length(1.5, 3),
  /**
   * The vises and dog holes. The face vise's chop is `height` tall, its screw `screwBelow` the
   * top's underside; the end vise's block is `blockHeight` under the top. Dog holes are `spacing`
   * apart on center, `fromFront` in from the top's front edge, and stopped `stopShort` above the
   * top's underside where something is under it. Each screw is from its maker, missing until the
   * owner enters it.
   */
  vise: z.object({
    face: z.object({
      height: length(4, 24),
      screwBelow: length(1, 12),
      screw: ViseScrew.optional(),
    }),
    end: z.object({ blockHeight: length(1, 8), screw: ViseScrew.optional() }),
    dogs: z.object({
      diameter: length(0.25, 1.5),
      spacing: length(2, 12),
      fromFront: length(1, 6),
      stopShort: length(0, 1),
    }),
  }),
  /** The boards everything is cut and glued from: a store's fixed widths, or a dealer's. */
  board: z.discriminatedUnion('source', [
    z.object({
      source: z.literal('store'),
      thickness: length(BOARD_THICKNESS.min, BOARD_THICKNESS.max),
      width: length(BOARD_WIDTH.min, BOARD_WIDTH.max),
      /** Lengths the store sells, in feet, entered in order. */
      lengths: LENGTHS,
    }),
    z.object({
      source: z.literal('dealer'),
      /** The thickness class in quarter inches: 4 for 4/4. */
      quarters: z.union([z.literal(4), z.literal(5), z.literal(6), z.literal(8)]),
      /** Actual thickness as surfaced two sides. */
      surfaced: length(BOARD_THICKNESS.min, BOARD_THICKNESS.max),
      /** The board width the plan counts on; wider boards need fewer. */
      planWidth: length(BOARD_WIDTH.min, BOARD_WIDTH.max),
      /** Extra board feet for defects and offcuts, in percent. */
      wastePercent: z.number().min(0).max(100),
    }),
  ]),
  /** Extra wood for the panels and glue-ups (lumber/panel.ts), each up to four times its suggestion. */
  allowances: z.object({
    jointPerEdge: length(0, 0.25),
    rip: length(0, 2),
    trimPerEnd: length(0, 4),
    flatten: length(0, 0.25),
  }),
  /** The saw blade's kerf, between strips ripped from one board. */
  kerf: length(1 / 32, 0.25),
});
export type WorkbenchParams = z.infer<typeof WorkbenchParams>;
