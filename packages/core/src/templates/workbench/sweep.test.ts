import { describe, expect, it } from 'vitest';
import { digestChanges, type SweepDigest, sweep, sweepDigest } from '../sweep.ts';
import { workbench } from './definition.ts';
import { SWEEP } from './sweep.ts';

const DIGESTS = import.meta.glob<SweepDigest>('./sweeps/v*.json', {
  eager: true,
  import: 'default',
});

describe('the workbench across its parameter ranges', () => {
  const swept = sweep(workbench as never, SWEEP);

  it('makes enough plans for the sweep to mean something', () => {
    expect(swept.accepted).toBeGreaterThan(600);
    expect(swept.made).toBeGreaterThan(100);
  });

  it('never throws, and every plan goes together, reads back, and shows', () => {
    expect(swept.failures).toEqual([]);
  });

  it('generates what its digest records for this template version', () => {
    const recorded = DIGESTS[`./sweeps/v${workbench.version}.json`];
    expect(
      digestChanges(recorded, sweepDigest(workbench as never, SWEEP, swept)).slice(0, 10),
      'A sweep draw generates different output at the same template version. Bump the ' +
        "template's version (decision 0008), then write the new fixture: pnpm --filter @kerf/api " +
        `write-snapshot-fixture ${workbench.id} (decision 0014).`,
    ).toEqual([]);
  });
});
