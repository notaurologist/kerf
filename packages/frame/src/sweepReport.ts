// The sweep's report as Markdown (exploration #545, step 5), for the write-up to quote. Every
// count, range, median, and largest value is computed here from the run; nothing is entered by
// hand. Numbers are rounded only as they are written.

import type { JointModel } from './aFrame.ts';
import {
  type Instance,
  type JointResult,
  LEG_TOLERANCE,
  type Peak,
  type SweepRun,
  UPLIFT_FLOOR,
  UPLIFT_TOLERANCE,
  type Where,
} from './sweep.ts';
import { ASSUMPTIONS } from './swingSet.ts';

type Analyzed = Extract<Instance, { kind: 'analyzed' }>;
const JOINTS: readonly JointModel[] = ['pinned', 'rigid'];

const fixed = (x: number, digits: number) =>
  x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (x: number) => `${x >= 0 ? '+' : ''}${fixed(100 * x, 2)}%`;
const sig = (x: number) => (x === 0 ? '0' : Number(x.toPrecision(4)).toString());

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** One number per instance, with how it reads and where it is. */
interface Metric {
  title: string;
  unit: string;
  format: (x: number) => string;
  value: (i: Analyzed) => { value: number; at?: string } | null;
}

const peak =
  (
    joints: JointModel,
    key: keyof Omit<JointResult, 'sway' | 'solvedCases' | 'mechanismCases' | 'residual'>,
  ) =>
  (i: Analyzed) => {
    const p: Peak | null = i.joints[joints][key];
    return p ? { value: p.value, at: p.at } : null;
  };

const swayOf = (joints: JointModel) => (i: Analyzed) => {
  const s = i.joints[joints].sway;
  return s.kind === 'solved' ? { value: s.perPound } : null;
};

/** Pinned over rigid: how many times farther the frame moves along the beam with pinned joints. */
const swaySpread = (i: Analyzed) => {
  const p = i.joints.pinned.sway;
  const r = i.joints.rigid.sway;
  return p.kind === 'solved' && r.kind === 'solved' ? { value: p.perPound / r.perPound } : null;
};

/** Rigid against pinned, as a fraction of pinned. */
const spreadOf =
  (key: 'compression' | 'moment' | 'footUplift' | 'footHorizontal') => (i: Analyzed) => {
    const p = i.joints.pinned[key];
    const r = i.joints.rigid[key];
    return p && r && p.value > 0 && i.joints.pinned.sway.kind === 'solved'
      ? { value: (r.value - p.value) / p.value }
      : null;
  };

/** The push's largest load on a leg below its crossbar, over its push and support cases, against P. */
const pushOf = (joints: JointModel) => (i: Analyzed) => {
  const mine = i.pushes.filter((p) => p.joints === joints);
  if (mine.length === 0) return null;
  const top = mine.reduce((a, b) => (b.relative > a.relative ? b : a));
  return { value: top.relative, at: `${top.at}, ${top.load}; ${top.supports}` };
};

const METRICS: Metric[] = [
  ...JOINTS.map(
    (j): Metric => ({
      title: `Sway along the beam per pound, joints ${j}`,
      unit: 'in/lb',
      format: sig,
      value: swayOf(j),
    }),
  ),
  {
    title: 'Spread of sway: pinned over rigid',
    unit: 'times',
    format: (x) => fixed(x, 2),
    value: swaySpread,
  },
  ...JOINTS.flatMap((j): Metric[] => [
    {
      title: `Largest axial compression in a member, joints ${j}`,
      unit: 'lb',
      format: (x) => fixed(x, 1),
      value: peak(j, 'compression'),
    },
    {
      title: `Largest axial tension in a member, joints ${j}`,
      unit: 'lb',
      format: (x) => fixed(x, 1),
      value: peak(j, 'tension'),
    },
    {
      title: `Largest bending moment in a member, joints ${j}`,
      unit: 'in-lb',
      format: (x) => fixed(x, 0),
      value: peak(j, 'moment'),
    },
    {
      title: `Largest downward load on a foot, joints ${j}`,
      unit: 'lb',
      format: (x) => fixed(x, 1),
      value: peak(j, 'footDown'),
    },
    {
      title: `Largest pull on a foot, joints ${j}`,
      unit: 'lb',
      format: (x) => fixed(x, 1),
      value: peak(j, 'footUplift'),
    },
    {
      title: `Largest horizontal force on a foot, joints ${j}`,
      unit: 'lb',
      format: (x) => fixed(x, 1),
      value: peak(j, 'footHorizontal'),
    },
    {
      title: `Largest moment at a buried foot, joints ${j}`,
      unit: 'in-lb',
      format: (x) => fixed(x, 0),
      value: peak(j, 'footMoment'),
    },
  ]),
  {
    title: 'Spread of the largest compression: rigid against pinned',
    unit: 'of pinned',
    format: pct,
    value: spreadOf('compression'),
  },
  {
    title: 'Spread of the largest bending moment: rigid against pinned',
    unit: 'of pinned',
    format: pct,
    value: spreadOf('moment'),
  },
  {
    title: 'Spread of the largest pull on a foot: rigid against pinned',
    unit: 'of pinned',
    format: pct,
    value: spreadOf('footUplift'),
  },
  {
    title: 'Spread of the largest horizontal force on a foot: rigid against pinned',
    unit: 'of pinned',
    format: pct,
    value: spreadOf('footHorizontal'),
  },
  ...JOINTS.map(
    (j): Metric => ({
      title: `A leg's load when pushed, against #468's P, joints ${j}`,
      unit: 'over P',
      format: pct,
      value: pushOf(j),
    }),
  ),
];

