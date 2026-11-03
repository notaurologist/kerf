// @vitest-environment happy-dom
import type { FormField } from '@kerf/core';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom.tsx';
import { FieldInput } from './FieldInput.tsx';

// While a form saves, its fields keep their values: a change made then would be dropped when the
// save lands, so menus ignore it as text inputs do.

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const fields: FormField[] = [
  {
    path: 'species',
    label: 'Species',
    kind: 'choice',
    options: [
      { value: 'spf', label: 'Spruce-pine-fir' },
      { value: 'syp', label: 'Southern yellow pine' },
    ],
  },
  { path: 'treated', label: 'Treated', kind: 'yes-no' },
];

describe('FieldInput while saving', () => {
  for (const field of fields) {
    it(`keeps a ${field.kind} menu's value while read-only`, async () => {
      const onChange = vi.fn();
      const props = { id: 'f', field, text: '', issue: undefined, onChange };
      const { container, rerender } = mount(<FieldInput {...props} readOnly />);
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.getAttribute('aria-readonly')).toBe('true');
      const value = select.options[1]?.value ?? '';
      await choose(select, value);
      expect(onChange).not.toHaveBeenCalled();
      expect(select.value).toBe('');

      rerender(<FieldInput {...props} />);
      expect(select.hasAttribute('aria-readonly')).toBe(false);
      await choose(select, value);
      expect(onChange).toHaveBeenCalledWith(value);
    });
  }
});
