import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';

// In core, the generic contract lives in model/ and each template in templates/<template-id>/
// (ARCHITECTURE.md, principle 6). Only the registry, templates/index.ts, reaches into a template's
// folder, and only the package entry reaches the registry, so generic code finds a template
// through TEMPLATES and never by its path. Tests are exempt: they exercise the worked examples.

const src = new URL('../../../packages/core/src', import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** Every relative module a file imports or re-exports, resolved to a path under src/. */
function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)].map((m) =>
    relative(src, resolve(dirname(file), m[1] ?? '')),
  );
}

const templateFolder = (path: string) => {
  const [top, id, ...rest] = path.split(sep);
  return top === 'templates' && rest.length > 0 ? id : undefined;
};

/** The imports a file may not make, from those it makes. */
function forbiddenImports(file: string, imported: readonly string[]): string[] {
  const from = relative(src, file);
  const own = templateFolder(from);
  return imported.filter((path) => {
    const into = templateFolder(path);
    if (into !== undefined) return into !== own && from !== join('templates', 'index.ts');
    const inTemplates = path.split(sep)[0] === 'templates';
    return inTemplates && from.split(sep)[0] !== 'templates' && from !== 'index.ts';
  });
}

const files = sources(src);

describe('template folders', () => {
  it('lists every template folder in the registry', () => {
    const folders = readdirSync(join(src, 'templates'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(folders.sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  it('finds the imports it checks', () => {
    const registry = join(src, 'templates', 'index.ts');
    expect(imports(registry)).toContain(join('templates', 'swing-set-a-frame', 'definition.ts'));
    expect(files.length).toBeGreaterThan(60);
  });

  it("lets only the registry import from a template's folder", () => {
    const at = (path: string) => join(src, ...path.split('/'));
    expect(forbiddenImports(at('templates/index.ts'), ['templates/a/definition.ts'])).toEqual([]);
    expect(forbiddenImports(at('templates/a/x.ts'), ['templates/a/y.ts'])).toEqual([]);
    expect(forbiddenImports(at('index.ts'), ['templates/index.ts'])).toEqual([]);
    expect(forbiddenImports(at('index.ts'), ['templates/a/index.ts'])).toEqual([
      'templates/a/index.ts',
    ]);
    expect(forbiddenImports(at('templates/b/x.ts'), ['templates/a/y.ts'])).toEqual([
      'templates/a/y.ts',
    ]);
    expect(forbiddenImports(at('snapshot/x.ts'), ['templates/index.ts'])).toEqual([
      'templates/index.ts',
    ]);
  });

  it.each(files.map((f) => relative(src, f)))('%s imports templates only as allowed', (file) => {
    expect(forbiddenImports(join(src, file), imports(join(src, file)))).toEqual([]);
  });
});
