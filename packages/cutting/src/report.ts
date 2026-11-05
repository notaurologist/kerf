import { firstFitDecreasing } from './baseline.ts';
import { materialBound, relaxation } from './bounds.ts';
import { measure, planProblems } from './check.ts';
import type { CutPlan, Instance } from './instance.ts';
import type { Sourced } from './sources.ts';

/** A way to plan an instance's boards. */
export interface Method {
  name: string;
  plan(instance: Instance): CutPlan;
}

export const BASELINE: Method = { name: 'first-fit decreasing', plan: firstFitDecreasing };

/** A lower bound on the feet any plan for an instance buys. */
export interface Bound {
  name: string;
  feet(instance: Instance): number;
}

export const BOUNDS: readonly Bound[] = [
  { name: 'material', feet: materialBound },
  { name: 'linear relaxation', feet: (instance) => relaxation(instance).bound },
];

export interface Row {
  source: string;
  pieces: number;
  /** Each bound, in feet; the best is the highest. */
  bounds: { name: string; feet: number }[];
  results: { method: string; feet: number; boards: number; ms: number }[];
}

/** Runs each method on each instance, refusing any plan the checker finds a problem with. */
export function runMethods(
  instances: readonly Sourced[],
  methods: readonly Method[],
  bounds: readonly Bound[] = [],
): Row[] {
  return instances.map(({ source, instance }) => ({
    source,
    pieces: instance.pieces.length,
    bounds: bounds.map((bound) => ({ name: bound.name, feet: bound.feet(instance) })),
    results: methods.map((method) => {
      const start = performance.now();
      const plan = method.plan(instance);
      const ms = performance.now() - start;
      const problems = planProblems(instance, plan);
      if (problems.length > 0) {
        throw new Error(`${method.name} on ${source}: ${problems.join(' ')}`);
      }
      return { method: method.name, ...measure(plan), ms };
    }),
  }));
}

/** The highest bound on a row, or 0 when it has none. */
function best(row: Row): number {
  return Math.max(0, ...row.bounds.map((b) => b.feet));
}

/**
 * The rows as a Markdown report: totals per method, with each method's feet over the best bound,
 * then the instances where some method buys more than the best bound, then every instance.
 */
export function formatReport(rows: readonly Row[], methods: readonly Method[]): string {
  const result = (row: Row, name: string) => row.results.find((r) => r.method === name);
  const total = (name: string, key: 'feet' | 'boards' | 'ms') =>
    rows.reduce((sum, row) => sum + (result(row, name)?.[key] ?? 0), 0);
  const bounded = rows.some((row) => row.bounds.length > 0);
  const boundTotal = rows.reduce((sum, row) => sum + best(row), 0);
  const over = (row: Row, name: string) => (result(row, name)?.feet ?? 0) - best(row);
  const open = rows.filter((row) => methods.some((m) => over(row, m.name) > 0));
  const boundNames = rows[0]?.bounds.map((b) => b.name) ?? [];
  const cells = (row: Row) => [
    ...row.bounds.map((b) => `${b.feet}`),
    ...row.results.map((r) => `${r.feet} / ${r.boards}`),
  ];
  const header = [
    '| Instance | Pieces | ',
    [
      ...boundNames.map((n) => `${n} bound (ft)`),
      ...methods.map((m) => `${m.name} (ft / boards)`),
    ].join(' | '),
    ' |',
  ].join('');
  const rule = `|---|---|${[...boundNames, ...methods].map(() => '---').join('|')}|`;
  const line = (row: Row) => `| ${row.source} | ${row.pieces} | ${cells(row).join(' | ')} |`;
  return [
    '# Cut optimization benchmark',
    '',
    `${rows.length} instances. Feet are buyable lengths bought; time is one run on the machine that wrote this.`,
    ...(bounded
      ? [
          '',
          `The best lower bound totals ${boundTotal} ft. An instance is open when a method buys more than its best bound: either the method could do better or the bound is not tight.`,
        ]
      : []),
    '',
    `| Method | Feet | Boards | Time (ms) |${bounded ? ' Over best bound (ft) | Instances open |' : ''}`,
    `|---|---|---|---|${bounded ? '---|---|' : ''}`,
    ...methods.map((m) => {
      const base = `| ${m.name} | ${total(m.name, 'feet')} | ${total(m.name, 'boards')} | ${total(m.name, 'ms').toFixed(1)} |`;
      if (!bounded) return base;
      const count = rows.filter((row) => over(row, m.name) > 0).length;
      return `${base} ${total(m.name, 'feet') - boundTotal} | ${count} |`;
    }),
    ...(bounded
      ? ['', `## Open instances (${open.length})`, '', header, rule, ...open.map(line)]
      : []),
    '',
    '## Every instance',
    '',
    header,
    rule,
    ...rows.map(line),
    '',
  ].join('\n');
}
