import { describe, expect, it } from 'vitest';
import { digestChanges, type SweepDigest, sweep, sweepDigest } from '../sweep.ts';
import { swingSetAFrame } from './definition.ts';
import { SWEEP } from './sweep.ts';

const DIGESTS = import.meta.glob<SweepDigest>('./sweeps/v*.json', {
  eager: true,
  import: 'default',
});

describe('the swing set across its ranges', () => {
  const swept = sweep(swingSetAFrame as never, SWEEP);

  it('makes enough plans for the sweep to mean something', () => {
    expect(swept.accepted).toBeGreaterThan(300);
    expect(swept.made).toBeGreaterThan(150);
  });

  it('never throws, and every plan goes together, reads back, and shows', () => {
    expect(swept.failures).toEqual([]);
  });

  it('generates what its digest records for this template version', () => {
    const recorded = DIGESTS[`./sweeps/v${swingSetAFrame.version}.json`];
    expect(
      digestChanges(recorded, sweepDigest(swingSetAFrame as never, SWEEP, swept)).slice(0, 10),
      'A sweep draw generates different output at the same template version. Bump the ' +
        "template's version (decision 0008), then write the new fixture: pnpm --filter @kerf/api " +
        `write-snapshot-fixture ${swingSetAFrame.id} (decision 0014).`,
    ).toEqual([]);
  });
});
