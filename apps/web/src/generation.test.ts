import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Numbers in core, shown from the API (AGENTS.md, hard rule 6; ARCHITECTURE.md): the web app
// shows the snapshot and drawings the API sends and never generates them itself. This fails when a
// source file outside tests calls a template's generation methods, or any core function that
// reaches them. Those functions are found by reading core, so a new one is covered without a list
// to keep. The bundle still carries the generation code, because the template definitions hold it;
// the owner chose this test over splitting core's exports, since that code is a small share of the
// main chunk.

const root = new URL('../../..', import.meta.url).pathname;

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' || name === 'test' ? [] : files(path, pattern);
    }
    return pattern.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const METHODS = /\.(generate|drawings|assembly|steps)\(/;

/** Each top-level function in core, with the text of its declaration. */
const declarations = files(join(root, 'packages/core/src'), /\.ts$/).flatMap((file) =>
  readFileSync(file, 'utf8')
    .split(/\n(?=(?:export )?(?:async )?(?:function|const) )/)
    .flatMap((text) => {
      const name = /^(?:export )?(?:async )?(?:function|const) (\w+)/.exec(text)?.[1];
      return name ? [{ name, text }] : [];
    }),
);

const calls = (text: string, names: ReadonlySet<string>) =>
  [...names].some((n) => new RegExp(`\\b${n}\\(`).test(text));

/** Core functions that call a generation method, directly or through another such function. */
function generating(): Set<string> {
  const found = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const { name, text } of declarations) {
      if (found.has(name)) continue;
      if (METHODS.test(text) || calls(text, found)) {
        found.add(name);
        grew = true;
      }
    }
  }
  return found;
}

const forbidden = generating();
const sources = files(join(root, 'apps/web/src'), /\.tsx?$/).map((f) => relative(root, f));

describe('generation in the web app', () => {
  it("finds core's generating functions", () => {
    expect([...forbidden]).toEqual(
      expect.arrayContaining([
        'createSnapshot',
        'projectDrawings',
        'stepDrawings',
        'planSteps',
        'progressItems',
        'progressSummary',
      ]),
    );
    expect(forbidden.has('formatLength')).toBe(false);
    expect(sources.length).toBeGreaterThan(40);
  });

  it.each(sources)('%s generates nothing', (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const found = [
      ...(METHODS.exec(text)?.slice(0, 1) ?? []),
      ...[...forbidden].filter((n) => new RegExp(`\\b${n}\\b`).test(text)),
    ];
    expect(found, file).toEqual([]);
  });
});
