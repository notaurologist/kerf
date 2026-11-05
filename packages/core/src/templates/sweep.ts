import { fitProblems } from '../fit/index.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import { shownOnRead } from '../snapshot/shown.ts';

// A seeded random sweep of a template's parameters, for tests (#571): draws parameter sets as an
// owner might type them, and checks that every draw the schema accepts either makes a plan or is
// refused with issues, never throws, and that every plan it makes reads back from a snapshot, has
// parts that go together (fit/), and, for a sample, can be shown and drawn. Hand-picked cases
// cover what someone thought to write down; the joint model's sweep found four bugs they missed.

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

export interface Swept {
  /** Draws the schemas accepted, and how many of those made a plan. */
  accepted: number;
  made: number;
  /** Each draw that failed, by its number, and how. */
  failures: string[];
}

export function sweep(
  template: TemplateDefinition,
  sample: (random: Random) => { params: unknown; structuralInputs: unknown },
  { count, seed, showEvery }: { count: number; seed: number; showEvery: number },
): Swept {
  const random = seeded(seed);
  const swept: Swept = { accepted: 0, made: 0, failures: [] };
  for (let i = 0; i < count; i++) {
    const drawn = sample(random);
    const params = template.params.safeParse(drawn.params);
    const inputs = template.structuralInputs.safeParse(drawn.structuralInputs);
    if (!params.success || !inputs.success) continue;
    swept.accepted++;
    const fail = (how: string) => swept.failures.push(`draw ${i}: ${how}`);
    try {
      const made = template.generate(params.data, inputs.data);
      if (!made.ok) continue;
      swept.made++;
      const outputs = template.storedOutputs.parse(JSON.parse(JSON.stringify(made.output)));
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
