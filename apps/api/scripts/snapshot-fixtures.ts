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

/**
 * The hash of every committed fixture file, by template ID and path: each version's snapshots,
 * `v<n>.json`, and what the current version's plans show on read, `shown/v<n>.json`. Written by
 * write-snapshot-fixture and never changed for a version already written.
 */
export const hashesFile = join(here, 'snapshot-fixture-hashes.json');

export const readHashes = (): Record<string, Record<string, string>> =>
  JSON.parse(readFileSync(hashesFile, 'utf8'));

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
