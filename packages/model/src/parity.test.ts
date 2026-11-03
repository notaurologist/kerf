import { TEMPLATES, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { TOLERANCE } from './compare.ts';
import { type Generator, parity, parityCases } from './parity.ts';

// The harness proven before any joint exists: each template matches itself, and a changed value
// is reported at its path.

const FIXTURES = import.meta.glob<readonly unknown[]>(
  '../../core/src/templates/*/snapshots/v*.json',
  { eager: true, import: 'default' },
);

function fixturesOf(template: TemplateDefinition): Record<string, readonly unknown[]> {
  return Object.fromEntries(
    Object.entries(FIXTURES).filter(([path]) => path.includes(`/templates/${template.id}/`)),
  );
}

/** The template's own output with one change made to it. */
function changed(template: TemplateDefinition, change: (output: Output) => void): Generator {
  return (params, inputs) => {
    const made = template.generate(params, inputs);
    if (made.ok) change(made.output as Output);
    return made;
  };
}
/** What both templates' outputs share: the parts, and the cut list made from them. */
type Output = {
  design: { parts: { length: number; name: string }[] };
  cutList: { length: string }[];
};

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('%s', (_, template) => {
  const cases = parityCases(template, fixturesOf(template));

  it('covers every worked example and the fixtures the current version accepts', () => {
    expect(cases.slice(0, template.examples.length).map((c) => c.name)).toEqual(
      template.examples.map((e) => e.name),
    );
    expect(cases.length).toBeGreaterThan(template.examples.length);
  });

  it('matches itself in every case', () => {
    const results = parity(template, template.generate, cases);
    expect(results.filter((r) => r.mismatches.length > 0)).toEqual([]);
  });

  it('reports a length changed past the tolerance', () => {
    const [result] = parity(
      template,
      changed(template, (o) => {
        const part = o.design.parts[0];
        if (part) part.length += 1e-6;
      }),
      cases.slice(0, 1),
    );
    expect(result?.mismatches.map((m) => m.path)).toContain('result.output.design.parts[0].length');
  });

  it('reports a changed cut list length in the output and in what is shown', () => {
    const [result] = parity(
      template,
      changed(template, (o) => {
        const row = o.cutList[0];
        if (row) row.length = `${row.length} `;
      }),
      cases.slice(0, 1),
    );
    const paths = result?.mismatches.map((m) => m.path) ?? [];
    expect(paths).toContain('result.output.cutList[0].length');
    expect(paths.some((p) => p.startsWith('shown.'))).toBe(true);
  });

  it('accepts a length changed within the tolerance', () => {
    const results = parity(
      template,
      changed(template, (o) => {
        const part = o.design.parts[0];
        if (part) part.length += TOLERANCE / 10;
      }),
      cases,
    );
    expect(results.flatMap((r) => r.mismatches)).toEqual([]);
  });

  it('reports a changed name', () => {
    const [result] = parity(
      template,
      changed(template, (o) => {
        const part = o.design.parts[0];
        if (part) part.name = `${part.name}.`;
      }),
      cases.slice(0, 1),
    );
    expect(result?.mismatches.map((m) => m.path)).toContain('result.output.design.parts[0].name');
  });
});
