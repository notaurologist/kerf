import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The design system imports nothing from the app: lib/ and the screens build on ui/, never the
// other way round. State a component needs, such as whether a move is playing (motion.ts), lives
// here and the app reports to it. Tests are exempt: a component's DOM test may drive it through
// the app's routing.

const ui = new URL('.', import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every module a file imports or re-exports, by the path it is written with. */
const importsOf = (text: string) =>
  [
    ...text.matchAll(
      /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g,
    ),
  ].map((m) => m[1] ?? m[2] ?? '');

describe('ui/', () => {
  const sources = files(ui);

  it('has its components to check', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it.each(sources.map((f) => relative(ui, f)))('%s imports only from ui/ and packages', (file) => {
    const outside = importsOf(readFileSync(join(ui, file), 'utf8')).filter(
      (path) => path.startsWith('.') && !join(ui, file, '..', path).startsWith(ui),
    );
    expect(outside).toEqual([]);
  });
});
