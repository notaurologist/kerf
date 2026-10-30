import { describe, expect, it } from 'vitest';
import { createSnapshot } from '../../snapshot/index.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// The plan's key results (#119) for the worked example in docs/templates/swing-set-a-frame.md:
// beam 120" of 4x6; back leg 131-1/2" and front leg 138-3/8" (Worked example, leg lengths); legs
// splayed 20°, so the level cuts are a 20.0° saw setting, 90° − 20° = 70.0° to the edge.

function planFor(index: number) {
  const example = EXAMPLES[index];
  const made = createSnapshot(swingSetAFrame, example?.params, example?.structuralInputs);
  if (!made.ok) throw new Error('The worked example does not generate.');
  return swingSetAFrame.plan(swingSetAFrame.outputs.parse(made.output.outputs));
}

describe('key results', () => {
  it('give the beam, each leg, and the legs’ saw setting, in that order', () => {
    expect(planFor(0).keyResults).toEqual([
      { label: 'Beam', value: '120", 4x6' },
      { label: 'Back leg (uphill)', value: '131-1/2"' },
      { label: 'Front leg (downhill)', value: '138-3/8"' },
      { label: 'Leg end cuts', value: 'Saw at 20.0°, 70.0° to the edge' },
    ]);
  });

  it('say how many plies a built-up beam has, and name level-ground legs without a slope', () => {
    // The third example: two plies of 2x6, 120" long, on level ground.
    const [beam, back, front] = planFor(2).keyResults;
    expect(beam).toEqual({ label: 'Beam', value: '120", 2 plies of 2x6' });
    expect([back?.label, front?.label]).toEqual(['Back leg', 'Front leg']);
    expect(back?.value).toBe(front?.value);
  });
});
