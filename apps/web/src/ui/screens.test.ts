import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Screens are built only from ui/: its components and layout primitives (#45, Stage 6, DS1).
// A class or a style written in a screen is a one-off style the system does not know about, so
// it fails here. Tests are exempt: they read the markup the components produce.

const src = new URL('..', import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'ui' ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const screens = files(src);

describe('screens outside ui/', () => {
  it('exist', () => {
    expect(screens.length).toBeGreaterThan(10);
  });

  it.each(screens.map((f) => relative(src, f)))('%s writes no classes or styles', (file) => {
    const text = readFileSync(join(src, file), 'utf8');
    expect(text).not.toMatch(/\bclassName\s*=/);
    expect(text).not.toMatch(/\bstyle\s*=\s*\{/);
  });

  it('import no stylesheets of their own', () => {
    const imports = screens.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/import\s+['"]([^'"]+\.css)['"]/g)].map((m) => [
        relative(src, f),
        m[1],
      ]),
    );
    expect(imports).toEqual([['main.tsx', './ui/styles/index.css']]);
  });
});
