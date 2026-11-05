import { readFileSync } from 'node:fs';
import { diff } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { catalogSample, catalogSampleFile } from './catalog-sample.ts';

describe('catalog sample', () => {
  it('matches what core generates today (pnpm --filter @kerf/api write-catalog-sample)', () => {
    const committed = JSON.parse(readFileSync(catalogSampleFile, 'utf8'));
    // Numbers within sameNumber: the sample is generated on whichever machine runs the script.
    expect(diff(committed, JSON.parse(JSON.stringify(catalogSample())), 20).changes).toEqual([]);
  });
});
