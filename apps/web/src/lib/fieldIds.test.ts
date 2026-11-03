import { findTemplate, TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { fieldId, inputFieldId } from './fieldIds.ts';

const form = (id: string) => {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.form;
};

/** Every `missing` input's key anywhere in a template's outputs. */
function missingKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) missingKeys(item, keys);
  else if (value && typeof value === 'object') {
    for (const [name, inner] of Object.entries(value)) {
      if (name === 'missing' && Array.isArray(inner)) {
        for (const m of inner) keys.add((m as { key: string }).key);
      } else missingKeys(inner, keys);
    }
  }
  return keys;
}

describe('inputFieldId', () => {
  it('finds the field for an input by its path', () => {
    expect(inputFieldId(form('swing-set-a-frame'), 'dynamicFactor')).toBe('s-dynamicFactor');
  });

  it('finds the first field under an input entered in parts', () => {
    expect(inputFieldId(form('record-cabinet'), 'moisture')).toBe('s-moisture.low');
  });

  it('finds a field for every input each template names as missing with none entered', () => {
    for (const template of TEMPLATES) {
      const example = template.examples[0];
      if (!example) throw new Error(`${template.id} has no worked example`);
      const result = template.generate(example.params, {});
      if (!result.ok) throw new Error(`${template.id} did not generate`);
      const keys = missingKeys(result.output);
      expect(keys.size).toBeGreaterThan(0);
      for (const key of keys) expect(inputFieldId(template.form, key), key).toBeDefined();
    }
  });

  it('finds a parameter a check names as missing, such as the hanger mounting', () => {
    expect(inputFieldId(form('swing-set-a-frame'), 'hardware.hangerMounting')).toBe(
      'p-hardware.hangerMounting.kind',
    );
  });

  it('finds a parameter a check needs, such as the ground anchor rating', () => {
    expect(inputFieldId(form('swing-set-a-frame'), 'hardware.anchorRating')).toBe(
      'p-hardware.anchorRating',
    );
    expect(inputFieldId(form('swing-set-a-frame'), 'hardware.anchorsPerFoot')).toBe(
      'p-hardware.anchorsPerFoot',
    );
  });

  it('gives nothing for a key the form does not have', () => {
    expect(inputFieldId(form('swing-set-a-frame'), 'elsewhere')).toBeUndefined();
  });

  it('marks parameters p- and structural inputs s-', () => {
    expect(fieldId('params', 'beamLength')).toBe('p-beamLength');
    expect(fieldId('structuralInputs', 'species')).toBe('s-species');
  });
});
