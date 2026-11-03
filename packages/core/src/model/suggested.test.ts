import { describe, expect, it } from 'vitest';
import { swingSetAFrame } from '../templates/swing-set-a-frame/definition.ts';
import { EXAMPLES } from '../templates/swing-set-a-frame/examples.ts';
import type { TemplateDefinition } from './definition.ts';
import type { Suggestion } from './questions.ts';
import {
  carrySuggested,
  confirmSuggested,
  filledFields,
  fillMissing,
  type SuggestedValue,
  suggestedAfter,
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

describe('values an older plan lacks (#429)', () => {
  const source = { kind: 'source', citation: 'A code, a table' } as const;
  const missing: Suggestion[] = [
    { from: 'structuralInputs', path: 'deflectionLimit', value: 240, basis: source },
    { from: 'params', path: 'frameInset', value: 6, basis: { kind: 'rule-of-thumb', rule: 'six' } },
    { from: 'params', path: 'hardware.legBoltDiameter', value: 0.5, basis: source },
  ];
  const older = { ...template, suggestMissing: () => missing };
  const { frameInset: _, ...params } = example.params as Record<string, unknown> & {
    hardware: Record<string, unknown>;
  };
  const { legBoltDiameter: __, ...hardware } = params.hardware;
  const stored = {
    params: { ...params, hardware },
    structuralInputs: { maxSwingAngle: 90 },
    suggested: [],
  };

  it('fills only what the plan lacks, saying so, and changes nothing it holds', () => {
    const filled = fillMissing(older, stored);
    expect(filled.params).toEqual({ ...example.params, frameInset: 6 });
    expect(filled.structuralInputs).toEqual({ maxSwingAngle: 90, deflectionLimit: 240 });
    expect(filled.filled.map((s) => s.path)).toEqual([
      'deflectionLimit',
      'frameInset',
      'hardware.legBoltDiameter',
    ]);
    expect(stored.structuralInputs).toEqual({ maxSwingAngle: 90 });
    const held = { ...stored, structuralInputs: { deflectionLimit: 360 } };
    expect(fillMissing(older, held).structuralInputs).toEqual({ deflectionLimit: 360 });
    expect(fillMissing(template, stored).filled).toEqual([]);
  });

  it('keeps a filled structural input or confirmed parameter as an unconfirmed suggestion', () => {
    const filled = fillMissing(older, stored);
    expect(suggestedAfter(older, stored, filled)).toEqual([
      { from: 'structuralInputs', path: 'deflectionLimit', basis: source, confirmed: false },
      { from: 'params', path: 'hardware.legBoltDiameter', basis: source, confirmed: false },
    ]);
  });

  it('treats a filled value the owner changed as entered', () => {
    const filled = fillMissing(older, stored);
    const changed = { ...filled, structuralInputs: { maxSwingAngle: 90, deflectionLimit: 360 } };
    expect(suggestedAfter(older, stored, changed).map((s) => s.path)).toEqual([
      'hardware.legBoltDiameter',
    ]);
  });

  it('says under each filled field where its value came from', () => {
    const about = filledFields(older.form, fillMissing(older, stored).filled);
    expect(about.get('structuralInputs deflectionLimit')).toEqual({
      text: '240',
      about:
        'Source: A code, a table. Your plan was saved before Kerf asked for this, so Kerf suggests it. It stays a suggestion until you confirm it in the structural review or change it.',
    });
    expect(about.get('params frameInset')?.about).toBe(
      'Rule of thumb: six. Your plan was saved before Kerf asked for this, so Kerf suggests it.',
    );
  });
});
