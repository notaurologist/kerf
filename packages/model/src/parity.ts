import {
  type GenerateResult,
  readSnapshot,
  shownOnRead,
  TEMPLATES,
  type TemplateDefinition,
} from '@kerf/core';
import { compare, type Mismatch } from './compare.ts';

// The parity test (docs/explorations/joint-model.md): a candidate generator matches a template's
// own `generate` when, for every case, both give the same result and the same plan when read.

/** A template's `generate`, or a joint-based version of it. */
export type Generator = (params: unknown, structuralInputs: unknown) => GenerateResult<unknown>;

export interface ParityCase {
  /** A worked example's name, or the fixture it was read from. */
  name: string;
  params: unknown;
  structuralInputs: unknown;
}

export interface CaseResult {
  name: string;
  mismatches: Mismatch[];
}

/**
 * The template's worked examples, then each other parameter set in its stored snapshot fixtures
 * that the current version accepts. A fixture's parameters are read through its upgrades first.
 * Fixtures from versions before a parameter was added lack it, so the current schema refuses
 * them and they are left out.
 */
export function parityCases(
  template: TemplateDefinition,
  fixtures: Readonly<Record<string, readonly unknown[]>>,
): ParityCase[] {
  const cases: ParityCase[] = template.examples.map((e) => ({
    name: e.name,
    params: e.params,
    structuralInputs: e.structuralInputs,
  }));
  const seen = new Set(cases.map((c) => key(c)));
  for (const [file, stored] of Object.entries(fixtures)) {
    stored.forEach((snapshot, i) => {
      const read = readSnapshot(TEMPLATES, snapshot);
      if (!read.ok || read.snapshot.templateId !== template.id) {
        throw new Error(`${file}[${i}] does not read as a ${template.id} snapshot.`);
      }
      const params = template.params.safeParse(read.snapshot.params);
      const inputs = template.structuralInputs.safeParse(read.snapshot.structuralInputs);
      if (!params.success || !inputs.success) return;
      const found = {
        name: `${file}[${i}]`,
        params: params.data,
        structuralInputs: inputs.data,
      };
      if (seen.has(key(found))) return;
      seen.add(key(found));
      cases.push(found);
    });
  }
  return cases;
}

const key = (c: ParityCase) => JSON.stringify([c.params, c.structuralInputs]);

/** Each case's mismatches between the template's own output and the candidate's. */
export function parity(
  template: TemplateDefinition,
  candidate: Generator,
  cases: readonly ParityCase[],
): CaseResult[] {
  return cases.map((c) => {
    const current = template.generate(c.params, c.structuralInputs);
    const made = candidate(c.params, c.structuralInputs);
    const mismatches = compare(current, made, 'result');
    if (current.ok && made.ok) {
      mismatches.push(
        ...compare(
          shownOnRead(template, current.output),
          shownOnRead(template, made.output),
          'shown',
        ),
      );
    }
    return { name: c.name, mismatches };
  });
}
