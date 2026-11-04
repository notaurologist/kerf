import type { BoardStock, PanelAllowances } from '../../lumber/panel.ts';
import type { CupHinge } from '../../model/cupHinge.ts';
import type { DrawerSlide } from '../../model/drawerSlide.ts';
import type { ViseScrew } from '../../model/viseScrew.ts';

// The workbench's parameters (docs/templates/workbench.md, Parameters), in inches. The schema,
// form, and starting questions come with the template's definition.

export interface WorkbenchParams {
  /** H: floor to the top surface. */
  height: number;
  /** L, D, T: the top's length, depth, and thickness after flattening. */
  topLength: number;
  topDepth: number;
  topThickness: number;
  /** o_e: the top past the legs at each end; i_f, i_b: past the front and back legs. */
  overhangEnds: number;
  overhangFront: number;
  overhangBack: number;
  /** s: leg size, square. */
  legSize: number;
  /** h_f: foot height; the feet are s wide. f_o: feet past the legs, front and back. */
  footHeight: number;
  footPast: number;
  /** h_r: low rail height. h_e: end rail height. t_r: both rails' thickness. */
  lowRailHeight: number;
  endRailHeight: number;
  railThickness: number;
  /** The rails' tenons: thickness, length into the leg, and shoulders above and below. */
  railTenon: { thickness: number; length: number; shoulder: number };
  /** The legs' tenons, into the feet and through the top: thickness, shoulder, length into the foot. */
  legTenon: { thickness: number; shoulder: number; footLength: number };
  /** t_c: the case's panels; j: dado depth; s_d: how far the shelves' dadoes stop from the front. */
  caseThickness: number;
  dadoDepth: number;
  stopSetback: number;
  /** h_db: the drawer band under the top; the upper drawers' opening, the lower's the rest. */
  drawerBand: number;
  upperOpening: number;
  /** The case back's grooves, set `inset` in from the case's back edge; the shelves stop short of it. */
  back: { grooveWidth: number; grooveDepth: number; inset: number; shelfGap: number };
  /** The drawers' side-mount slides, from their maker (hard rule 3). */
  slides: DrawerSlide;
  /**
   * The drawers: box parts and bottom thickness, the inset front's thickness and its gap all round,
   * the box's clearance above and below in its opening, the bottom's groove (width, depth, and how
   * far up from the box's bottom edge), and the dovetails' slope, 1 in `slope`.
   */
  drawer: {
    boxThickness: number;
    bottomThickness: number;
    frontThickness: number;
    frontGap: number;
    clearance: number;
    groove: { width: number; depth: number; up: number };
    slope: number;
  };
  /**
   * The two inset doors: their gap all round and between them, the stiles' and rails' width, the
   * panel grooves' width and depth (the stub tenons' too), each hinge's cup from its door's end,
   * and the hinge, from its maker (hard rule 3).
   */
  door: {
    gap: number;
    frameWidth: number;
    grooveWidth: number;
    grooveDepth: number;
    hingeFromEnd: number;
    hinge: CupHinge;
  };
  /** c: both vises' chops. */
  chopThickness: number;
  /**
   * The vises and dog holes. The face vise's chop is as tall as `height`, its screw `screwBelow`
   * the top's underside; the end vise's block is `blockHeight` under the top. Dog holes are
   * `spacing` apart on center, `fromFront` in from the top's front edge, and stopped `stopShort`
   * above the top's underside where something is under it. Each screw is from its maker.
   */
  vise: {
    face: { height: number; screwBelow: number; screw: ViseScrew };
    end: { blockHeight: number; screw: ViseScrew };
    dogs: { diameter: number; spacing: number; fromFront: number; stopShort: number };
  };
  board: BoardStock;
  allowances: PanelAllowances;
  kerf: number;
}

/** The worked example (docs/templates/workbench.md, Worked example). */
export const EXAMPLE: WorkbenchParams = {
  height: 34.125,
  topLength: 61.875,
  topDepth: 17.625,
  topThickness: 2.5,
  overhangEnds: 5,
  overhangFront: 0,
  overhangBack: 1,
  legSize: 3,
  footHeight: 3,
  footPast: 1,
  lowRailHeight: 3,
  endRailHeight: 3,
  railThickness: 1.5,
  railTenon: { thickness: 0.5, length: 1.75, shoulder: 0.25 },
  legTenon: { thickness: 1, shoulder: 0.25, footLength: 1.75 },
  caseThickness: 0.75,
  dadoDepth: 0.1875,
  stopSetback: 0.5,
  drawerBand: 10,
  upperOpening: 3.25,
  back: { grooveWidth: 0.25, grooveDepth: 0.375, inset: 0.375, shelfGap: 0.0625 },
  slides: { sideClearance: 0.5, shortest: 10, longest: 28, step: 2 },
  drawer: {
    boxThickness: 0.5,
    bottomThickness: 0.5,
    frontThickness: 0.75,
    frontGap: 0.0625,
    clearance: 0.25,
    groove: { width: 0.25, depth: 0.25, up: 0.25 },
    slope: 8,
  },
  door: {
    gap: 0.0625,
    frameWidth: 2,
    grooveWidth: 0.25,
    grooveDepth: 0.375,
    hingeFromEnd: 3,
    // Illustrative, until the owner enters their hinge's figures: a 35 mm cup (Striegler, Fine
    // Homebuilding 213), the rest made up for the example.
    hinge: {
      cupDiameter: 35 / 25.4,
      cupDepth: 0.5,
      cupFromEdge: 0.1875,
      plateSetback: 0.625,
      plateScrews: 2,
      plateScrewSpacing: 1.25,
      minThickness: 0.625,
      maxThickness: 1,
    },
  },
  chopThickness: 2.5,
  // The screws' sizes are illustrative, until the owner enters theirs.
  vise: {
    face: {
      height: 14,
      screwBelow: 4,
      screw: {
        screwHole: 1.125,
        maxOpening: 8,
        guides: 1,
        guideHole: 0.875,
        guideFromScrew: 5,
        mountingScrews: 4,
      },
    },
    end: {
      blockHeight: 3.5,
      screw: {
        screwHole: 1.125,
        maxOpening: 8,
        guides: 2,
        guideHole: 0.875,
        guideFromScrew: 4,
        mountingScrews: 4,
      },
    },
    dogs: { diameter: 0.75, spacing: 4, fromFront: 2, stopShort: 0.25 },
  },
  board: { nominal: '4/4 cherry', thickness: 0.8125, width: 5.5, buyableFeet: [6, 8, 10] },
  allowances: { jointPerEdge: 0.0625, rip: 0.5, trimPerEnd: 1, flatten: 0.0625 },
  kerf: 0.125,
};
