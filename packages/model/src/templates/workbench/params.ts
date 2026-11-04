import type { BoardStock, StripAllowances } from '@kerf/core';

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
  board: BoardStock;
  allowances: StripAllowances;
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
  board: { nominal: '4/4 cherry', thickness: 0.8125, width: 5.5, buyableFeet: [6, 8, 10] },
  allowances: { rip: 0.5, trimPerEnd: 1, flatten: 0.0625 },
  kerf: 0.125,
};
