import { describe, expect, it } from 'vitest';
import { buildFromForm, confirmedPaths, entryProblems, formValues } from '../../model/form.ts';
import { describeBasis, type Suggestion, suggestedValues } from '../../model/questions.ts';
import { swingSetAFrame } from './definition.ts';
import { WORKED_EXAMPLE } from './examples.ts';
import { SWING_SET_FORM } from './form.ts';
import {
  SWING_SET_QUESTIONS,
  type SwingSetAnswers,
  shortestBeam,
  smallestSpace,
  suggest,
} from './questions.ts';
import { pendulumFactor } from './structural.ts';

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

/** The smallest space the answers allow: 245 along the beam and 240 deep (spec, Rules). */
const smallest: SwingSetAnswers = {
  riders: 'kids',
  riderWeights: [90, 110],
  area: { length: 245, depth: 240 },
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
    expect(s.some((x) => x.note?.startsWith('Lowered'))).toBe(false);
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
      note: `Lowered to fit your 28' 0" depth. The usual height, 10' 0", needs 40' 0" front to back for its swing zones.`,
    });
    // 252 − 2 · 72 = 108, under the example's 120 and over the 100.5 two swings need.
    expect(valueAt(s, 'beamLength')).toMatchObject({
      value: 108,
      note: `Shortened to fit your 21' 0" length along the beam. The worked example's beam, 10' 0", needs 22' 0" with the clear area at each end.`,
    });
    expect(valueAt(s, 'swings.centers.0')?.value).toBe(36);
    expect(valueAt(s, 'swings.centers.1')?.value).toBe(72);
    // floor(84 · 40/96) = 35.
    expect(valueAt(s, 'crossbarHeight')?.value).toBe(35);
  });

  it('fits the shortest and lowest beam in the smallest space the answers allow', () => {
    const s = suggest(smallest);
    // floor(240 / 4) = 60, the lowest beam.
    expect(valueAt(s, 'beamHeight')?.value).toBe(60);
    // floor(245 − 144) = 101 = ceil(100.5), the shortest beam two swings fit.
    expect(valueAt(s, 'beamLength')?.value).toBe(101);
    // 101 / 3 = 33.667, to 33-11/16; 202 / 3 = 67.333, to 67-5/16.
    expect(valueAt(s, 'swings.centers.0')?.value).toBe(33.6875);
    expect(valueAt(s, 'swings.centers.1')?.value).toBe(67.3125);
    // floor(60 · 40/96) = 25.
    expect(valueAt(s, 'crossbarHeight')?.value).toBe(25);
  });

  it('keeps two swings at the thirds with the CPSC seat gaps from 100.5 inches', () => {
    // 3 · max(8 + 20/2 + 12 + 3.5, 8 + 20) = 3 · 33.5.
    expect(shortestBeam()).toBe(100.5);
  });

  it('needs 245 inches along the beam and 240 front to back', () => {
    // ceil(100.5) + 2 · 72 = 245, 20' 5"; 4 · 60 = 240, 20' 0".
    expect(smallestSpace()).toEqual({ length: 245, depth: 240 });
  });

  it.each([
    ['kids only', kidsOnly],
    ['kids and adults', kidsAndAdults],
    ['a small yard', smallYard],
    ['the smallest space', smallest],
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

  it('plans legs on pads before the anchor count is entered, listing the anchors as needed (#406)', () => {
    const result = swingSetAFrame.generate(paramsFrom(kidsOnly) as never, {});
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const anchors = result.output.hardware.find((h) => h.description === 'Ground anchors');
    expect(anchors).not.toHaveProperty('quantity');
    expect(anchors?.quantityNeeded?.key).toBe('hardware.anchorsPerFoot');
  });

  it.each([kidsOnly, kidsAndAdults, smallYard, smallest])(
    'suggests only the structural inputs and bolts with a source or a stated bound (rule 3, #355)',
    (answers) => {
      const s = suggest(answers);
      const inputs = s.filter((x) => x.from === 'structuralInputs').map((x) => x.path);
      expect(inputs).toEqual([
        'riderWeights.0',
        'riderWeights.1',
        'maxSwingAngle',
        'deflectionLimit',
        'beamMoistureContent',
      ]);
      // The bolts the layout check fits (#389); not the ply bolts, which no published schedule
      // gives, nor the anchors, which only the anchor maker's instructions can.
      const confirm = confirmedPaths(SWING_SET_FORM.params);
      expect(s.filter((x) => confirm.has(x.path)).map((x) => x.path)).toEqual([
        'hardware.legBoltDiameter',
        'hardware.crossbarBolts.diameter',
        'hardware.crossbarBolts.perJoint',
        'hardware.gussetBolts.diameter',
        'hardware.gussetBolts.perJoint',
      ]);
      const { inputs: text } = suggestedValues(SWING_SET_FORM, s);
      // Left for the owner: what only the boards and hardware bought can say, and the dynamic
      // factor, which no published value covers.
      const empty = Object.entries(text)
        .filter(([, t]) => t === '')
        .map(([path]) => path);
      expect(empty.sort()).toEqual(
        ['beamIncised', 'beamSpeciesGrade', 'dynamicFactor', 'hangerRating'].sort(),
      );
    },
  );

  it('suggests the swing angle, deflection limit, and moisture with their bases (#388)', () => {
    const s = suggest(kidsOnly);
    const at = (path: string) => s.find((x) => x.from === 'structuralInputs' && x.path === path);
    // 90°: chains level with the beam, where the pendulum factor 3 − 2 cos θ is largest, 3.
    expect(at('maxSwingAngle')).toMatchObject({ value: 90, basis: { kind: 'rule-of-thumb' } });
    expect(pendulumFactor(90)).toBeCloseTo(3, 12);
    // IBC 2021 Table 1604.3: floor members, l/240 under dead plus live load, the load the
    // deflection check uses (the swing load plus the beam's own weight).
    expect(at('deflectionLimit')).toMatchObject({
      value: 240,
      basis: { kind: 'source', citation: expect.stringContaining('Table 1604.3') },
    });
    // 30%, the fiber saturation point of Simpson's density equations (FPL-GTR-76, Eq. 4).
    expect(at('beamMoistureContent')).toMatchObject({
      value: 30,
      basis: { kind: 'source', citation: expect.stringContaining('FPL-GTR-76') },
    });
    expect(s.find((x) => x.path === 'dynamicFactor')).toBeUndefined();
  });

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

  it('asks for more room along the beam when two swings and their clear area do not fit (#458)', () => {
    const issues = (area: SwingSetAnswers['area']) => {
      const parsed = SWING_SET_QUESTIONS.answers.safeParse({ ...kidsOnly, area });
      return parsed.success ? [] : parsed.error.issues.map((i) => [i.path.join('.'), i.message]);
    };
    // 245 − 1/16: floor(244.9375 − 144) = 100, under the 101 two swings need.
    expect(issues({ length: 245 - 1 / 16, depth: 480 })).toEqual([
      [
        'area.length',
        `Length along the beam must be at least 20' 5" for two swings and their clear area.`,
      ],
    ]);
    expect(issues({ length: 245, depth: 480 })).toEqual([]);
    expect(issues({ length: 245 + 1 / 16, depth: 480 })).toEqual([]);
    // The audit's space: 14' along the beam, 168 − 144 = 24.
    expect(issues({ length: 168, depth: 318 }).map(([path]) => path)).toEqual(['area.length']);
  });

  it('asks for more depth when the swing zones of the lowest beam do not fit (#458)', () => {
    const issues = (depth: number) => {
      const parsed = SWING_SET_QUESTIONS.answers.safeParse({
        ...kidsOnly,
        area: { length: 360, depth },
      });
      return parsed.success ? [] : parsed.error.issues.map((i) => [i.path.join('.'), i.message]);
    };
    // 240 − 1/16: floor(239.9375 / 4) = 59, under the lowest beam, 60.
    expect(issues(240 - 1 / 16)).toEqual([
      [
        'area.depth',
        `Depth, front to back, must be at least 20' 0" for the swing zones of the lowest beam Kerf draws, 5' 0".`,
      ],
    ]);
    expect(issues(240)).toEqual([]);
    expect(issues(240 + 1 / 16)).toEqual([]);
  });

  it('says a beam height lowered to fit the depth was lowered (#458)', () => {
    // The audit's depth, 26' 6" = 318: floor(318 / 4) = 79, 6' 7".
    const s = suggest({ ...kidsOnly, area: { length: 360, depth: 318 } });
    expect(valueAt(s, 'beamHeight')).toMatchObject({
      value: 79,
      note: `Lowered to fit your 26' 6" depth. The usual height, 8' 0", needs 32' 0" front to back for its swing zones.`,
    });
  });
});
