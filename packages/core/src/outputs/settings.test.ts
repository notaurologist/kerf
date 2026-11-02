import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates/index.ts';

// Each cut-list row's saw settings, added on read for the cut list's narrow column (#360). They
// are the same numbers the row's end cuts state in words.

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('cut-list settings: %s', (_, template) => {
  const example = template.examples[0];
  if (!example) throw new Error('no worked example');
  const made = template.generate(example.params, example.structuralInputs);
  if (!made.ok) throw new Error('worked example does not generate');
  const plan = template.plan(made.output);

  it('gives every row one setting per end, matching the words', () => {
    for (const row of plan.cutList) {
      expect(row.settings).toHaveLength(row.ends.length);
      row.ends.forEach((end, i) => {
        const said = /saw at ([\d.]+°)/.exec(end)?.[1];
        expect(row.settings[i]).toBe(said ?? '0.0°');
      });
    }
  });
});
