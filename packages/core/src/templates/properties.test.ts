import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { BRAND_NAMES, VERDICT_WORDS, withoutBrandExceptions } from '../testing.ts';
import { TEMPLATES } from './index.ts';

// Random parameters and structural inputs inside each template's schemas either generate or come
// back as issues, quickly, and never throw (#421). The issues are read as copy too: the editor
// shows them as they are (hard rules 2 and 11).

/** A small seeded generator (mulberry32), so a failure can be repeated from its seed. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// biome-ignore lint/suspicious/noExplicitAny: Zod's internal definitions are walked by their `type`.
type Def = any;
const def = (schema: z.ZodType): Def => (schema as Def)._zod.def;

const EXTREMES = [
  1e-12,
  1e-6,
  0.01,
  0.1,
  0.5,
  1,
  2,
  10,
  100,
  1e6,
  Number.MAX_VALUE,
  -1,
  -Number.MAX_VALUE,
];

function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)] as T;
}

function number(next: () => number, schema: z.ZodType, near?: number): number {
  const s = schema as Def;
  const int = Boolean(s.isInt);
  const lo = Number.isFinite(s.minValue) ? s.minValue : -1e6;
  const hi = Number.isFinite(s.maxValue) && s.maxValue < Number.MAX_SAFE_INTEGER ? s.maxValue : 1e6;
  const candidates = [
    s.minValue,
    s.maxValue,
    s.minValue + 1e-12,
    lo + next() * (hi - lo),
    ...(near === undefined ? [] : [near * (0.5 + next() * 1.5), near * (0.9 + next() * 0.2)]),
    ...EXTREMES,
  ]
    .map((v) => (int ? Math.round(v) : v))
    .filter((v) => schema.safeParse(v).success);
  return candidates.length > 0 ? pick(next, candidates) : (near ?? 0);
}

/** A value for the schema, from nothing. */
function fresh(next: () => number, schema: z.ZodType): unknown {
  const d = def(schema);
  switch (d.type) {
    case 'number':
      return number(next, schema);
    case 'boolean':
      return next() < 0.5;
    case 'string':
      return 'x';
    case 'literal':
      return d.values[0];
    case 'enum':
      return pick(next, Object.values(d.entries));
    case 'union':
      return fresh(next, pick(next, d.options));
    case 'optional':
      return next() < 0.3 ? undefined : fresh(next, d.innerType);
    case 'default':
    case 'nullable':
      return fresh(next, d.innerType);
    case 'object':
      return Object.fromEntries(
        Object.entries(d.shape as Record<string, z.ZodType>)
          .map(([k, v]) => [k, fresh(next, v)])
          .filter(([, v]) => v !== undefined),
      );
    case 'tuple':
      return d.items.map((item: z.ZodType) => fresh(next, item));
    case 'array': {
      for (let tries = 0; tries < 20; tries++) {
        const length = Math.floor(next() * 6);
        const value = Array.from({ length }, () => fresh(next, d.element));
        if (schema.safeParse(value).success) return value;
      }
      return [];
    }
    default:
      throw new Error(`No random value for a ${d.type} schema`);
  }
}

/** The example's value with some of its leaves, or whole branches, replaced. */
function mutate(next: () => number, schema: z.ZodType, value: unknown, rate: number): unknown {
  const d = def(schema);
  if (value === undefined) return next() < rate ? fresh(next, schema) : undefined;
  switch (d.type) {
    case 'object':
      return Object.fromEntries(
        Object.entries(d.shape as Record<string, z.ZodType>)
          .map(([k, v]) => [k, mutate(next, v, (value as Record<string, unknown>)[k], rate)])
          .filter(([, v]) => v !== undefined),
      );
    case 'optional':
      return next() < rate / 4 ? undefined : mutate(next, d.innerType, value, rate);
    case 'union': {
      if (next() < rate / 2) return fresh(next, schema);
      const option = (d.options as z.ZodType[]).find((o) => o.safeParse(value).success);
      return option ? mutate(next, option, value, rate) : value;
    }
    case 'tuple':
      return (value as unknown[]).map((v, i) => mutate(next, d.items[i], v, rate));
    case 'array':
      return next() < rate ? fresh(next, schema) : value;
    case 'number':
      return next() < rate ? number(next, schema, value as number) : value;
    default:
      return next() < rate ? fresh(next, schema) : value;
  }
}

