import { describe, expect, it } from 'vitest';
import { buildFromForm } from '../../model/form.ts';
import { suggestedValues } from '../../model/questions.ts';
import { recordCabinet } from './definition.ts';
import { CABINET_QUESTIONS } from './questions.ts';

// Starting questions (spec, Starting questions), with the owner's rough window: a stool about 22"
// high; the other measurements are made up for the test.

const answers = {
  window: { stoolHeight: 22, stoolDepth: 2.5, apronBottom: 18, casingWidth: 54, stoolWidth: 56 },
  topItem: { width: 16.5, depth: 13.5, height: 15 },
  lumber: { source: 'store' as const },
};
const at = (suggestions: ReturnType<typeof CABINET_QUESTIONS.suggest>, path: string) =>
  suggestions.find((s) => s.path === path);

describe('record cabinet starting questions', () => {
  const suggestions = CABINET_QUESTIONS.suggest(answers);

  it('suggests the base, and says how high the top comes out and where it stands', () => {
    // 3/4" boards flatten to 11/16" panels: 5 + 2-1/2 + 2 × 11/16 + 13-1/4 = 22-1/8, 1/8 above
    // the 22" stool and above the apron's bottom at 18, so off the wall by the stool's 2-1/2.
    const legs = at(suggestions, 'legShowing');
    expect(legs?.value).toBe(5);
    expect(legs?.note).toBe(
      'With these sizes the top is 22-1/8" high, 1/8" above the window stool. The top is above the bottom of the stool\'s apron, so the cabinet stands at least 2-1/2" from the wall, clear of the stool.',
    );
    const values = (paths: string[]) => paths.map((path) => at(suggestions, path)?.value);
    // A foot 2/3 of the 1-1/2" leg, 1"; a tenon a third of 3/4", 1/4", and 3/4 + 1/4 = 1" long.
    expect(
      values([
        'apronHeight',
        'legStock.size',
        'legStock.lengths.0',
        'legStock.lengths.1',
        'footSize',
        'apronSetback',
        'tenonThickness',
        'tenonLength',
        'bayHeight',
      ]),
    ).toEqual([2.5, 1.5, 3, 4, 1, 0.125, 0.25, 1, 13.25]);
  });

  it('makes it as wide as the casing, with the stool width for comparison', () => {
    const width = at(suggestions, 'width');
    expect(width?.value).toBe(54);
    expect(width?.note).toBe('The stool is 56" wide, for comparison.');
  });

  it('suggests nothing outside the template’s range, and says why', () => {
    const wide = at(
      CABINET_QUESTIONS.suggest({ ...answers, window: { ...answers.window, casingWidth: 80 } }),
      'width',
    );
    expect(wide?.value).toBeNull();
    expect(wide?.note).toContain('outside 30" to 72"');
  });

  it('takes the largest item from the answers, and says when it stands above the stool', () => {
    // On the 22-1/8" top, the item's 15 stands 15-1/8 above the 22" stool.
    const height = at(suggestions, 'topItem.height');
    expect(height?.value).toBe(15);
    expect(height?.note).toBe(
      'On the 22-1/8" top, it stands 15-1/8" above the window stool, in front of the window.',
    );
    const low = CABINET_QUESTIONS.suggest({
      ...answers,
      window: { ...answers.window, stoolHeight: 40 },
    });
    expect(at(low, 'topItem.height')?.note).toBeUndefined();
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
    expect(empty.map(([path]) => path)).toEqual([
      'legStock.lengths.2',
      'legStock.lengths.3',
      'board.lengths.3',
    ]);
    const made = recordCabinet.generate(
      recordCabinet.params.parse(buildFromForm(recordCabinet.form.params, params)),
      {},
    );
    expect(made.ok).toBe(true);
  });

  it('from a dealer, flattens 4/4 surfaced to 13/16" into 3/4" panels with 3/16" dadoes', () => {
    // 13/16 − 1/16 = 3/4; a quarter of 3/4 is 3/16, already a whole sixteenth.
    const dealer = CABINET_QUESTIONS.suggest({ ...answers, lumber: { source: 'dealer' } });
    const values = (paths: string[]) => paths.map((path) => at(dealer, path)?.value);
    expect(values(['board.source', 'board.quarters', 'board.surfaced', 'board.planWidth'])).toEqual(
      ['dealer', 4, 0.8125, 6],
    );
    expect(values(['board.wastePercent', 'panelThickness', 'dadoDepth'])).toEqual([
      20, 0.75, 0.1875,
    ]);
    expect(at(dealer, 'board.surfaced')?.basis.kind).toBe('source');
    const { params } = suggestedValues(recordCabinet.form, dealer);
    const made = recordCabinet.generate(
      recordCabinet.params.parse(buildFromForm(recordCabinet.form.params, params)),
      {},
    );
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const line = made.output.lumber.lines[0];
    expect(line?.nominal).toBe('4/4 hardwood');
    expect(line?.boardFeet).toBeGreaterThan(0);
  });

  it('is offered by the template', () => {
    expect(recordCabinet.questions).toBe(CABINET_QUESTIONS);
  });
});
