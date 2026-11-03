import { describe, expect, it } from 'vitest';
import { fieldsIn } from '../model/form.ts';
import { TEMPLATES } from './index.ts';

// Each structural check links to the fields in Edit it changes with (#448), so every field a
// template names must be one its form has.

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('check fields: %s', (_, template) => {
  const paths = {
    params: new Set(template.form.params.flatMap((s) => s.fields.map((f) => f.path))),
    structuralInputs: new Set(
      template.form.structuralInputs.flatMap((s) => s.fields.map((f) => f.path)),
    ),
  };

  it.each(template.examples.map((e) => [e.name, e] as const))('%s', (_, example) => {
    const result = template.generate(example.params, example.structuralInputs);
    if (!result.ok) throw new Error(`${example.name} did not generate`);
    const { checks } = template.plan(result.output);
    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) {
      const refs = template.checkFields(check);
      expect(refs.filter((r) => !paths[r.from].has(r.path))).toEqual([]);
      const shown = fieldsIn(template.form, refs, example.params, example.structuralInputs);
      // At least the member's size and one structural input are shown for every check.
      expect(shown.some((f) => f.from === 'params') || check.kind === 'hardware').toBe(true);
      expect(shown.some((f) => f.from === 'structuralInputs')).toBe(true);
    }
  });
});
