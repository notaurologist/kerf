import { describe, expect, it } from 'vitest';
import { swingSetAFrame } from '../templates/swing-set-a-frame/definition.ts';
import { EXAMPLES } from '../templates/swing-set-a-frame/examples.ts';
import type { TemplateDefinition } from './definition.ts';
import {
  carrySuggested,
  confirmSuggested,
  type SuggestedValue,
  suggestedFields,
  suggestedFor,
  suggestedItems,
} from './suggested.ts';

const template = swingSetAFrame as TemplateDefinition;
const example = EXAMPLES[0];
if (!example) throw new Error('no worked example');

const answers = {
  riders: 'kids',
  riderWeights: [90, 110],
  area: { length: 360, depth: 480 },
  ground: { kind: 'level' },
  feet: 'pads',
};

const limit: SuggestedValue = {
  from: 'structuralInputs',
  path: 'deflectionLimit',
  basis: { kind: 'source', citation: 'A code, a table' },
  confirmed: false,
};

describe('suggestedFor', () => {
  const inputs = { maxSwingAngle: 90, deflectionLimit: 240, beamMoistureContent: 30 };

  it('lists the suggested structural inputs left as suggested, never the answers', () => {
    const found = suggestedFor(template, answers, example.params, {
      ...inputs,
      riderWeights: [90, 110],
    });
    if (!found.ok) throw new Error(JSON.stringify(found.issues));
    const inputPaths = found.suggested
      .filter((s) => s.from === 'structuralInputs')
      .map((s) => s.path);
    expect(inputPaths).toEqual(['maxSwingAngle', 'deflectionLimit', 'beamMoistureContent']);
    expect(found.suggested.every((s) => !s.confirmed && s.basis.kind !== 'answer')).toBe(true);
  });

  it('treats a value changed before creating as entered', () => {
    const found = suggestedFor(template, answers, example.params, {
      ...inputs,
      deflectionLimit: 360,
    });
    if (!found.ok) throw new Error(JSON.stringify(found.issues));
    expect(found.suggested.map((s) => s.path)).not.toContain('deflectionLimit');
    expect(found.suggested.map((s) => s.path)).toContain('maxSwingAngle');
  });

  it('refuses answers the questions do not take', () => {
    const found = suggestedFor(template, { riders: 'nobody' }, example.params, inputs);
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.issues[0]?.params).toEqual(['answers']);
  });
});

describe('carrySuggested', () => {
  const before = { params: {}, structuralInputs: { deflectionLimit: 240 } };

  it('keeps a suggestion whose value the save left alone', () => {
    const after = { params: { beamLength: 120 }, structuralInputs: { deflectionLimit: 240 } };
    expect(carrySuggested(template.form, [limit], before, after)).toEqual([limit]);
  });

  it('drops one the save changed or cleared: the owner entered it', () => {
    const changed = { params: {}, structuralInputs: { deflectionLimit: 360 } };
    expect(carrySuggested(template.form, [limit], before, changed)).toEqual([]);
    const cleared = { params: {}, structuralInputs: {} };
    expect(carrySuggested(template.form, [limit], before, cleared)).toEqual([]);
  });
});

describe('confirmSuggested', () => {
  it('confirms and unconfirms, the last change to a field winning', () => {
    const on = confirmSuggested(
      [limit],
      [
        { from: 'structuralInputs', path: 'deflectionLimit', confirmed: false },
        { from: 'structuralInputs', path: 'deflectionLimit', confirmed: true },
      ],
    );
    expect(on).toEqual({ ok: true, suggested: [{ ...limit, confirmed: true }] });
  });

  it('names a field that holds no suggestion, and changes nothing', () => {
    expect(
      confirmSuggested(
        [limit],
        [{ from: 'structuralInputs', path: 'dynamicFactor', confirmed: true }],
      ),
    ).toEqual({ ok: false, unknown: [{ from: 'structuralInputs', path: 'dynamicFactor' }] });
  });
});

describe('what the review and the editor say', () => {
  const snapshot = {
    params: {},
    structuralInputs: { deflectionLimit: 240 },
    suggested: [limit],
  };

  it('lists each suggestion with its label and value', () => {
    expect(suggestedItems(template.form, snapshot)).toEqual([
      {
        ...limit,
        key: 'structuralInputs deflectionLimit',
        label: 'Deflection limit (span divided by)',
        text: '240',
        about: 'Suggested by Kerf, not confirmed yet. Source: A code, a table.',
      },
    ]);
  });

  it('tells the editor how to confirm it', () => {
    expect(
      suggestedFields(template.form, snapshot).get('structuralInputs deflectionLimit'),
    ).toEqual({
      text: '240',
      about:
        'Suggested by Kerf, not confirmed yet. Source: A code, a table. Confirm it in the structural review, or change it here.',
    });
  });
});
