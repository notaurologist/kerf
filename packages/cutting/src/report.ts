import { firstFitDecreasing } from './baseline.ts';
import { measure, planProblems } from './check.ts';
import type { CutPlan, Instance } from './instance.ts';
import type { Sourced } from './sources.ts';

/** A way to plan an instance's boards. */
export interface Method {
  name: string;
  plan(instance: Instance): CutPlan;
}

export const BASELINE: Method = { name: 'first-fit decreasing', plan: firstFitDecreasing };

export interface Row {
  source: string;
  pieces: number;
  results: { method: string; feet: number; boards: number; ms: number }[];
}

/** Runs each method on each instance, refusing any plan the checker finds a problem with. */
export function runMethods(instances: readonly Sourced[], methods: readonly Method[]): Row[] {
  return instances.map(({ source, instance }) => ({
    source,
    pieces: instance.pieces.length,
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

/** The rows as a Markdown report: totals per method, then each instance. */
export function formatReport(rows: readonly Row[], methods: readonly Method[]): string {
  const total = (name: string, key: 'feet' | 'boards' | 'ms') =>
    rows.reduce((sum, row) => sum + (row.results.find((r) => r.method === name)?.[key] ?? 0), 0);
  const lines = [
    '# Cut optimization benchmark',
    '',
    `${rows.length} instances. Feet are buyable lengths bought; time is one run on the machine that wrote this.`,
    '',
    '| Method | Feet | Boards | Time (ms) |',
    '|---|---|---|---|',
    ...methods.map(
      (m) =>
        `| ${m.name} | ${total(m.name, 'feet')} | ${total(m.name, 'boards')} | ${total(m.name, 'ms').toFixed(1)} |`,
    ),
    '',
    `| Instance | Pieces | ${methods.map((m) => `${m.name} (ft / boards)`).join(' | ')} |`,
    `|---|---|${methods.map(() => '---').join('|')}|`,
    ...rows.map(
      (row) =>
        `| ${row.source} | ${row.pieces} | ${row.results.map((r) => `${r.feet} / ${r.boards}`).join(' | ')} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
