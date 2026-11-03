import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { fixtureFolder, hashOf, readHashes, shownFolder } from './snapshot-fixtures.ts';

describe('snapshot fixtures', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    'keeps every %s fixture exactly as written, the current version included',
    (id, template) => {
      // A fixture stands for projects already stored, so a change to one is a change to what the
      // tests promise to read. Only write-snapshot-fixture records a hash, once per version.
      const files = (folder: string, prefix: string) =>
        readdirSync(folder)
          .filter((f) => f.endsWith('.json'))
          .map((f) => [`${prefix}${f}`, hashOf(join(folder, f))]);
      const hashes = Object.fromEntries([
        ...files(fixtureFolder(id), ''),
        ...files(shownFolder(id), 'shown/'),
      ]);
      expect(
        hashes,
        'A fixture changed, or one was written without write-snapshot-fixture. Bump the ' +
          `template's version and run pnpm --filter @kerf/api write-snapshot-fixture ${id} ` +
          '(decision 0014).',
      ).toEqual(readHashes()[id]);
      expect(Object.keys(hashes)).toContain(`v${template.version}.json`);
      expect(Object.keys(hashes)).toContain(`shown/v${template.version}.json`);
    },
  );
});
