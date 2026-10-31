import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';

// Generic code stays generic (AGENTS.md, hard rule 7; ARCHITECTURE.md, principle 6): only a
// template's own folder knows what it builds. This reads every source file outside those folders
// (core, the API and its scripts, and the web app) and fails on a template's ID or its own words
// (`TemplateDefinition.ownWords`). Tests and test helpers are exempt: they exercise the worked
// examples. So is the template registry, which lists the templates. "Beam", "ply", and "gusset"
// are generic structural members, and "frame" names DiagramFrame, so no template claims them.

const root = new URL('../../..', import.meta.url).pathname;

const forbidden = TEMPLATES.flatMap((t) => [
  t.id,
  t.id.replace(/-./g, (m) => (m[1] ?? '').toUpperCase()),
  ...t.ownWords,
]);

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

const registry = [join('packages', 'core', 'src', 'templates', 'index.ts')];
const sources = ['packages/core/src', 'apps/api/src', 'apps/api/scripts', 'apps/web/src']
  .flatMap((d) => files(join(root, d)))
  .map((f) => relative(root, f))
  .filter((f) => !registry.includes(f));

describe('generic code', () => {
  it('covers core, the API and its scripts, and the web app', () => {
    expect(sources.length).toBeGreaterThan(60);
    expect(sources).toContain(join('apps', 'api', 'scripts', 'check-deploy.ts'));
    expect(sources).toContain(join('packages', 'core', 'src', 'index.ts'));
    expect(sources.some((f) => f.includes('templates/swing-set-a-frame/'))).toBe(false);
  });

  it("forbids every template's ID and own words", () => {
    for (const t of TEMPLATES) {
      expect(t.ownWords.length).toBeGreaterThan(0);
      expect(forbidden).toEqual(expect.arrayContaining([t.id, ...t.ownWords]));
    }
  });

  it.each(sources)('%s names no template and none of its parts', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const found = forbidden.filter((word) =>
      new RegExp(`(^|[^a-z])${word.replace(/-/g, '\\-')}($|[^a-z])`, 'i').test(text),
    );
    expect(found, file).toEqual([]);
  });
});
