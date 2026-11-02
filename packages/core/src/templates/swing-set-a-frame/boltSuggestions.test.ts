import { describe, expect, it } from 'vitest';
import { formValues } from '../../model/form.ts';
import type { Suggestion } from '../../model/questions.ts';
import { shortfalls } from '../../structural/boltDistances.ts';
import { boltSuggestions } from './boltSuggestions.ts';
import { EXAMPLES } from './examples.ts';
import { BOLT_DIAMETERS, SWING_SET_FORM } from './form.ts';
import { generate } from './template.ts';

// Bolt sizes suggested from the bolt layout (#389). Hand check, worked example (4x4 legs, 4x6
// beam): a board's bolts sit on the leg's centerline, 3-1/2 / 2 = 1-3/4" from the edge the load
// pushes toward, which NDS 2024 Table 12.5.1C sets at 4D: 1-1/2" for 3/8" bolts, 2" for 1/2".
// So 3/8" at the crossbars and gussets. The leg-to-beam bolt sits at the beam's mid-depth,
// 5-1/2 / 2 = 2-3/4" from its edges: 4D is 2-1/2" for 5/8", 3" for 3/4". So 5/8" at the beam.

/** An example's parameters as suggestions, without its hardware. */
function framed(index: number): Suggestion[] {
  const example = EXAMPLES[index];
  if (!example) throw new Error(`no example ${index}`);
  const text = formValues(SWING_SET_FORM.params, example.params);
  return Object.entries(text)
    .filter(([path, value]) => !path.startsWith('hardware') && value !== '')
    .map(([path, value]) => ({
      from: 'params',
      path,
      value: Number.isNaN(Number(value)) ? value : Number(value),
      basis: { kind: 'example' },
    }));
}

const suggestedAt = (s: readonly Suggestion[], path: string) =>
  s.find((x) => x.path === path)?.value;

/** Every distance at a joint with every bolt at `diameter`, short of an NDS row or not. */
function shortAt(index: number, diameter: number, title: string): boolean {
  const example = EXAMPLES[index];
  if (!example) throw new Error(`no example ${index}`);
  const made = generate({
    ...example.params,
    hardware: {
      ...example.params.hardware,
      legBoltDiameter: diameter,
      crossbarBolts: { diameter, perJoint: 2 },
      gussetBolts: { diameter, perJoint: 2 },
    },
  });
  if (!made.ok) throw new Error('does not generate');
  const joint = made.output.boltLayout?.find((j) => j.title === title);
  return (joint?.distances ?? []).some((d) => shortfalls(d).length > 0);
}

describe.each([
  [0, 'the worked example, a 4x6 beam on 4x4 legs'],
  [2, 'the two-ply 2x6 beam on pads'],
])('bolt suggestions: %s, %s', (index) => {
  const s = boltSuggestions(framed(index));

  it('suggests 5/8" at the beam and 3/8" at the crossbars and gussets, two per joint', () => {
    expect(suggestedAt(s, 'hardware.legBoltDiameter')).toBe(0.625);
    expect(suggestedAt(s, 'hardware.crossbarBolts.diameter')).toBe(0.375);
    expect(suggestedAt(s, 'hardware.gussetBolts.diameter')).toBe(0.375);
    expect(suggestedAt(s, 'hardware.crossbarBolts.perJoint')).toBe(2);
    expect(suggestedAt(s, 'hardware.gussetBolts.perJoint')).toBe(2);
  });

  it('suggests the largest size the layout check does not reject at each joint', () => {
    for (const [path, title] of [
      ['hardware.legBoltDiameter', 'Leg to beam'],
      ['hardware.crossbarBolts.diameter', 'Crossbar to leg'],
      ['hardware.gussetBolts.diameter', 'Gusset to leg'],
    ] as const) {
      const d = suggestedAt(s, path) as number;
      expect(shortAt(index, d, title), `${title} at ${d}`).toBe(false);
      const larger = BOLT_DIAMETERS.find((x) => x > d);
      if (larger !== undefined)
        expect(shortAt(index, larger, title), `${title} at ${larger}`).toBe(true);
    }
  });

  it('says it is geometry, not capacity, with NDS 2024 as its basis', () => {
    const leg = s.find((x) => x.path === 'hardware.legBoltDiameter');
    expect(leg?.basis).toMatchObject({ kind: 'source', citation: expect.stringContaining('NDS') });
    expect(leg?.note).toContain('Kerf computes no bolt capacity');
  });
});

describe('bolt suggestions with no frame', () => {
  it('leaves every bolt size empty and says why', () => {
    const s = boltSuggestions([]);
    expect(suggestedAt(s, 'hardware.legBoltDiameter')).toBeNull();
    expect(s.find((x) => x.path === 'hardware.legBoltDiameter')?.note).toContain('needs the frame');
  });
});
