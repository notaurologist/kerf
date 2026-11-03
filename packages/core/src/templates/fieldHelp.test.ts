import { describe, expect, it } from 'vitest';
import { confirmedPaths, type FormSection } from '../model/form.ts';
import { TEMPLATES } from './index.ts';

// Every technical field the owner fills in says how to find its value: where to read it, what
// to measure, or whom to ask (owner's rule, #403; docs/design/content.md, Help).

/** The paths of fields among `sections` that `technical` picks and that have no help. */
const withoutHelp = (sections: readonly FormSection[], technical: (path: string) => boolean) =>
  sections
    .flatMap((s) => s.fields)
    .filter((f) => technical(f.path) && !f.help?.trim())
    .map((f) => f.path);

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('field help: %s', (_, template) => {
  it('gives every structural input help', () => {
    expect(withoutHelp(template.form.structuralInputs, () => true)).toEqual([]);
  });

  it('gives every hardware size or count the owner confirms help', () => {
    const confirm = confirmedPaths(template.form.params);
    expect(withoutHelp(template.form.params, (path) => confirm.has(path))).toEqual([]);
  });
});

describe.each(
  TEMPLATES.flatMap((t) => (t.questions ? [[t.id, t.form, t.questions.form] as const] : [])),
)('starting question help: %s', (_, form, questions) => {
  it('says how to find a structural input as the Edit form does', () => {
    const inputs = new Map(form.structuralInputs.flatMap((s) => s.fields).map((f) => [f.path, f]));
    const differ = questions
      .flatMap((s) => s.fields)
      .filter((f) => {
        const help = inputs.get(f.path)?.help;
        return help !== undefined && !f.help?.includes(help);
      })
      .map((f) => f.path);
    expect(differ).toEqual([]);
  });
});