/** The parameters the issue asks where each result is largest along. */
const PARAMETERS: { name: string; unit: string; of: (w: Where) => number }[] = [
  { name: 'Splay', unit: '°', of: (w) => w.splay },
  { name: 'Beam height', unit: 'in', of: (w) => w.beamHeight },
  { name: 'Burial depth', unit: 'in', of: (w) => w.burialDepth },
  { name: 'Crossbar height', unit: 'in', of: (w) => w.crossbarHeight },
];

const describe = (w: Where) =>
  `splay ${fixed(w.splay, 1)}°, beam height ${fixed(w.beamHeight, 2)}, burial ${fixed(w.burialDepth, 2)}, crossbar height ${fixed(w.crossbarHeight, 2)}, beam length ${fixed(w.beamLength, 2)}, ${w.legStock} legs, ${w.beamPlies > 1 ? `${w.beamPlies}-ply ` : ''}${w.beamStock} beam`;

/** Instances split into four groups of equal count by a parameter, low to high. */
function quartiles<T>(items: T[], key: (t: T) => number): T[][] {
  const sorted = [...items].sort((a, b) => key(a) - key(b));
  const groups: T[][] = [];
  for (let q = 0; q < 4; q++) {
    const group = sorted.slice(
      Math.floor((q * sorted.length) / 4),
      Math.floor(((q + 1) * sorted.length) / 4),
    );
    if (group.length > 0) groups.push(group);
  }
  return groups;
}

function metricSection(metric: Metric, analyzed: Analyzed[]): string[] {
  const rows = analyzed.flatMap((i) => {
    const v = metric.value(i);
    return v ? [{ i, ...v }] : [];
  });
  const out = [`### ${metric.title} (${metric.unit})`, ''];
  if (rows.length === 0) {
    out.push('No instance has a value: every one is a mechanism or has nothing to compare.', '');
    return out;
  }
  const values = rows.map((r) => r.value);
  out.push(
    `${rows.length} instances. Smallest ${metric.format(Math.min(...values))}, median ${metric.format(median(values))}, largest ${metric.format(Math.max(...values))}.`,
    '',
    'Largest five:',
    '',
  );
  for (const r of [...rows].sort((a, b) => b.value - a.value).slice(0, 5)) {
    out.push(
      `- ${metric.format(r.value)}: ${r.i.where.instance} (${describe(r.i.where)})${r.at ? `; at ${r.at}` : ''}`,
    );
  }
  out.push(
    '',
    'By quarter of each parameter:',
    '',
    '| Parameter | Range | Instances | Median | Largest |',
    '|---|---|---|---|---|',
  );
  for (const param of PARAMETERS) {
    for (const group of quartiles(rows, (r) => param.of(r.i.where))) {
      const xs = group.map((r) => param.of(r.i.where));
      const vs = group.map((r) => r.value);
      out.push(
        `| ${param.name} | ${fixed(Math.min(...xs), 1)} to ${fixed(Math.max(...xs), 1)} ${param.unit} | ${group.length} | ${metric.format(median(vs))} | ${metric.format(Math.max(...vs))} |`,
      );
    }
  }
  out.push('');
  return out;
}

function countBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const t of items) map.set(key(t), [...(map.get(key(t)) ?? []), t]);
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

const swayCell = (r: JointResult) =>
  r.sway.kind === 'solved'
    ? sig(r.sway.perPound)
    : r.sway.kind === 'mechanism-along-beam'
      ? 'mechanism along the beam'
      : 'mechanism';