/** About a quarter of these get past validation and generate a whole plan. */
const RUNS = 1000;
/**
 * Before the board width had a range, a typo could take seconds or never finish (#421). The
 * shopping list's search may spend its work limit on a plan, about 0.8 s on the slowest benchmark
 * plan on a development machine and up to about 3 s on GitHub's runners (decision 0021), so the
 * budget allows for that.
 */
const BUDGET_MS = 6000;
/**
 * The test's own time: a few hundred plans, each of which may spend the search's work limit, take
 * about a minute for the workbench on a development machine and about four times that on CI.
 */
const TEST_TIMEOUT_MS = 600_000;

/** Every number in a schema, by its path, with the limits the schema sets. */
function numbers(schema: z.ZodType, path = ''): { path: string; min: number; max: number }[] {
  const d = def(schema);
  switch (d.type) {
    case 'number': {
      const s = schema as Def;
      return [{ path, min: s.minValue, max: s.maxValue }];
    }
    case 'object':
      return Object.entries(d.shape as Record<string, z.ZodType>).flatMap(([k, v]) =>
        numbers(v, path ? `${path}.${k}` : k),
      );
    case 'optional':
    case 'default':
    case 'nullable':
      return numbers(d.innerType, path);
    case 'union':
      return (d.options as z.ZodType[]).flatMap((o) => numbers(o, path));
    case 'tuple':
      return (d.items as z.ZodType[]).flatMap((item, i) => numbers(item, `${path}[${i}]`));
    case 'array':
      return numbers(d.element, `${path}[]`);
    default:
      return [];
  }
}

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('%s', (_, t) => {
  it('gives every number parameter a range', () => {
    // A count of parts or boards follows from the parameters, so a parameter with no limit can
    // ask for any number of them. Every number has one, which bounds every count with it.
    const unbounded = numbers(t.params).filter(
      (n) => !Number.isFinite(n.min) || !Number.isFinite(n.max) || n.max >= Number.MAX_SAFE_INTEGER,
    );
    expect(unbounded.map((n) => n.path)).toEqual([]);
  });

  it(
    'generates or returns issues for random parameters, in time, without throwing',
    () => {
      let generated = 0;
      /** One example of each distinct failure, by its message. */
      const failures = new Map<string, string>();
      /** Each issue's message, by its code, as the editor shows it. */
      const issues = new Map<string, string>();
      for (let run = 0; run < RUNS; run++) {
        const next = random(run + 1);
        const example = t.examples[run % t.examples.length];
        if (!example) throw new Error(`${t.id} has no worked example`);
        const rate = run < RUNS / 3 ? 0.1 : run < (2 * RUNS) / 3 ? 0.3 : 1;
        const params = t.params.safeParse(mutate(next, t.params, example.params, rate));
        const inputs = t.structuralInputs.safeParse(
          mutate(next, t.structuralInputs, example.structuralInputs, rate),
        );
        if (!params.success || !inputs.success) continue;
        const tried = `run ${run}: ${JSON.stringify(params.data)} ${JSON.stringify(inputs.data)}`;
        const started = Date.now();
        try {
          const made = t.generate(params.data, inputs.data);
          if (made.ok) generated++;
          else
            for (const issue of made.issues) issues.set(`${issue.code}: ${issue.message}`, tried);
        } catch (error) {
          const message = String(error).replace(/-?\d[\d.e+-]*/g, 'N');
          if (!failures.has(message)) failures.set(message, tried);
        }
        const took = Date.now() - started;
        if (took > BUDGET_MS) failures.set(`took ${Math.round(took)} ms`, tried);
      }
      expect([...failures].map(([message, tried]) => `${message}\n  ${tried}`)).toEqual([]);
      const said = [...issues.keys()];
      expect(said.length).toBeGreaterThan(0);
      expect(said.filter((text) => VERDICT_WORDS.test(text))).toEqual([]);
      expect(said.filter((text) => BRAND_NAMES.test(withoutBrandExceptions(text)))).toEqual([]);
      // Enough runs get past validation for the test to say something about generation itself.
      expect(generated).toBeGreaterThan(RUNS / 10);
    },
    TEST_TIMEOUT_MS,
  );
});
