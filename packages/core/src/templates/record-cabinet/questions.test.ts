import { describe, expect, it } from 'vitest';
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

  it('takes the turntable and speaker from the answers, and leaves every structural input empty', () => {
    expect(at(suggestions, 'speaker.place')?.value).toBe('top');
    expect(suggestions.every((s) => s.from === 'params')).toBe(true);
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

  it('makes each dado a quarter of the panel thickness, leaving half of a partition', () => {
    // 3/4" panels: 3/16" dadoes on both faces leave 3/4 − 2 × 3/16 = 3/8".
    const dado = at(suggestions, 'dadoDepth');
    expect(dado?.value).toBe(0.1875);
    expect(dado?.basis.kind).toBe('rule-of-thumb');
  });

  it('suggests the allowances and setback as rules of thumb', () => {
    const rules = [
      'allowances.jointPerEdge',
      'allowances.rip',
      'allowances.trimPerEnd',
      'stoppedSetback',
    ];
    expect(rules.map((path) => at(suggestions, path)?.value)).toEqual([0.0625, 0.5, 1, 0.5]);
    expect(rules.every((path) => at(suggestions, path)?.basis.kind === 'rule-of-thumb')).toBe(true);
  });

  it('suggests every parameter, so a plan can be saved from the answers alone', () => {
    const { params } = suggestedValues(recordCabinet.form, suggestions);
    expect(
      Object.entries(params).filter(([path, text]) => text === '' && path !== 'board.lengths.3'),
    ).toEqual([]);
  });

  it('is offered by the template', () => {
    expect(recordCabinet.questions).toBe(CABINET_QUESTIONS);
  });
});
