import { describe, expect, it } from 'vitest';
import { buildFromForm } from '../../model/form.ts';
import { suggestedValues } from '../../model/questions.ts';
import { recordCabinet } from './definition.ts';
import { CABINET_QUESTIONS } from './questions.ts';

// Starting questions (spec, Starting questions), with the owner's rough window: a stool about 22"
// high; the other measurements are made up for the test.

const answers = {
  window: { stoolHeight: 22, stoolDepth: 2.5, apronBottom: 18, casingWidth: 54, stoolWidth: 56 },
  turntable: { width: 16.5, depth: 13.5, lidHeight: 15 },
  speaker: { width: 14.33, height: 7.99, depth: 6.06, place: 'top' as const },
};
const at = (suggestions: ReturnType<typeof CABINET_QUESTIONS.suggest>, path: string) =>
  suggestions.find((s) => s.path === path);

describe('record cabinet starting questions', () => {
  const suggestions = CABINET_QUESTIONS.suggest(answers);

  it('puts the top 2" below the stool, and says it stands off the wall above the apron', () => {
    const height = at(suggestions, 'height');
    expect(height?.value).toBe(20);
    expect(height?.basis.kind).toBe('rule-of-thumb');
    // 20 is above the apron's bottom at 18.
    expect(height?.note).toBe(
      'The top is above the bottom of the apron, so the cabinet stands at least 2-1/2" from the wall, clear of the stool.',
    );
    const low = at(
      CABINET_QUESTIONS.suggest({ ...answers, window: { ...answers.window, apronBottom: 21 } }),
      'height',
    );
    expect(low?.note).toBeUndefined();
  });

  it('makes it as wide as the casing, with the stool width for comparison', () => {
    const width = at(suggestions, 'width');
    expect(width?.value).toBe(54);
    expect(width?.note).toBe('The stool is 56" wide, for comparison.');
  });

  it('suggests nothing outside the template’s range, and says why', () => {
    const tall = at(
      CABINET_QUESTIONS.suggest({ ...answers, window: { ...answers.window, stoolHeight: 40 } }),
      'height',
    );
    expect(tall?.value).toBeNull();
    expect(tall?.note).toContain('outside 16" to 30"');
  });

  it('takes the turntable and speaker from the answers', () => {
    expect(at(suggestions, 'speaker.place')?.value).toBe('top');
  });

  it('suggests only the moisture range and deflection limit among structural inputs, from sources (rule 3)', () => {
    const inputs = suggestions.filter((s) => s.from === 'structuralInputs');
    expect(inputs.map((s) => [s.path, s.value])).toEqual([
      ['moisture.low', 6],
      ['moisture.high', 10],
      ['deflectionLimit', 144],
    ]);
    for (const s of inputs) expect(s.basis.kind).toBe('source');
  });

  it('suggests a 1x6 board from the lumber standard, to be measured at the store', () => {
    const thickness = at(suggestions, 'board.thickness');
    expect([thickness?.value, at(suggestions, 'board.width')?.value]).toEqual([0.75, 5.5]);
    expect(thickness?.basis).toEqual({
      kind: 'source',
      citation: 'American Softwood Lumber Standard, PS 20-10, Table 3, a dry 1x6 board',
    });
    expect(thickness?.note).toBe('Measure the boards at your store.');
    expect([0, 1, 2].map((i) => at(suggestions, `board.lengths.${i}`)?.value)).toEqual([4, 6, 8]);
  });

  it('flattens the 3/4" boards to 11/16" panels, with dadoes leaving over half a partition', () => {
    // 3/4 − 1/16 = 11/16. A quarter of 11/16 is 11/64, rounded down to 1/16 is 1/8; dadoes on
    // both faces leave 11/16 − 2 × 1/8 = 7/16, over half of 11/16.
    expect(at(suggestions, 'panelThickness')?.value).toBe(0.6875);
    const dado = at(suggestions, 'dadoDepth');
    expect(dado?.value).toBe(0.125);
    expect(dado?.basis.kind).toBe('rule-of-thumb');
  });

  it('suggests the allowances and setback as rules of thumb', () => {
    const rules = [
      'allowances.jointPerEdge',
      'allowances.rip',
      'allowances.trimPerEnd',
      'allowances.flatten',
      'stoppedSetback',
    ];
    expect(rules.map((path) => at(suggestions, path)?.value)).toEqual([
      0.0625, 0.5, 1, 0.0625, 0.5,
    ]);
    expect(rules.every((path) => at(suggestions, path)?.basis.kind === 'rule-of-thumb')).toBe(true);
  });

  it('suggests every parameter, and they make a plan', () => {
    const { params } = suggestedValues(recordCabinet.form, suggestions);
    const empty = Object.entries(params).filter(([, text]) => text === '');
    expect(empty.map(([path]) => path)).toEqual(['board.lengths.3']);
    const made = recordCabinet.generate(
      recordCabinet.params.parse(buildFromForm(recordCabinet.form.params, params)),
      {},
    );
    expect(made.ok).toBe(true);
  });

  it('is offered by the template', () => {
    expect(recordCabinet.questions).toBe(CABINET_QUESTIONS);
  });
});
