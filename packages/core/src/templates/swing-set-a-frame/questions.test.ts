import { describe, expect, it } from 'vitest';
import { buildFromForm, confirmedPaths, entryProblems, formValues } from '../../model/form.ts';
import { describeBasis, type Suggestion, suggestedValues } from '../../model/questions.ts';
import { swingSetAFrame } from './definition.ts';
import { WORKED_EXAMPLE } from './examples.ts';
import { SWING_SET_FORM } from './form.ts';
import { SWING_SET_QUESTIONS, type SwingSetAnswers, shortestBeam, suggest } from './questions.ts';

// Starting questions (#163; spec, Starting questions). Each answer set's values are worked by
// hand in the spec.

const kidsOnly: SwingSetAnswers = {
  riders: 'kids',
  riderWeights: [90, 110],
  area: { length: 360, depth: 480 },
  ground: { kind: 'level' },
  feet: 'pads',
};

const kidsAndAdults: SwingSetAnswers = {
  riders: 'kids-and-adults',
  riderWeights: [220, 110],
  area: { length: 360, depth: 480 },
  ground: { kind: 'sloped', slope: 1 },
  feet: 'buried',
};

const smallYard: SwingSetAnswers = {
  riders: 'kids-and-adults',
  riderWeights: [200, 90],
  area: { length: 252, depth: 336 },
  ground: { kind: 'level' },
  feet: 'buried',
};

const tooSmall: SwingSetAnswers = {
  riders: 'kids',
  riderWeights: [90, 0],
  area: { length: 240, depth: 192 },
  ground: { kind: 'level' },
  feet: 'pads',
};

const valueAt = (suggestions: Suggestion[], path: string) =>
  suggestions.find((s) => s.path === path);

/** The suggested parameters, with the worked example's hardware entered, as the owner would. */
function paramsFrom(answers: SwingSetAnswers) {
  const { params } = suggestedValues(SWING_SET_FORM, suggest(answers));
  const hardware = formValues(SWING_SET_FORM.params, WORKED_EXAMPLE);
  const confirm = confirmedPaths(SWING_SET_FORM.params);
  const entered = Object.fromEntries(
    Object.entries(params).map(([path, text]) => [
      path,
      confirm.has(path) ? (hardware[path] ?? '') : text,
    ]),
  );
  if (answers.feet === 'pads') entered['hardware.anchorsPerFoot'] = '1';
  return buildFromForm(SWING_SET_FORM.params, entered);
}

