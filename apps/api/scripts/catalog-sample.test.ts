import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogSample, catalogSampleFile } from './catalog-sample.ts';

describe('catalog sample', () => {
  it('matches what core generates today (pnpm --filter @kerf/api write-catalog-sample)', () => {
    const committed = JSON.parse(readFileSync(catalogSampleFile, 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(catalogSample())));
  });
});
