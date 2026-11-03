// @vitest-environment happy-dom
import { findTemplate, type TemplateDefinition } from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldId } from '../../lib/fieldIds.ts';
import { mount } from '../../test/dom.tsx';
import { ProjectEditor } from './ProjectEditor.tsx';
import { startValues } from './start.ts';

// Ticking "The copied values are right" confirms the copied values shown then (#98, hard rule 3).
// A copied value a later answer reveals has not been seen, so it still asks to be confirmed.

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;

afterEach(() => {
  vi.unstubAllGlobals();
});

async function choose(id: string, value: string) {
  const select = document.getElementById(id) as HTMLSelectElement;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function tick(id: string) {
  await act(async () => {
    (document.getElementById(id) as HTMLInputElement).click();
  });
}

/** Whether the field at `path` is marked "Copied, confirm". */
const tagged = (container: HTMLElement, path: string) => {
  const control = document.getElementById(fieldId('params', path));
  const field = [...container.querySelectorAll('.k-field')].find((f) => f.contains(control));
  if (!field) throw new Error(`${path} is not shown`);
  return field.textContent?.includes('Copied, confirm') ?? false;
};

describe('confirming copied values', () => {
  it('asks again for a copied value revealed after the tick', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }));
    const example = startValues(template, { kind: 'example', index: 0 }, null);
    if (!example.ok) throw new Error(example.message);
    const params = {
      ...example.initial.params,
      beamPlies: '1',
      'hardware.legBoltDiameter': '0.5',
      'hardware.plyBolts.diameter': '0.5',
      'hardware.plyBolts.count': '6',
    };
    const copied = { from: 'First swing set', params, inputs: {} };
    const { container } = mount(
      <ProjectEditor
        template={template}
        initial={{ ...example.initial, params, inputs: {} }}
        copied={copied}
      />,
    );
    expect(tagged(container, 'hardware.legBoltDiameter')).toBe(true);
    await tick('confirm-copied');
    expect(tagged(container, 'hardware.legBoltDiameter')).toBe(false);
    expect((document.getElementById('confirm-copied') as HTMLInputElement).checked).toBe(true);

    await choose(fieldId('params', 'beamPlies'), '2');
    expect(tagged(container, 'hardware.plyBolts.diameter')).toBe(true);
    expect(tagged(container, 'hardware.plyBolts.count')).toBe(true);
    expect(tagged(container, 'hardware.legBoltDiameter')).toBe(false);
    expect((document.getElementById('confirm-copied') as HTMLInputElement).checked).toBe(false);

    await tick('confirm-copied');
    expect(tagged(container, 'hardware.plyBolts.diameter')).toBe(false);
    expect((document.getElementById('confirm-copied') as HTMLInputElement).checked).toBe(true);
  });
});
