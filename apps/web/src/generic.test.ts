import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';

// Generic code stays generic (AGENTS.md, hard rule 7; ARCHITECTURE.md, principle 6): only a
// template's own folder knows what it builds. This reads every source file outside those folders
// (core, the API, and the web app) and fails on a template's ID or the words only the swing set's
// folder should use. Tests and test helpers are exempt: they exercise the worked examples. So is
// the template registry, which lists the templates. "Beam", "ply", and "gusset" are generic
// structural members, and "frame" names DiagramFrame, so they are allowed.

const root = new URL('../../..', import.meta.url).pathname;

/** Words only the swing set's folder uses. Add a template's own words when it is added. */
const SWING_SET_WORDS = ['swing', 'crossbar', 'hanger', 'leg', 'legs', 'a-frame', 'cpsc'];

const forbidden = [
  ...TEMPLATES.map((t) => t.id),
  ...TEMPLATES.map((t) => t.id.replace(/-./g, (m) => (m[1] ?? '').toUpperCase())),
  ...SWING_SET_WORDS,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'node_modules' || name === 'test' || name === 'fonts') return [];
      // A template's own folder: packages/core/src/templates/<template-id>/.
      if (TEMPLATES.some((t) => t.id === name) && dir.endsWith(join('src', 'templates'))) return [];
      return files(path);
    }
    if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [path];
  });
}

const registry = [
  join('packages', 'core', 'src', 'templates', 'index.ts'),
  join('packages', 'core', 'src', 'index.ts'),
];
const sources = ['packages/core/src', 'apps/api/src', 'apps/web/src']
  .flatMap((d) => files(join(root, d)))
  .map((f) => relative(root, f))
  .filter((f) => !registry.includes(f));

describe('generic code', () => {
  it('covers core, the API, and the web app', () => {
    expect(sources.length).toBeGreaterThan(60);
    expect(sources.some((f) => f.includes('templates/swing-set-a-frame/'))).toBe(false);
  });

  it.each(sources)('%s names no template and none of its parts', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const found = forbidden.filter((word) =>
      new RegExp(`(^|[^a-z])${word.replace(/-/g, '\\-')}($|[^a-z])`, 'i').test(text),
    );
    expect(found, file).toEqual([]);
  });
});
