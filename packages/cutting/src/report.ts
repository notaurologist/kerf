import { firstFitDecreasing } from './baseline.ts';
import { materialBound, relaxation } from './bounds.ts';
import { measure, planProblems } from './check.ts';
import { solveExact } from './exact.ts';
import type { CutPlan, Instance } from './instance.ts';
import type { Sourced } from './sources.ts';

/** A way to plan an instance's boards. */
export interface Method {
  name: string;
  /** A plan, and whether the method proved no plan buys fewer feet, if it says. */
  plan(instance: Instance): CutPlan & { proven?: boolean };
}

export const BASELINE: Method = { name: 'first-fit decreasing', plan: firstFitDecreasing };

/** A work limit as millions of units, such as "30M". */
export function units(workLimit: number): string {
  return `${workLimit / 1e6}M`;
}

/** The exact method, stopped after `workLimit` units of work on each instance. */
export function exact(workLimit: number): Method {
  return {
    name: `branch-and-bound, ${units(workLimit)} work`,
    plan(instance) {
      const solved = solveExact(instance, { workLimit });
      return { ...solved.plan, proven: solved.proven };
    },
  };
}

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
  results: { method: string; feet: number; boards: number; ms: number; proven?: boolean }[];
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
      return {
        method: method.name,
        ...measure(plan),
        ms,
        ...(plan.proven === undefined ? {} : { proven: plan.proven }),
      };
    }),
  }));
}

/** The highest bound on a row, or 0 when it has none. */
function best(row: Row): number {
  return Math.max(0, ...row.bounds.map((b) => b.feet));
}

/**
 * The rows as a Markdown report: totals per method, with each method's feet over the best bound,
 * then any `sections`, then the instances where some method buys more than the best bound, then
 * every instance.
 */
export function formatReport(
  rows: readonly Row[],
  methods: readonly Method[],
  sections: readonly string[] = [],
): string {
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
    ...methods.map((m) => {
      const r = result(row, m.name);
      if (!r) return '';
      return `${r.feet} / ${r.boards}${r.proven === undefined ? '' : r.proven ? ' (proven)' : ' (stopped)'}`;
    }),
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
    `| Method | Feet | Boards | Time (ms) | Proven |${bounded ? ' Over best bound (ft) | Instances open |' : ''}`,
    `|---|---|---|---|---|${bounded ? '---|---|' : ''}`,
    ...methods.map((m) => {
      const proven = rows.filter((row) => result(row, m.name)?.proven).length;
      const says = rows.some((row) => result(row, m.name)?.proven !== undefined);
      const base = `| ${m.name} | ${total(m.name, 'feet')} | ${total(m.name, 'boards')} | ${total(m.name, 'ms').toFixed(1)} | ${says ? `${proven} of ${rows.length}` : ''} |`;
      if (!bounded) return base;
      const count = rows.filter((row) => over(row, m.name) > 0).length;
      return `${base} ${total(m.name, 'feet') - boundTotal} | ${count} |`;
    }),
    ...sections.flatMap((section) => ['', section.trimEnd()]),
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

/** The template an instance came from: its source up to the first " / ". */
function template(row: Row): string {
  return row.source.split(' / ')[0] ?? row.source;
}

/**
 * The exact method at each work limit against the baseline: the feet it saves, by template, and
 * the slowest instance's time, by template.
 */
export function formatWorkLimits(
  rows: readonly Row[],
  baseline: Method,
  limits: readonly { limit: number; method: Method }[],
): string {
  const templates = [...new Set(rows.map(template))];
  const of = (row: Row, name: string) => row.results.find((r) => r.method === name);
  /** Feet saved; with `proven`, only on the instances the search finished. */
  const saved = (name: string, among: readonly Row[], proven = false) =>
    among
      .filter((row) => !proven || of(row, name)?.proven)
      .reduce(
        (sum, row) => sum + (of(row, baseline.name)?.feet ?? 0) - (of(row, name)?.feet ?? 0),
        0,
      );
  const slowest = (name: string, among: readonly Row[]) =>
    Math.max(0, ...among.map((row) => of(row, name)?.ms ?? 0));
  const by = (t: string) => rows.filter((row) => template(row) === t);
  const most = Math.max(0, ...limits.map(({ method }) => saved(method.name, rows)));
  const head = (cols: readonly string[]) => [
    `| Work limit | ${cols.join(' | ')} |`,
    `|---|${cols.map(() => '---').join('|')}|`,
  ];
  return [
    '## Work limit',
    '',
    `Feet saved against ${baseline.name}, by template, and instances proven, at each work limit. Saved where proven counts only the instances the search finished, as if ${baseline.name} planned the rest.`,
    '',
    ...head([...templates, 'All', 'Share of the most saved', 'Proven', 'Saved where proven']),
    ...limits.map(({ limit, method }) => {
      const all = saved(method.name, rows);
      const proven = rows.filter((row) => of(row, method.name)?.proven).length;
      const share = most === 0 ? '' : `${Math.round((100 * all) / most)}%`;
      return `| ${units(limit)} | ${templates.map((t) => saved(method.name, by(t))).join(' | ')} | ${all} | ${share} | ${proven} of ${rows.length} | ${saved(method.name, rows, true)} |`;
    }),
    '',
    'The slowest instance, by template, and the time for every instance, in milliseconds.',
    '',
    ...head([...templates.map((t) => `${t} slowest`), 'All, total']),
    ...limits.map(({ limit, method }) => {
      const total = rows.reduce((sum, row) => sum + (of(row, method.name)?.ms ?? 0), 0);
      return `| ${units(limit)} | ${templates.map((t) => slowest(method.name, by(t)).toFixed(0)).join(' | ')} | ${total.toFixed(0)} |`;
    }),
    '',
  ].join('\n');
}
