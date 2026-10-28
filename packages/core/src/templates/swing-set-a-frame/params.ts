import { z } from 'zod';
import { NOMINAL_SIZES, type NominalSize } from '../../lumber/stock.ts';

// Parameters for template version 1 (docs/templates/swing-set-a-frame.md, Parameters).
// Lengths in inches, angles in degrees.

const Nominal = z.enum(NOMINAL_SIZES as [NominalSize, ...NominalSize[]]);

const Splay = z.discriminatedUnion('kind', [
  /** Each leg's angle from vertical. */
  z.object({ kind: z.literal('angle'), degrees: z.number().min(5).max(35) }),
  /** Plan-view distance between the outer faces of the front and back legs at grade. */
  z.object({ kind: z.literal('footprint'), depth: z.number().positive() }),
]);

export const SwingSetParams = z.object({
  beamLength: z.number().min(48).max(240),
  /** Height of the underside of the beam above the ground directly under it. */
  beamHeight: z.number().min(60).max(144),
  splay: Splay,
  /** Stands on edge: thickness is its width, width is its depth. */
  beamStock: Nominal,
  /** 1 for a solid beam; 2 or 3 for a built-up beam of 2x plies fastened face to face (0012). */
  beamPlies: z.number().int().min(1).max(3),
  /** Width lies toward the beam, in the plane of the A-frame; thickness runs along the beam. */
  legStock: Nominal,
  /** Width is the crossbar's vertical depth. */
  crossbarStock: Nominal,
  /** Height of the crossbar's top edge above the ground under the beam. */
  crossbarHeight: z.number().positive(),
  /** Width is the gusset's height below the beam. */
  gussetStock: Nominal,
  /** Beam end to the outside face of that frame's legs. */
  frameInset: z.number().min(0),
  /** Inches the ground falls per foot toward the front. Negative means the front is uphill. */
  groundSlope: z.number().min(-3).max(3),
  /** How far each leg extends below grade, measured vertically. 0 for pads. */
  burialDepth: z.number().min(0).max(48),
});

export type SwingSetParams = z.infer<typeof SwingSetParams>;
