import { describe, expect, it } from 'vitest';
import {
  buildFromForm,
  confirmedPaths,
  entryEcho,
  entryProblems,
  formParts,
  formValues,
  schemaProblemMessage,
  visibleFields,
} from '../../model/form.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';
import { SWING_SET_FORM } from './form.ts';

// The form must reach every parameter and input the template takes, and give back exactly what
// was stored, or the editor would quietly drop or change a value.

describe('the swing-set form', () => {
  it.each(EXAMPLES.map((e) => [e.name, e] as const))(
    'reads back %s exactly, through the form text',
    (_name, example) => {
      const params = formValues(SWING_SET_FORM.params, example.params);
      expect(buildFromForm(SWING_SET_FORM.params, params)).toEqual(example.params);
      const inputs = formValues(SWING_SET_FORM.structuralInputs, example.structuralInputs);
      expect(buildFromForm(SWING_SET_FORM.structuralInputs, inputs)).toEqual(
        example.structuralInputs,
      );
    },
  );

  it('shows the fields by part of the swing set, each once', () => {
    const parts = formParts(SWING_SET_FORM);
    expect(parts.map((p) => p.title)).toEqual([
      'Beam',
      'Legs',
      'Crossbars',
      'Gussets',
      'Site',
      'Swings',
      'Loads',
    ]);
    const shown = parts.flatMap((p) => p.fields.map((f) => `${f.from} ${f.field.path}`));
    expect(new Set(shown).size).toBe(shown.length);
    expect(parts.find((p) => p.title === 'Beam')?.fields.map((f) => f.field.path)).toContain(
      'beamSpeciesGrade',
    );
  });

  it('asks the owner to enter or confirm every hardware size and count, and nothing else', () => {
    const fields = SWING_SET_FORM.params.flatMap((s) => s.fields.map((f) => f.path));
    expect([...confirmedPaths(SWING_SET_FORM.params)]).toEqual(
      fields.filter((p) => p.startsWith('hardware.')),
    );
    expect(fields.filter((p) => p.startsWith('hardware.'))).toHaveLength(8);
  });

  it('starts with every field empty, so nothing is entered for the owner', () => {
    for (const sections of [SWING_SET_FORM.params, SWING_SET_FORM.structuralInputs]) {
      const empty = formValues(sections, {});
      expect(Object.values(empty).every((v) => v === '')).toBe(true);
      expect(buildFromForm(sections, empty)).toEqual({});
    }
  });

  it('accepts empty structural inputs, and requires every parameter', () => {
    const def = swingSetAFrame;
    expect(def.structuralInputs.safeParse({}).success).toBe(true);
    const parsed = def.params.safeParse(buildFromForm(SWING_SET_FORM.params, {}));
    expect(parsed.success).toBe(false);
  });

  it('asks for ply bolts only on a built-up beam, and anchors only on pads', () => {
    const paths = (values: Record<string, string>) =>
      visibleFields(SWING_SET_FORM.params, values).map((f) => f.path);
    expect(paths({ beamPlies: '1', burialDepth: '24' })).not.toContain('hardware.plyBolts.count');
    expect(paths({ beamPlies: '2' })).toContain('hardware.plyBolts.count');
    expect(paths({ burialDepth: '24' })).not.toContain('hardware.anchorsPerFoot');
    expect(paths({ burialDepth: '0' })).toContain('hardware.anchorsPerFoot');
    expect(paths({ burialDepth: '' })).not.toContain('hardware.anchorsPerFoot');
  });

  it('sends only the splay field that matches how splay is entered', () => {
    const built = buildFromForm(SWING_SET_FORM.params, {
      'splay.kind': 'angle',
      'splay.degrees': '20',
      'splay.depth': '80',
    });
    expect(built.splay).toEqual({ kind: 'angle', degrees: 20 });
  });

  it('keeps choice values their type: bolt diameters and plies as numbers', () => {
    const built = buildFromForm(SWING_SET_FORM.params, {
      beamPlies: '2',
      'hardware.legBoltDiameter': '0.5',
    });
    expect(built).toEqual({ beamPlies: 2, hardware: { legBoltDiameter: 0.5 } });
  });

  it('builds tuples from numbered paths, leaving a missing entry for the schema to report', () => {
    const built = buildFromForm(SWING_SET_FORM.structuralInputs, { 'riderWeights.1': '150' });
    expect(built.riderWeights).toEqual([undefined, 150]);
    expect(swingSetAFrame.structuralInputs.safeParse(built).success).toBe(false);
  });
});

