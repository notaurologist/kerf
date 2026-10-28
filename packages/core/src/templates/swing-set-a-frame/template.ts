import type { z } from 'zod';
import { stock } from '../../lumber/stock.ts';
import { formatAngle } from '../../units/angle.ts';
import { formatLength } from '../../units/length.ts';
import type { Flag, GenerateResult, HardwareItem, Issue, Part } from '../types.ts';
import {
  type Dimensions,
  dimensions,
  type FrameGeometry,
  frameGeometry,
  legsReachGround,
  splayForFootprint,
} from './geometry.ts';
import { hardware, validateHardware } from './hardware.ts';
import { type SiteLayout, type SwingGeometry, siteLayout, swingGeometry } from './layout.ts';
import { SwingSetParams } from './params.ts';
import { flags, validate, validateSwings } from './validate.ts';

/**
 * Bump whenever output for the same parameters would change (decision 0008).
 * Version 1 matches docs/templates/swing-set-a-frame.md, status v1.
 */
export const TEMPLATE_VERSION = 1;
export const TEMPLATE_ID = 'swing-set-a-frame';

export interface SwingSetOutput {
  params: SwingSetParams;
  geometry: FrameGeometry;
  swings: SwingGeometry;
  layout: SiteLayout;
  parts: Part[];
  hardware: HardwareItem[];
  flags: Flag[];
}

function parseIssues(error: z.ZodError): Issue[] {
  return error.issues.map((issue) => ({
    code: `invalid-${issue.code}`,
    message: issue.message,
    params: issue.path.length > 0 ? [String(issue.path[0])] : [],
  }));
}

/** "Back leg (uphill)", or no slope note on level ground. Ground falls toward the front when g > 0. */
function legName(side: 'back' | 'front', groundSlope: number): string {
  const name = side === 'back' ? 'Back leg' : 'Front leg';
  if (groundSlope === 0) return name;
  const uphill = (side === 'back') === groundSlope > 0;
  return `${name} (${uphill ? 'uphill' : 'downhill'})`;
}

function parts(p: SwingSetParams, dims: Dimensions, g: FrameGeometry): Part[] {
  const angle = formatAngle(g.splay);
  const levelCut = (where: string) => ({
    setting: g.splay,
    description: `${where}: level cut`,
  });
  const leg = (side: 'back' | 'front'): Part => {
    const l = g[side];
    return {
      id: `leg-${side}`,
      name: legName(side, p.groundSlope),
      role: 'leg',
      stock: stock(p.legStock),
      quantity: 2,
      length: l.overallLength,
      markLengths: [{ label: 'Each edge, top cut to foot cut', value: l.edgeLength }],
      ends: [levelCut('Top'), levelCut('Foot')],
      endsParallel: true,
      notes: [
        `Flush cut on the inside face at the top: starts on the inner edge ${formatLength(g.flushCut.lengthAlongLeg)} below the top cut and runs at ${angle} to that edge, ending ${formatLength(g.flushCut.depthAtTop)} in from it at the top.`,
        ...(dims.d > 0 ? [`${formatLength(l.belowGrade)} of this leg is below grade.`] : []),
      ],
    };
  };

  return [
    {
      id: 'beam',
      name: p.beamPlies > 1 ? 'Beam ply' : 'Beam',
      role: 'beam',
      stock: stock(p.beamStock),
      quantity: p.beamPlies,
      length: dims.L,
      markLengths: [],
      ends: [
        { setting: 0, description: 'Square' },
        { setting: 0, description: 'Square' },
      ],
      endsParallel: true,
      notes:
        p.beamPlies > 1
          ? [
              `${p.beamPlies} plies fastened face to face make one ${formatLength(dims.bw)} wide beam.`,
            ]
          : [],
    },
    leg('back'),
    leg('front'),
    {
      id: 'crossbar',
      name: 'Crossbar',
      role: 'crossbar',
      stock: stock(p.crossbarStock),
      quantity: 2,
      length: g.crossbar.bottomEdge,
      markLengths: [
        { label: 'Top edge', value: g.crossbar.topEdge },
        { label: 'Bottom edge', value: g.crossbar.bottomEdge },
      ],
      ends: [
        { setting: g.splay, description: 'Flush with the leg' },
        { setting: g.splay, description: 'Flush with the leg' },
      ],
      endsParallel: false,
      notes: ['Fastened to the outside face of the legs.'],
    },
    {
      id: 'gusset',
      name: 'Gusset',
      role: 'gusset',
      stock: stock(p.gussetStock),
      quantity: 2,
      length: g.gusset.bottomWidth,
      markLengths: [
        { label: 'Top edge (against the beam)', value: g.gusset.topWidth },
        { label: 'Bottom edge', value: g.gusset.bottomWidth },
      ],
      ends: [
        { setting: g.splay, description: 'Flush with the leg' },
        { setting: g.splay, description: 'Flush with the leg' },
      ],
      endsParallel: false,
      notes: ["On the outside face of the frame, top edge against the beam's underside."],
    },
  ];
}

export function generate(input: unknown): GenerateResult<SwingSetOutput> {
  const parsed = SwingSetParams.safeParse(input);
  if (!parsed.success) return { ok: false, issues: parseIssues(parsed.error) };
  const p = parsed.data;
  const dims = dimensions(p);

  let splay: number;
  if (p.splay.kind === 'angle') {
    splay = p.splay.degrees;
  } else {
    const solved = splayForFootprint(dims, p.splay.depth);
    if (solved === null) {
      return {
        ok: false,
        issues: [
          {
            code: 'footprint-out-of-range',
            message:
              'No splay between 5° and 35° gives that footprint depth with these parameters.',
            params: ['splay'],
          },
        ],
      };
    }
    splay = solved;
  }

  if (!legsReachGround(dims, splay)) {
    return {
      ok: false,
      issues: [
        {
          code: 'slope-too-steep',
          message:
            'The ground is too steep for this splay: a leg would not meet it below the beam.',
          params: ['groundSlope', 'splay'],
        },
      ],
    };
  }

  const g = frameGeometry(dims, splay);
  const swings = swingGeometry(p);
  const issues = [...validate(dims, g), ...validateSwings(dims, swings), ...validateHardware(p)];
  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    output: {
      params: p,
      geometry: g,
      swings,
      layout: siteLayout(p, g, swings),
      parts: parts(p, dims, g),
      hardware: hardware(p, dims, g),
      flags: flags(dims, g),
    },
  };
}
