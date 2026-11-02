import { describe, expect, it } from 'vitest';
import { swingSetAFrame } from './definition.ts';

describe('cut-list saw settings, worked example (#360)', () => {
  it('cuts the beam square and the legs at the 20° splay', () => {
    const definition = swingSetAFrame;
    const example = definition.examples[0];
    if (!example) throw new Error('no worked example');
    const made = definition.generate(example.params, example.structuralInputs);
    if (!made.ok) throw new Error('worked example does not generate');
    const settings = (id: string) =>
      definition.plan(made.output).cutList.find((r) => r.partId === id)?.settings;
    expect(settings('beam')).toEqual(['0.0°', '0.0°']);
    expect(settings('leg-back')).toEqual(['20.0°', '20.0°']);
    expect(settings('leg-front')).toEqual(['20.0°', '20.0°']);
  });
});