describe('suggestions from the starting questions', () => {
  it('works the kids-only example', () => {
    const s = suggest(kidsOnly);
    expect(valueAt(s, 'beamHeight')).toMatchObject({ value: 96, basis: { kind: 'rule-of-thumb' } });
    expect(valueAt(s, 'beamLength')).toMatchObject({ value: 120, basis: { kind: 'example' } });
    expect(valueAt(s, 'swings.centers.0')?.value).toBe(40);
    expect(valueAt(s, 'swings.centers.1')?.value).toBe(80);
    expect(valueAt(s, 'crossbarHeight')?.value).toBe(40);
    expect(valueAt(s, 'groundSlope')).toMatchObject({ value: 0, basis: { kind: 'answer' } });
    expect(valueAt(s, 'burialDepth')).toMatchObject({ value: 0, basis: { kind: 'answer' } });
    expect(valueAt(s, 'riderWeights.0')).toMatchObject({ from: 'structuralInputs', value: 90 });
    expect(valueAt(s, 'riderWeights.1')).toMatchObject({ from: 'structuralInputs', value: 110 });
    expect(s.some((x) => x.note?.startsWith('The usual height'))).toBe(false);
  });

  it('works the kids-and-adults example, whose depth just fits 10 ft', () => {
    const s = suggest(kidsAndAdults);
    // 480 / 4 = 120, the rule of thumb exactly.
    expect(valueAt(s, 'beamHeight')).toMatchObject({
      value: 120,
      basis: { kind: 'rule-of-thumb' },
    });
    expect(valueAt(s, 'beamLength')?.value).toBe(120);
    // floor(120 · 40/96) = 50.
    expect(valueAt(s, 'crossbarHeight')?.value).toBe(50);
    expect(valueAt(s, 'groundSlope')?.value).toBe(1);
    expect(valueAt(s, 'burialDepth')).toMatchObject({ value: 24, basis: { kind: 'example' } });
    expect(valueAt(s, 'riderWeights.0')?.value).toBe(220);
  });

  it('says so, and offers the tallest and longest that fit, in a yard too small for the usual sizes', () => {
    const s = suggest(smallYard);
    // floor(336 / 4) = 84, under the 120 the rule of thumb gives with adults.
    expect(valueAt(s, 'beamHeight')).toMatchObject({
      value: 84,
      basis: { kind: 'source' },
      note: `The usual height is 10' 0", and its swing zones need 40' 0" front to back. Your 28' 0" fits a beam up to 7' 0".`,
    });
    // 252 − 2 · 72 = 108, under the example's 120 and over the 100.5 two swings need.
    expect(valueAt(s, 'beamLength')).toMatchObject({
      value: 108,
      note: `The worked example's beam is 10' 0", which needs 22' 0" along the beam with the clear area at each end. Your 21' 0" fits a beam up to 9' 0".`,
    });
    expect(valueAt(s, 'swings.centers.0')?.value).toBe(36);
    expect(valueAt(s, 'swings.centers.1')?.value).toBe(72);
    // floor(84 · 40/96) = 35.
    expect(valueAt(s, 'crossbarHeight')?.value).toBe(35);
  });

  it('leaves the beam empty, saying why, when no beam fits', () => {
    const s = suggest(tooSmall);
    // 192 / 4 = 48, under the lowest beam, 60; 240 − 144 = 96, under the 101 two swings need.
    expect(valueAt(s, 'beamHeight')).toMatchObject({ value: null });
    expect(valueAt(s, 'beamHeight')?.note).toContain(`needs 20' 0"`);
    expect(valueAt(s, 'beamLength')).toMatchObject({ value: null });
    expect(valueAt(s, 'beamLength')?.note).toContain(`at least 8' 5", so 20' 5"`);
    expect(valueAt(s, 'swings.centers.0')?.value).toBeNull();
    expect(valueAt(s, 'crossbarHeight')?.value).toBeNull();
  });

  it('keeps two swings at the thirds with the CPSC seat gaps from 100.5 inches', () => {
    // 3 · max(8 + 20/2 + 12 + 3.5, 8 + 20) = 3 · 33.5.
    expect(shortestBeam()).toBe(100.5);
  });

  it.each([
    ['kids only', kidsOnly],
    ['kids and adults', kidsAndAdults],
    ['a small yard', smallYard],
  ])('gives parameters the template accepts for %s, inside the space', (_name, answers) => {
    const params = paramsFrom(answers);
    const result = swingSetAFrame.generate(params as never, {});
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const { layout } = result.output.design;
    const rects = [layout.clearArea, ...layout.swingZones];
    const along = Math.max(...rects.map((r) => r.xMax)) - Math.min(...rects.map((r) => r.xMin));
    const across = Math.max(...rects.map((r) => r.yMax)) - Math.min(...rects.map((r) => r.yMin));
    expect(along).toBeLessThanOrEqual(answers.area.length);
    expect(across).toBeLessThanOrEqual(answers.area.depth);
  });

  it.each([kidsOnly, kidsAndAdults, smallYard, tooSmall])(
    'fills in no structural input but rider weight, and no hardware (rule 3)',
    (answers) => {
      const s = suggest(answers);
      const inputs = s.filter((x) => x.from === 'structuralInputs').map((x) => x.path);
      expect(inputs).toEqual(['riderWeights.0', 'riderWeights.1']);
      const confirm = confirmedPaths(SWING_SET_FORM.params);
      expect(s.filter((x) => confirm.has(x.path))).toEqual([]);
      const { inputs: text } = suggestedValues(SWING_SET_FORM, s);
      const filled = Object.entries(text).filter(([, t]) => t !== '');
      expect(filled.map(([path]) => path)).toEqual(['riderWeights.0', 'riderWeights.1']);
    },
  );

  it('suggests every parameter that is not hardware, each with where it came from', () => {
    const s = suggest(kidsOnly);
    const { params } = suggestedValues(SWING_SET_FORM, s);
    const confirm = confirmedPaths(SWING_SET_FORM.params);
    const empty = Object.entries(params)
      .filter(([path, text]) => text === '' && !confirm.has(path))
      .map(([path]) => path);
    // The footprint depth is the other way to enter the splay, hidden when it is an angle.
    expect(empty).toEqual(['splay.depth']);
    for (const x of s) expect(describeBasis(x.basis)).not.toBe('');
  });

  it('gives the same suggestions for the same answers', () => {
    expect(suggest(smallYard)).toEqual(suggest(smallYard));
  });
});

describe('the starting questions form', () => {
  it('reads back a complete set of answers through the form text', () => {
    for (const answers of [kidsOnly, kidsAndAdults]) {
      const text = formValues(SWING_SET_QUESTIONS.form, answers);
      expect(entryProblems(SWING_SET_QUESTIONS.form, text)).toEqual([]);
      expect(buildFromForm(SWING_SET_QUESTIONS.form, text)).toEqual(answers);
    }
  });

  it('parses answers before suggesting, and refuses incomplete ones', () => {
    expect(SWING_SET_QUESTIONS.suggest(kidsOnly)).toEqual(suggest(kidsOnly));
    expect(() => SWING_SET_QUESTIONS.suggest({ riders: 'kids' })).toThrow();
    expect(
      SWING_SET_QUESTIONS.answers.safeParse({ ...kidsOnly, riderWeights: [0, 0] }).success,
    ).toBe(false);
  });
});