describe('typed lengths in the swing-set form (#67)', () => {
  const field = (path: string) => {
    const f = [...SWING_SET_FORM.params, ...SWING_SET_FORM.structuralInputs]
      .flatMap((s) => s.fields)
      .find((x) => x.path === path);
    if (!f) throw new Error(path);
    return f;
  };

  it('reads lengths as a plan writes them, and the slope as a fraction', () => {
    const built = buildFromForm(SWING_SET_FORM.params, {
      beamLength: "10'",
      beamHeight: "8' 0",
      crossbarHeight: '3\' 4"',
      burialDepth: '24',
      groundSlope: '1/4',
      'swings.seatHeight': '15-1/2',
    });
    // 10 * 12 = 120; 8 * 12 = 96; 3 * 12 + 4 = 40; 15 + 1/2 = 15.5.
    expect(built).toEqual({
      beamLength: 120,
      beamHeight: 96,
      crossbarHeight: 40,
      burialDepth: 24,
      groundSlope: 0.25,
      swings: { seatHeight: 15.5 },
    });
  });

  it('reads the leg angle as degrees', () => {
    const built = buildFromForm(SWING_SET_FORM.params, {
      'splay.kind': 'angle',
      'splay.degrees': '20°',
    });
    expect(built.splay).toEqual({ kind: 'angle', degrees: 20 });
  });

  it('writes stored lengths back so saving again changes nothing', () => {
    const stored = { beamLength: 120, beamHeight: 138.375, frameInset: 12.4, burialDepth: 1 / 32 };
    const text = formValues(SWING_SET_FORM.params, stored);
    expect(text.beamHeight).toBe('138-3/8');
    expect(text.frameInset).toBe('12.4');
    expect(text.burialDepth).toBe('0.03125');
    expect(buildFromForm(SWING_SET_FORM.params, text)).toEqual(stored);
  });

  it('says what to type for text it cannot read, and leaves empty fields to the schema', () => {
    const problems = entryProblems(SWING_SET_FORM.params, {
      beamLength: '11 6',
      beamHeight: '',
      groundSlope: '1/3',
      'splay.kind': 'angle',
      'splay.degrees': "20°30'",
    });
    expect(problems).toEqual([
      {
        field: 'beamLength',
        message: `Mark feet with ': such as 11' 6". A number on its own is inches.`,
      },
      { field: 'splay.degrees', message: 'Enter decimal degrees, such as 20.5.' },
      {
        field: 'groundSlope',
        message:
          'Use a fraction a tape reads: halves, quarters, eighths, sixteenths, 32nds or 64ths.',
      },
    ]);
  });

  it('echoes a length while it is typed', () => {
    expect(entryEcho(field('beamHeight'), "8'")).toBe(`8' 0" · 96"`);
    expect(entryEcho(field('beamHeight'), '8 0')).toBe('Not a length yet');
    expect(entryEcho(field('beamHeight'), '')).toBeNull();
    expect(entryEcho(field('groundSlope'), '1')).toBeNull();
  });

  it('gives range problems with both limits, in the field’s units, from the schema', () => {
    const message = (path: string, text: string, values: Record<string, string> = {}) => {
      const parsed = swingSetAFrame.params.safeParse(
        buildFromForm(SWING_SET_FORM.params, { ...values, [path]: text }),
      );
      const issue = parsed.error?.issues.find((i) => i.path.join('.') === path);
      if (!issue) throw new Error(`no issue at ${path}`);
      return schemaProblemMessage(field(path), issue, text, swingSetAFrame.params);
    };
    // The schema allows a beam height of 60" to 144": 5' 0" to 12' 0".
    expect(message('beamHeight', "15'")).toBe(`Beam height must be from 5' 0" to 12' 0".`);
    // Splay degrees sit inside a union; the schema allows 5° to 35°.
    expect(message('splay.degrees', '40', { 'splay.kind': 'angle' })).toBe(
      'Leg angle from vertical must be from 5.0° to 35.0°.',
    );
    // Hanger spacing only has to be more than 0, so one limit is given.
    expect(message('swings.hangerSpacing', '0')).toBe('Hanger spacing must be more than 0".');
    // Slope is -3 to 3 inches per foot.
    expect(message('groundSlope', '4')).toBe(
      'Ground slope must be from -3 in per ft to 3 in per ft.',
    );
  });

  it('asks for a whole number where the schema wants one, and for a choice when empty', () => {
    const parsed = swingSetAFrame.params.safeParse(
      buildFromForm(SWING_SET_FORM.params, { 'hardware.crossbarBolts.perJoint': '1.5' }),
    );
    const issue = parsed.error?.issues.find(
      (i) => i.path.join('.') === 'hardware.crossbarBolts.perJoint',
    );
    if (!issue) throw new Error('no issue');
    expect(schemaProblemMessage(field('hardware.crossbarBolts.perJoint'), issue, '1.5')).toBe(
      'Enter a whole number.',
    );
    expect(
      schemaProblemMessage(
        field('beamStock'),
        { code: 'invalid_value', path: [], message: '' },
        '',
      ),
    ).toBe('Choose one of the options.');
  });
});
