import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import {
  changesFromBase,
  fixtureFolder,
  hashOf,
  readHashes,
  shownFolder,
} from './snapshot-fixtures.ts';

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

describe('fixture hashes compared with the base branch', () => {
  const base = { t: { 'v1.json': 'a', 'v2.json': 'b', 'shown/v2.json': 'c' } };

  it('accepts the same hashes', () => {
    expect(changesFromBase(base, structuredClone(base))).toEqual([]);
  });

  it("accepts a new version's fixture that replaces what plans show", () => {
    const current = { t: { 'v1.json': 'a', 'v2.json': 'b', 'v3.json': 'd', 'shown/v3.json': 'e' } };
    expect(changesFromBase(base, current)).toEqual([]);
  });

  it('accepts a new template', () => {
    expect(changesFromBase(base, { ...base, u: { 'v1.json': 'f' } })).toEqual([]);
  });

  it("reports an old version's fixture edited together with its hash", () => {
    const current = { t: { ...base.t, 'v1.json': 'x' } };
    expect(changesFromBase(base, current)).toEqual(['t v1.json changed']);
  });

  it('reports the current fixture removed and written again', () => {
    const current = { t: { 'v1.json': 'a', 'v2.json': 'x', 'shown/v2.json': 'y' } };
    expect(changesFromBase(base, current)).toEqual([
      't v2.json changed',
      "t shown/v2.json changed without a new version's fixture",
    ]);
  });

  it('reports a removed fixture and a removed template', () => {
    expect(changesFromBase(base, { t: { 'v2.json': 'b', 'shown/v2.json': 'c' } })).toEqual([
      't v1.json was removed',
    ]);
    expect(changesFromBase(base, {})).toEqual([
      't v1.json was removed',
      't v2.json was removed',
      "t shown/v2.json changed without a new version's fixture",
    ]);
  });
});
