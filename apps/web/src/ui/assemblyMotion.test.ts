import { describe, expect, it } from 'vitest';
import { placeInMove } from './assemblyMotion.ts';

describe('placeInMove', () => {
  it('starts with every part home and ends with every stage done', () => {
    expect(placeInMove(0, 2)).toEqual({ stage: 0, t: 0 });
    expect(placeInMove(2, 2)).toEqual({ stage: 1, t: 1 });
  });

  it('eases one stage in and out like before', () => {
    // ease(0.25) = 2 · 0.25² = 0.125.
    expect(placeInMove(0.25, 1)).toEqual({ stage: 0, t: 0.125 });
    expect(placeInMove(0.5, 1)).toEqual({ stage: 0, t: 0.5 });
  });

  it('runs on from one stage into the next without stopping', () => {
    // Halfway through two stages is the hand-off, moving at full speed: just before it the first
    // stage is almost done, just after it the second has started.
    expect(placeInMove(1, 2)).toEqual({ stage: 1, t: 0 });
    const before = placeInMove(0.99, 2);
    const after = placeInMove(1.01, 2);
    expect(before.stage).toBe(0);
    expect(after.stage).toBe(1);
    // Speed at the hand-off is twice the average, so each side moves about 0.02 of a stage.
    expect(1 - before.t).toBeCloseTo(0.02, 3);
    expect(after.t).toBeCloseTo(0.02, 3);
  });

  it('settles gently at the end of the last stage', () => {
    // ease(0.75) = 1 − 2 · 0.25² = 0.875, so 1.75 of 2 stages.
    expect(placeInMove(1.5, 2)).toEqual({ stage: 1, t: 0.75 });
  });
});