const peakCell = (p: Peak | null, digits: number) => (p ? fixed(p.value, digits) : '–');

export function sweepMarkdown(run: SweepRun): string {
  const all = [...run.examples, ...run.draws];
  const analyzed = all.filter((i): i is Analyzed => i.kind === 'analyzed');
  const others = all.filter((i): i is Exclude<Instance, Analyzed> => i.kind !== 'analyzed');
  const pads = analyzed.filter((i) => i.pads);
  const buried = analyzed.filter((i) => !i.pads);
  const out: string[] = [];

  out.push(
    `# ${run.heading}`,
    '',
    `The swing set's frame analysis (exploration #545, step 5) over the template's ${run.examples.length} worked examples and the first ${run.count} draws of its seeded sweep (seed ${run.seed}, template version ${run.templateVersion}), drawn as core's sweep draws them, so draw n here is draw n there. Written by \`pnpm --filter @kerf/frame sweep\`; every number below comes from that run.`,
    '',
    'These are forces, displacements, and stiffnesses under the stated assumptions, not margins against any capacity and not a structural check.',
    '',
    '## Inputs and assumptions',
    '',
    "- Structural inputs: each instance's own, which for every sweep draw are the worked example's (core's sweep draws parameters only).",
    `- The crossbar and gusset take the legs' species, grade, and incising: core asks for none, so the script supplies them.`,
    `- G = ${run.extra.shearModulus.ratio.toFixed(6)} × E: ${run.extra.shearModulus.basis}.`,
    '- Each instance runs every load case (one pound along the beam; the bottom of the arc; pushed toward the front and toward the back where a foot lifts most) in every support case (buried: fixed at grade; on pads: both feet pinned, and for each push the lifting feet released), with bolted joints pinned and rigid.',
    '- With pinned joints on pads, every case is reported as the mechanism along the beam (step 4; owner\'s decision on #735). Where the solver still returned a stiffness, it is listed under "Mechanisms" and used nowhere else.',
    "- Sway along the beam is a stiffness, inches per pound of load along the beam at its middle, the larger of the two frames' tops. No load along the beam is applied and no sway limit is assumed.",
    "- Largest member forces and foot reactions are over the swing load cases only, and over every member: legs, crossbars, gussets, and the beam. A member's bending moment is the resultant of its two bending moments at either end.",
    '',
    'Assumptions of every case (from `swingSet.ts`):',
    '',
    ...ASSUMPTIONS.map((a) => `- ${a}`),
    '',
    '### Comparison tolerances, fixed before the run',
    '',
    `- **Leg axial load.** Core's leg check (#468) takes P = (C·R_s + R_w) / (2·cos α) at the bottom of the arc. The frame's value is the largest compression in a leg's lowest member, from its crossbar to its foot, in the same load case. They differ when |frame − P| / P is over ${fixed(100 * LEG_TOLERANCE, 1)}%.`,
    `- **Foot uplift.** Core's uplift check (#467) gives each foot's pull on pads as C·S − D·c_v, with the lifting foot bearing nothing. The frame's value is that foot's pull in the case with the lifting feet released. They differ when |frame − core| is over the larger of ${fixed(100 * UPLIFT_TOLERANCE, 1)}% of core's value and ${fixed(UPLIFT_FLOOR, 1)} lb. Core has no uplift check for buried legs, so they are not compared.`,
    '',
  );

  out.push('## Instances', '', '| Outcome | Instances |', '|---|---|');
  out.push(`| Analyzed | ${analyzed.length} (${buried.length} buried, ${pads.length} on pads) |`);
  for (const [kind, items] of countBy(others, (i) => i.kind)) {
    out.push(`| ${kind} | ${items.length} |`);
  }
  out.push(`| Total | ${all.length} |`, '');
  if (others.length > 0) {
    out.push(
      'Not analyzed, by reason:',
      '',
      '| Outcome | Reason | Instances | First instance |',
      '|---|---|---|---|',
    );
    for (const [, items] of countBy(others, (i) => `${i.kind}: ${i.reason}`)) {
      const first = items[0] as (typeof items)[number];
      const detail = first.kind === 'refused' ? ` (${first.detail})` : '';
      out.push(
        `| ${first.kind} | ${first.reason.replaceAll('|', '\\|')} | ${items.length} | ${first.instance}${detail.replaceAll('|', '\\|')} |`,
      );
    }
    out.push('');
  }

  out.push('## Mechanisms', '');
  for (const joints of JOINTS) {
    for (const [feet, group] of [
      ['buried', buried],
      ['on pads', pads],
    ] as const) {
      const along = group.filter((i) => i.joints[joints].sway.kind === 'mechanism-along-beam');
      const other = group.filter((i) => i.joints[joints].sway.kind === 'mechanism');
      const cases = group.reduce((n, i) => n + i.joints[joints].mechanismCases.alongBeam, 0);
      const otherCases = group.flatMap((i) => i.joints[joints].mechanismCases.other);
      out.push(
        `- Joints ${joints}, ${feet}: ${group.length} instances; ${along.length} a mechanism along the beam and ${other.length} another mechanism under the load along the beam; ${cases} swing load cases a mechanism along the beam and ${otherCases.length} another mechanism.`,
      );
      for (const m of otherCases) out.push(`  - ${m}`);
    }
  }
  const residual = pads.filter((i) => i.joints.pinned.residual !== null);
  out.push(
    '',
    `Pinned on pads, the solver returned a stiffness along the beam in ${residual.length} of ${pads.length} instances instead of reading the mechanism. Each is listed with the same instance's stiffness with rigid joints:`,
    '',
  );
  if (residual.length > 0) {
    out.push(
      '| Instance | Ground slope (in/ft) | Pinned, lb/in | Rigid, lb/in | Pinned over rigid |',
      '|---|---|---|---|---|',
    );
    for (const i of residual) {
      const r = i.joints.rigid.sway;
      out.push(
        `| ${i.where.instance} | ${fixed(i.where.groundSlope, 3)} | ${sig(i.joints.pinned.residual as number)} | ${r.kind === 'solved' ? sig(1 / r.perPound) : swayCell(i.joints.rigid)} | ${r.kind === 'solved' ? sig((i.joints.pinned.residual as number) * r.perPound) : '–'} |`,
      );
    }
    const ratios = residual.flatMap((i) => {
      const r = i.joints.rigid.sway;
      return r.kind === 'solved' ? [(i.joints.pinned.residual as number) * r.perPound] : [];
    });
    const buriedRatios = buried.flatMap((i) => {
      const s = swaySpread(i);
      return s ? [1 / s.value] : [];
    });
    if (ratios.length > 0 && buriedRatios.length > 0) {
      out.push(
        '',
        `Pinned over rigid, these stiffnesses are at most ${sig(Math.max(...ratios))}. Buried, where pinned joints are not a mechanism, the pinned stiffness is at least ${sig(Math.min(...buriedRatios))} of the rigid one.`,
      );
    }
    out.push('');
  }

  out.push('## Comparison with the sourced checks', '');
  const legs = analyzed.flatMap((i) => i.legs.map((l) => ({ i, ...l })));
  out.push(
    `### Leg axial load against #468`,
    '',
    `${legs.length} comparisons in ${analyzed.length} instances; ${legs.filter((l) => l.over).length} differ by more than ${fixed(100 * LEG_TOLERANCE, 1)}%.`,
    '',
    '| Feet | Joints | Comparisons | Over tolerance | Smallest difference | Median | Largest |',
    '|---|---|---|---|---|---|---|',
  );
  for (const [feet, isPads] of [
    ['Buried', false],
    ['On pads', true],
  ] as const) {
    for (const joints of JOINTS) {
      const group = legs.filter((l) => l.i.pads === isPads && l.joints === joints);
      if (group.length === 0) {
        out.push(`| ${feet} | ${joints} | 0 | – | – | – | – |`);
        continue;
      }
      const rel = group.map((l) => l.relative);
      out.push(
        `| ${feet} | ${joints} | ${group.length} | ${group.filter((l) => l.over).length} | ${pct(Math.min(...rel))} | ${pct(median(rel))} | ${pct(Math.max(...rel))} |`,
      );
    }
  }
  const legOver = legs.filter((l) => l.over).sort((a, b) => a.relative - b.relative);
  if (legOver.length > 0) {
    out.push('', 'Every comparison over the tolerance:', '');
    out.push(
      '| Instance | Supports | Joints | Core P (lb) | Frame (lb) | Difference | Leg | Where |',
      '|---|---|---|---|---|---|---|---|',
    );
    for (const l of legOver) {
      out.push(
        `| ${l.i.where.instance} | ${l.supports} | ${l.joints} | ${fixed(l.core, 2)} | ${fixed(l.frame, 2)} | ${pct(l.relative)} | ${l.at} | ${describe(l.i.where)} |`,
      );
    }
  }
  const pushes = analyzed.flatMap((i) => i.pushes.map((p) => ({ i, ...p })));
  out.push(
    '',
    "### The push against #468's P",
    '',
    `Core's P is the load at the bottom of the arc and leaves out the push toward the front and back. Here the frame's value is the largest compression in a leg's lowest member when pushed toward the front or the back, where a foot lifts most, against the same P. No tolerance applies: this is a load core does not compute. ${pushes.length} comparisons in ${analyzed.length} instances.`,
    '',
    '| Feet | Joints | Supports | Comparisons | Smallest | Median | Largest |',
    '|---|---|---|---|---|---|---|',
  );
  for (const [[isPads, joints, supports], group] of countBy(pushes, (p) =>
    JSON.stringify([p.i.pads, p.joints, p.supports]),
  )
    .map(([k, g]) => [JSON.parse(k) as [boolean, JointModel, string], g] as const)
    .sort((a, b) => a[0].join().localeCompare(b[0].join()))) {
    const rel = group.map((p) => p.relative);
    out.push(
      `| ${isPads ? 'On pads' : 'Buried'} | ${joints} | ${supports} | ${group.length} | ${pct(Math.min(...rel))} | ${pct(median(rel))} | ${pct(Math.max(...rel))} |`,
    );
  }
  out.push(
    '',
    'Each instance\'s largest, with where it is largest by parameter, is under "A leg\'s load when pushed" below.',
  );
  const uplift = analyzed.flatMap((i) => i.uplift.map((u) => ({ i, ...u })));
  out.push(
    '',
    '### Foot uplift against #467',
    '',
    `${uplift.length} comparisons in ${pads.length} instances on pads; ${uplift.filter((u) => u.over).length} differ by more than the tolerance.`,
    '',
  );
  if (uplift.length > 0) {
    const d = uplift.map((u) => u.difference);
    out.push(
      `Frame minus core: smallest ${fixed(Math.min(...d), 3)} lb, median ${fixed(median(d), 3)} lb, largest ${fixed(Math.max(...d), 3)} lb.`,
      '',
    );
  }
  const upOver = uplift.filter((u) => u.over);
  if (upOver.length > 0) {
    out.push('Every comparison over the tolerance:', '');
    out.push(
      '| Instance | Foot | Joints | Core (lb) | Frame (lb) | Difference (lb) | Where |',
      '|---|---|---|---|---|---|---|',
    );
    for (const u of upOver) {
      out.push(
        `| ${u.i.where.instance} | ${u.foot} | ${u.joints} | ${fixed(u.core, 2)} | ${fixed(u.frame, 2)} | ${fixed(u.difference, 2)} | ${describe(u.i.where)} |`,
      );
    }
    out.push('');
  }

  out.push('## Where each result is largest', '');
  for (const m of METRICS) out.push(...metricSection(m, analyzed));

  out.push(
    '## Every analyzed instance',
    '',
    'Sway in in/lb along the beam; forces in lb and moments in in-lb, largest over the swing load cases; "–" where the case is a mechanism or the value is zero. Leg is the largest |frame − P| / P over the support cases; uplift the largest |frame − core| in lb.',
    '',
    '| Instance | Splay ° | Height | Burial | Crossbar | Sway pinned | Sway rigid | Compression p / r | Moment p / r | Foot down p / r | Foot pull p / r | Foot horizontal p / r | Leg vs P p / r | Uplift vs core |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const i of analyzed) {
    const w = i.where;
    const p = i.joints.pinned;
    const r = i.joints.rigid;
    const legWorst = (joints: JointModel) => {
      const rel = i.legs.filter((l) => l.joints === joints).map((l) => Math.abs(l.relative));
      return rel.length ? `${fixed(100 * Math.max(...rel), 2)}%` : '–';
    };
    const up = i.uplift.map((u) => Math.abs(u.difference));
    out.push(
      `| ${w.instance} | ${fixed(w.splay, 1)} | ${fixed(w.beamHeight, 2)} | ${fixed(w.burialDepth, 2)} | ${fixed(w.crossbarHeight, 2)} | ${swayCell(p)} | ${swayCell(r)} | ${peakCell(p.compression, 0)} / ${peakCell(r.compression, 0)} | ${peakCell(p.moment, 0)} / ${peakCell(r.moment, 0)} | ${peakCell(p.footDown, 0)} / ${peakCell(r.footDown, 0)} | ${peakCell(p.footUplift, 0)} / ${peakCell(r.footUplift, 0)} | ${peakCell(p.footHorizontal, 0)} / ${peakCell(r.footHorizontal, 0)} | ${legWorst('pinned')} / ${legWorst('rigid')} | ${up.length ? fixed(Math.max(...up), 2) : '–'} |`,
    );
  }
  out.push('');
  return out.join('\n');
}
