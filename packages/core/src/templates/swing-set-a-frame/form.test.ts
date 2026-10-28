import { describe, expect, it } from 'vitest';
import { buildFromForm, formValues, visibleFields } from '../form.ts';
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
