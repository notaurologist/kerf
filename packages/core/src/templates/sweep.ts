import { createHash } from 'node:crypto';
import { fitProblems } from '../fit/index.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import { sameNumber } from '../snapshot/diff.ts';
import { shownOnRead } from '../snapshot/shown.ts';

// A seeded random sweep of a template's parameters, for tests (#571): draws parameter sets as an
// owner might type them, and checks that every draw the schema accepts either makes a plan or is
// refused with issues, never throws, and that every plan it makes reads back from a snapshot, has
// parts that go together (fit/), and, for a sample, can be shown and drawn. Hand-picked cases
// cover what someone thought to write down; the joint model's sweep found four bugs they missed.
// What each draw generates is also pinned per template version (sweeps/v<n>.json, decision 0014),
// numbers within sameNumber, so a change to output the worked examples do not reach needs a
// version bump too.

export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max], on a 1/16" step half the time, as an owner would enter it. */
  between(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(options: readonly T[]): T;
  chance(p: number): boolean;
}

/** Mulberry32: small, fast, and well spread for tests. The same seed gives the same draws. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between(min, max) {
      const value = min + next() * (max - min);
      if (next() < 0.5) return value;
      return Math.min(max, Math.max(min, Math.round(value * 16) / 16));
    },
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (options) => options[Math.floor(next() * options.length)] as (typeof options)[number],
    chance: (p) => next() < p,
  };
}

/** A template's sweep: how many draws, from which seed, and how each is drawn. */
export interface SweepPlan {
  count: number;
  seed: number;
  /** Every how many plans made to also show and draw one. */
  showEvery: number;
  sample: (random: Random) => { params: unknown; structuralInputs: unknown };
}

export interface Swept {
  /** Draws the schemas accepted, and how many of those made a plan. */
  accepted: number;
  made: number;
  /** Each draw that failed, by its number, and how. */
  failures: string[];
  /** What each accepted draw generated, by draw number: its plan's outputs or its issues. */
  outputs: Record<string, DrawDigest>;
}

/**
 * What one draw generated, small enough to keep for every draw. `values` holds its distinct
 * numbers in the order they first appear, rounded to 7 decimal places; numbers within
 * `sameNumber` of one already listed count as that one. `shape` is a hash of the output's JSON
 * with each number replaced by its place in `values`, so it pins every string, key, and where each
 * number goes. Storing every number would take megabytes per template version; a plan repeats
 * most of its numbers.
 */
export interface DrawDigest {
  shape: string;
  values: number[];
}

const MARK = '\u0000';

export function drawDigest(output: unknown): DrawDigest {
  const values: number[] = [];
  const exact = new Map<number, number>();
  const place = (n: number) => {
    let at = exact.get(n) ?? values.findIndex((v) => sameNumber(v, n));
    if (at < 0) at = values.push(n) - 1;
    exact.set(n, at);
    return at;
  };
  const json = JSON.stringify(output, (_, v) => (typeof v === 'number' ? `${MARK}${place(v)}` : v));
  return {
    shape: createHash('sha256').update(json).digest('hex').slice(0, 16),
    values: values.map((v) => Number(v.toFixed(7))),
  };
}

export function sweep(
  template: TemplateDefinition,
  { count, seed, showEvery, sample }: SweepPlan,
): Swept {
  const random = seeded(seed);
  const swept: Swept = { accepted: 0, made: 0, failures: [], outputs: {} };
  for (let i = 0; i < count; i++) {
    const drawn = sample(random);
    const params = template.params.safeParse(drawn.params);
    const inputs = template.structuralInputs.safeParse(drawn.structuralInputs);
    if (!params.success || !inputs.success) continue;
    swept.accepted++;
    const fail = (how: string) => swept.failures.push(`draw ${i}: ${how}`);
    try {
      const made = template.generate(params.data, inputs.data);
      if (!made.ok) {
        swept.outputs[i] = drawDigest(made.issues);
        continue;
      }
      swept.made++;
      const json = JSON.parse(JSON.stringify(made.output));
      swept.outputs[i] = drawDigest(json);
      const outputs = template.storedOutputs.parse(json);
      const assembly = template.assembly(outputs);
      if (!assembly) {
        fail('no 3D scene');
        continue;
      }
      for (const p of fitProblems(assembly.scene, template.plan(outputs).hardware)) {
        fail(`${p.check}, ${p.partId} ${p.instance}: ${p.message}`);
      }
      if (swept.made % showEvery === 0) shownOnRead(template, outputs);
    } catch (error) {
      fail(`throws ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return swept;
}

/**
 * What a template's sweep generated at one template version, kept beside its fixtures as
 * `sweeps/v<n>.json` (decision 0014).
 */
export interface SweepDigest {
  templateVersion: number;
  seed: number;
  count: number;
  outputs: Record<string, DrawDigest>;
}

export const sweepDigest = (
  template: TemplateDefinition,
  { seed, count }: SweepPlan,
  swept: Swept,
): SweepDigest => ({ templateVersion: template.version, seed, count, outputs: swept.outputs });

/** A digest as written to `sweeps/v<n>.json`: one line per draw, so a change reads by draw. */
export function digestJson(digest: SweepDigest): string {
  const { outputs, ...rest } = digest;
  const draws = Object.entries(outputs).map(([d, o]) => `    "${d}": ${JSON.stringify(o)}`);
  const head = JSON.stringify(rest, null, 2).slice(0, -2);
  return `${head},\n  "outputs": {\n${draws.join(',\n')}\n  }\n}\n`;
}

const sameDraw = (a: DrawDigest, b: DrawDigest) =>
  a.shape === b.shape &&
  a.values.length === b.values.length &&
  a.values.every((v, i) => sameNumber(v, b.values[i] as number));

/**
 * How a sweep differs from the digest recorded for its template version: the draws whose output
 * changed, appeared, or went away, or a different seed or count. Empty when it is the same.
 */
export function digestChanges(recorded: SweepDigest | undefined, now: SweepDigest): string[] {
  if (!recorded) return [`no digest is recorded for v${now.templateVersion}`];
  const problems: string[] = [];
  for (const key of ['templateVersion', 'seed', 'count'] as const) {
    if (recorded[key] !== now[key]) problems.push(`${key} ${recorded[key]} is now ${now[key]}`);
  }
  const draws = new Set([...Object.keys(recorded.outputs), ...Object.keys(now.outputs)]);
  for (const draw of [...draws].sort((a, b) => Number(a) - Number(b))) {
    const before = recorded.outputs[draw];
    const after = now.outputs[draw];
    if (before && after && sameDraw(before, after)) continue;
    problems.push(
      `draw ${draw} ${!before ? 'is newly accepted' : !after ? 'is no longer accepted' : 'generates different output'}`,
    );
  }
  return problems;
}
