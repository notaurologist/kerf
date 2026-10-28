import { formatLength } from '../../units/length.ts';
import type { Flag, Issue } from '../types.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';

// Validation and flags (docs/templates/swing-set-a-frame.md, Validation and Flags).

/** Below this much wood left at the top of the flush cut, the cut gets an expert-check flag. */
export const THIN_FLUSH_CUT = 1;

const len = (inches: number) => formatLength(inches);

/** Combinations of parameters the frame can't be built from. */
export function validate(dims: Dimensions, g: FrameGeometry): Issue[] {
  const issues: Issue[] = [];

  if (g.flushCut.woodLeftAtTop <= 0) {
    issues.push({
      code: 'flush-cut-through-leg',
      message: `The flush cut against the beam would be ${len(g.flushCut.depthAtTop)} deep, which goes through the ${len(dims.w)} leg. Use thicker legs, a shallower beam, or less splay.`,
      params: ['legStock', 'beamStock', 'splay'],
    });
  }

  if (dims.zc > dims.H - dims.gh) {
    issues.push({
      code: 'crossbar-overlaps-gusset',
      message: `The crossbar's top edge (${len(dims.zc)} up) is above the bottom of the gusset (${len(dims.H - dims.gh)} up). Lower the crossbar.`,
      params: ['crossbarHeight', 'gussetStock', 'beamHeight'],
    });
  }

  const highestGround = Math.max(g.back.groundZ, g.front.groundZ);
  if (highestGround >= dims.H) {
    issues.push({
      code: 'slope-too-steep',
      message: 'The ground is too steep: a leg would meet it at or above the beam.',
      params: ['groundSlope', 'splay'],
    });
  }

  if (dims.zc - dims.cw <= highestGround) {
    issues.push({
      code: 'crossbar-below-grade',
      message: `The crossbar's bottom edge (${len(Math.max(dims.zc - dims.cw, 0))} up) is at or below the ground at the uphill legs. Raise the crossbar.`,
      params: ['crossbarHeight', 'crossbarStock', 'groundSlope'],
    });
  }

  if (dims.plies > 1 && dims.beamBoardThickness !== 1.5) {
    issues.push({
      code: 'built-up-beam-stock',
      message: 'A built-up beam is made of 2x boards. Use a 2x size for the beam, or one ply.',
      params: ['beamStock', 'beamPlies'],
    });
  }

  if (2 * (dims.e + dims.t) >= dims.L) {
    issues.push({
      code: 'frames-do-not-fit',
      message: `Two frames set ${len(dims.e)} in from each end of a ${len(dims.L)} beam overlap. Reduce the frame inset or lengthen the beam.`,
      params: ['frameInset', 'beamLength', 'legStock'],
    });
  }

  return issues;
}

/** Expert-check flags for a frame that validates. */
export function flags(dims: Dimensions, g: FrameGeometry): Flag[] {
  const result: Flag[] = [
    {
      category: 'load-bearing',
      ask: `Confirm the bolt size for the leg-to-beam bolt (${len(g.boltGrip)} of wood), the ${len(g.flushCut.woodLeftAtBolt)} of leg left at the bolt after the flush cut, and how the head and nut bear on the leg's tilted outer face.`,
      why: 'This joint and the gusset carry the beam and every swing load.',
    },
  ];

  if (g.flushCut.woodLeftAtTop < THIN_FLUSH_CUT) {
    result.push({
      category: 'load-bearing',
      ask: `Only ${len(g.flushCut.woodLeftAtTop)} of leg is left at the top of the flush cut. Confirm that is enough.`,
      why: 'The flush cut thins the leg where it is bolted to the beam.',
    });
  }

  if (dims.plies > 1) {
    result.push({
      category: 'load-bearing',
      ask: `Confirm how the ${dims.plies} beam plies are fastened together: fastener type, size, spacing, and pattern.`,
      why: 'A built-up beam only acts as one member when its plies are fastened well enough to share the load.',
    });
  }

  if (dims.d > 0) {
    result.push({
      category: 'load-bearing',
      ask: `Confirm the burial depth (${len(dims.d)}) and that the leg lumber is rated for ground contact.`,
      why: 'Buried legs anchor the frame against lifting and walking, and wood decays fastest at the ground line.',
    });
  } else {
    result.push({
      category: 'load-bearing',
      ask: 'Confirm the pads or footings and the ground anchors for each foot.',
      why: 'On pads, the anchors alone keep the frame from lifting or walking under swing loads.',
    });
  }

  return result;
}
