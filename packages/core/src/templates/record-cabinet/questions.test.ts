import { describe, expect, it } from 'vitest';
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

  it('takes the turntable and speaker from the answers, and leaves the owner’s values and inputs empty', () => {
    expect(at(suggestions, 'speaker.place')?.value).toBe('top');
    const paths = suggestions.map((s) => s.path);
    for (const owner of [
      'dadoDepth',
      'stoppedSetback',
      'jacket',
      'board.width',
      'allowances.rip',
    ]) {
      expect(paths).not.toContain(owner);
    }
    expect(suggestions.every((s) => s.from === 'params')).toBe(true);
  });

  it('is offered by the template', () => {
    expect(recordCabinet.questions).toBe(CABINET_QUESTIONS);
  });
});
