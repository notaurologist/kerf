import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSnapshot, shownOnRead, type TemplateDefinition } from '@kerf/core';

const here = dirname(fileURLToPath(import.meta.url));

const templateFolder = (id: string) =>
  join(here, ...['..', '..', '..', 'packages', 'core', 'src', 'templates', id]);

/** A template's committed fixtures (decision 0014). */
export const fixtureFolder = (id: string) => join(templateFolder(id), 'snapshots');

/** What the current version's worked examples show on read, kept beside the fixtures. */
export const shownFolder = (id: string) => join(templateFolder(id), 'shown');

/** What the current version's seeded sweep generates, kept beside the fixtures. */
export const sweepsFolder = (id: string) => join(templateFolder(id), 'sweeps');

/** Hash entries for files kept for the current version only, replaced with each new version. */
export const CURRENT_ONLY = ['shown/', 'sweeps/'] as const;
const currentOnly = (file: string) => CURRENT_ONLY.some((folder) => file.startsWith(folder));

/**
 * The hash of every committed fixture file, by template ID and path: each version's snapshots,
 * `v<n>.json`, what the current version's plans show on read, `shown/v<n>.json`, and what its
 * sweep generates, `sweeps/v<n>.json`. Written by write-snapshot-fixture and never changed for a
 * version already written.
 */
export const hashesFile = join(here, 'snapshot-fixture-hashes.json');

type Hashes = Record<string, Record<string, string>>;

export const readHashes = (): Hashes => JSON.parse(readFileSync(hashesFile, 'utf8'));

/**
 * How `current` breaks the rule that fixture hashes are only added, compared with the base
 * branch's: every `v<n>.json` entry the base has must be kept unchanged. A `shown/` or `sweeps/`
 * entry is replaced on purpose, but only by write-snapshot-fixture, which adds a new version's
 * fixture at the same time. One line per problem; empty when there are none.
 */
export function changesFromBase(base: Hashes, current: Hashes): string[] {
  const problems: string[] = [];
  for (const [id, entries] of Object.entries(base)) {
    const now = current[id] ?? {};
    const addsVersion = Object.keys(now).some((f) => !currentOnly(f) && !(f in entries));
    for (const [file, hash] of Object.entries(entries)) {
      if (now[file] === hash) continue;
      if (currentOnly(file)) {
        if (!addsVersion) problems.push(`${id} ${file} changed without a new version's fixture`);
      } else {
        problems.push(`${id} ${file} ${file in now ? 'changed' : 'was removed'}`);
      }
    }
  }
  return problems;
}

/** sha256 of the file's JSON as `JSON.stringify` writes it, so formatting does not count. */
export const hashOf = (file: string) =>
  createHash('sha256')
    .update(JSON.stringify(JSON.parse(readFileSync(file, 'utf8'))))
    .digest('hex');

/** What each stored snapshot in a fixture shows when it is read, in fixture order. */
export function shownFor(template: TemplateDefinition, fixture: readonly unknown[]) {
  return fixture.map((stored) => {
    const read = readSnapshot([template], stored);
    if (!read.ok) throw new Error(read.message);
    return shownOnRead(template, template.storedOutputs.parse(read.snapshot.outputs));
  });
}
