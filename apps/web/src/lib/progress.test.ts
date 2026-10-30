import { describe, expect, it } from 'vitest';
import { describeReset } from './progress.ts';

const reset = (changed: number, removed: number) => [
  ...Array.from({ length: changed }, () => ({ reason: 'changed' as const })),
  ...Array.from({ length: removed }, () => ({ reason: 'removed' as const })),
];

describe('describeReset', () => {
  it('says nothing when no tick was cleared', () => {
    expect(describeReset(undefined)).toBeNull();
    expect(describeReset([])).toBeNull();
  });

  it('says how many were reset and why', () => {
    expect(describeReset(reset(1, 0))).toBe(
      '1 item marked done was reset because its numbers changed.',
    );
    expect(describeReset(reset(3, 0))).toBe(
      '3 items marked done were reset because their numbers changed.',
    );
    expect(describeReset(reset(0, 2))).toBe(
      '2 items marked done were reset because they are no longer in the plan.',
    );
    expect(describeReset(reset(3, 1))).toBe(
      '4 items marked done were reset: 3 have new numbers and 1 is no longer in the plan.',
    );
  });
});
