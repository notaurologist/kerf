import type { BoardStock, DrawerSlide, PanelAllowances } from '@kerf/core';

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
  board: { nominal: '4/4 cherry', thickness: 0.8125, width: 5.5, buyableFeet: [6, 8, 10] },
  allowances: { jointPerEdge: 0.0625, rip: 0.5, trimPerEnd: 1, flatten: 0.0625 },
  kerf: 0.125,
};
