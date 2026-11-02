import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates/index.ts';
import { unletteredView } from './drawings.ts';

// The template picker's drawing (#357): the template's own assembled view with the part letters
// and their leaders left out, and nothing else changed.

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('unletteredView: %s', (_, template) => {
  const example = template.examples[0];
  if (!example) throw new Error('no worked example');
  const made = template.generate(example.params, example.structuralInputs);
  if (!made.ok) throw new Error('worked example does not generate');
  const own = template.drawings(made.output).isometric;
  const view = unletteredView(template, made.output);

  it('draws every part as the assembled view does, with no letters', () => {
    if (!own || !view) throw new Error('no assembled view');
    expect(own.primitives.some((p) => p.kind === 'letter')).toBe(true);
    expect(view.primitives.some((p) => p.kind === 'letter')).toBe(false);
    expect(view.primitives).toEqual(own.primitives.filter((p) => p.kind !== 'letter'));
    expect(view.title).toBe(own.title);
    expect(view.description).toBe(own.description);
  });

  it('fits its bounds to the parts alone', () => {
    if (!own || !view) throw new Error('no assembled view');
    expect(view.bounds.width).toBeLessThanOrEqual(own.bounds.width);
  });
});
