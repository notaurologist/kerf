import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';

/**
 * The content of each fixture before a template's current version. A fixture stands for projects
 * already stored, so a change to one is a change to what the tests promise to read. When the
 * template version is bumped, pin the fixture that was current.
 */
const PINNED: Record<string, Record<string, string>> = {
  'swing-set-a-frame': {
    'v1.json': '91977d42edb13308679aac360bd8f293603d4ab451a7a44fa20d8ddf49a9fd25',
    'v2.json': 'c7f998cbe101d346e60f9bdff81596882782b0a94e0cbb9d0abcc2af1c40538f',
    'v3.json': '8c4be90c18126a349dda97038164fbd4f62d274419f64d7dc00c072dc2d7c70c',
    'v4.json': '2be8e69b486871e7ac4c8ab7c505dd2e973acc2ccd3548943950f128f80783a8',
    'v5.json': 'eea3488985bf829a9d5d491f6b504271de81becf1c819ebc0fa5fbada2554f07',
    'v6.json': 'b1a807a67c434c56f6e3b8db099029c6017edbf2f3b45faf8a3d0f3ba591634d',
    'v7.json': '48fbe92322f5fe9ced74f63d352a2fe2d7bd426572c5627c6223942ed6edc6ba',
    'v8.json': '85d2e0a84670fdca706a773923e61a6c3baecb7772bb93a3042f88a77a5d6cb8',
    'v9.json': '298364799548aac8fb74c19a1f5f64592d68b63487c38ab922d79e3bb9bec1b2',
    'v10.json': '407189779b861284e1a872110b3602d1c6dcdf320d8357340b90fd4a3a02902e',
    'v11.json': '1217ee4cdc6df87857d0c755b0d74fae86ddd3b2deb3710f834982f8ef1b51b3',
  },
};

const templatesFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  ...['..', '..', '..', 'packages', 'core', 'src', 'templates'],
);

describe('snapshot fixtures', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    'keeps every %s fixture before the current version exactly as committed',
    (id, template) => {
      const folder = join(templatesFolder, id, 'snapshots');
      const current = `v${template.version}.json`;
      const older = readdirSync(folder).filter((f) => f.endsWith('.json') && f !== current);
      const hashes = Object.fromEntries(
        older.map((file) => {
          const content = JSON.parse(readFileSync(join(folder, file), 'utf8'));
          return [file, createHash('sha256').update(JSON.stringify(content)).digest('hex')];
        }),
      );
      expect(hashes).toEqual(PINNED[id] ?? {});
    },
  );
});
