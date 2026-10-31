import type { Flag, Issue } from '../../model/types.ts';
import { formatLength } from '../../units/length.ts';
import type { Dimensions, FrameGeometry } from './geometry.ts';
import { CLEARANCES, type SwingGeometry } from './layout.ts';

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

/** Swing positions against the frame and the CPSC spacing (spec, Validation). */
export function validateSwings(dims: Dimensions, s: SwingGeometry): Issue[] {
  const issues: Issue[] = [];
  const gap = CLEARANCES.seatGap.value;
  const [left, right] = s.seats;
  const leftFace = dims.e + dims.t;
  const rightFace = dims.L - dims.e - dims.t;
  const [h1, h2, h3, h4] = s.hangersX;

  if (h2 >= h3) {
    issues.push({
      code: 'hangers-overlap',
      message: 'The two swings overlap. Move the swing centers apart or reduce the hanger spacing.',
      params: ['swings'],
    });
  }
  if (h1 < leftFace || h4 > rightFace) {
    issues.push({
      code: 'hanger-outside-span',
      message: `Hangers must be between the frames' inside faces (${len(leftFace)} to ${len(rightFace)} along the beam).`,
      params: ['swings', 'frameInset'],
    });
  }
  if (left.xMin - leftFace < gap || rightFace - right.xMax < gap) {
    issues.push({
      code: 'seat-too-close-to-frame',
      message: `Each seat needs at least ${len(gap)} of space from the frame (${CLEARANCES.seatGap.source}).`,
      params: ['swings'],
    });
  }
  if (right.xMin - left.xMax < gap) {
    issues.push({
      code: 'seats-too-close',
      message: `The seats need at least ${len(gap)} between them (${CLEARANCES.seatGap.source}).`,
      params: ['swings'],
    });
  }
  if (dims.H - s.chainLength < CLEARANCES.seatClearance.value) {
    issues.push({
      code: 'seat-too-low',
      message: `Seats need at least ${len(CLEARANCES.seatClearance.value)} above the ground (${CLEARANCES.seatClearance.source}).`,
      params: ['swings'],
    });
  }
  return issues;
}

/** The part IDs of the legs (template.ts, parts). */
export const LEG_IDS = ['leg-back', 'leg-front'];

/**
 * Expert-check flags for a frame that validates, each with the parts and hardware it concerns.
 * Ply bolts and ground anchors are named only where `validateHardware` requires them.
 */
export function flags(dims: Dimensions, g: FrameGeometry): Flag[] {
  const result: Flag[] = [
    {
      category: 'load-bearing',
      partIds: [...LEG_IDS, 'beam'],
      hardwareIds: ['leg-beam-bolts'],
      ask: `Confirm the bolt size for the leg-to-beam bolt (${len(g.boltGrip)} of wood), the ${len(g.flushCut.woodLeftAtBolt)} of leg left at the bolt after the flush cut, and how the head and nut bear on the leg's tilted outer face.`,
      why: 'This joint and the gusset carry the beam and every swing load.',
    },
  ];

  if (g.flushCut.woodLeftAtTop < THIN_FLUSH_CUT) {
    result.push({
      category: 'load-bearing',
      partIds: [...LEG_IDS],
      hardwareIds: [],
      ask: `Only ${len(g.flushCut.woodLeftAtTop)} of leg is left at the top of the flush cut. Confirm that is enough.`,
      why: 'The flush cut thins the leg where it is bolted to the beam.',
    });
  }

  if (dims.plies > 1) {
    result.push({
      category: 'load-bearing',
      partIds: ['beam'],
      hardwareIds: ['ply-bolts'],
      ask: `Confirm how the ${dims.plies} beam plies are fastened together: fastener type, size, spacing, and pattern.`,
      why: 'A built-up beam only acts as one member when its plies are fastened well enough to share the load.',
    });
  }

  if (dims.k !== 0) {
    result.push({
      category: 'load-bearing',
      partIds: [...LEG_IDS],
      hardwareIds: [],
      ask: 'Confirm the frame on sloped ground: leg lengths, footing or burial on the downhill side, and whether to regrade instead.',
      why: 'The CPSC home handbook recommends a level site to reduce the chance of tipping (Pub. 324, p. 2).',
    });
  }

  if (dims.d > 0) {
    result.push({
      category: 'load-bearing',
      partIds: [...LEG_IDS],
      hardwareIds: [],
      ask: `Confirm the burial depth (${len(dims.d)}) and that the leg lumber is rated for ground contact.`,
      why: 'Buried legs anchor the frame against lifting and walking, and wood decays fastest at the ground line.',
    });
  } else {
    result.push({
      category: 'load-bearing',
      partIds: [...LEG_IDS],
      hardwareIds: ['ground-anchors'],
      ask: 'Confirm the pads or footings and the ground anchors for each foot.',
      why: 'On pads, the anchors alone keep the frame from lifting or walking under swing loads.',
    });
  }

  return result;
}
