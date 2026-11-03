import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';

// Generic code stays generic (AGENTS.md, hard rule 7; ARCHITECTURE.md, principle 6): only a
// template's own folder knows what it builds. This reads every source file outside those folders
// (core, the API and its scripts, and the web app) and fails on a template's ID or its own words
// (`TemplateDefinition.ownWords`). Tests and test helpers are exempt: they exercise the worked
// examples. So is the template registry, which lists the templates. "Beam", "ply", "leg", and
// "gusset" are generic structural members, and "frame" names DiagramFrame, so no template claims
// them. One template's own words may not appear in another template's folder either.
//
// Text is split into words before matching, so `crossbarSpan`, `SwingSetParams`, and
// `swing_angle` each name a template. A word with a hyphen, such as "a-frame", matches as that
// run of words inside one identifier or hyphenated word: `aFrame` or "a-frame", not "a frame".

const root = new URL('../../..', import.meta.url).pathname;
const templatesDir = join(root, 'packages', 'core', 'src', 'templates');

/** Splits text into lowercase words, one list per identifier or hyphenated word. */
function words(text: string): string[][] {
  return (text.match(/[A-Za-z0-9_-]+/g) ?? []).map((token) =>
    token
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w !== ''),
  );
}

/** Which of `terms` (lowercase, hyphenated for several words) the text uses. */
function termsIn(text: string, terms: readonly string[]): string[] {
  const tokens = words(text);
  return terms.filter((term) => {
    const run = term.split('-');
    return tokens.some((token) => token.some((_, i) => run.every((w, j) => token[i + j] === w)));
  });
}

function files(dir: string, { skipTemplates }: { skipTemplates: boolean }): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'node_modules' || name === 'test' || name === 'fonts') return [];
      // A template's own folder: packages/core/src/templates/<template-id>/.
      if (skipTemplates && TEMPLATES.some((t) => t.id === name) && dir === templatesDir) return [];
      return files(path, { skipTemplates });
    }
    if (!/\.(tsx?|css)$/.test(name)) return [];
    if (skipTemplates && /\.test\.tsx?$/.test(name)) return [];
    return [path];
  });
}

const forbidden = TEMPLATES.flatMap((t) => [t.id, ...t.ownWords]);

const registry = join('packages', 'core', 'src', 'templates', 'index.ts');
const sources = ['packages/core/src', 'apps/api/src', 'apps/api/scripts', 'apps/web/src']
  .flatMap((d) => files(join(root, d), { skipTemplates: true }))
  .map((f) => relative(root, f))
  .filter((f) => f !== registry);

// Words another template's folder uses in their ordinary sense, by file. Each needs a reason.
const shared: Record<string, readonly string[]> = {
  // The cabinet's step text: "lift it up into the top track, swing its bottom in".
  'packages/core/src/templates/record-cabinet/template.ts': ['swing'],
};

const foreign = TEMPLATES.flatMap((t) =>
  files(join(templatesDir, t.id), { skipTemplates: false }).map((f) => ({
    file: relative(root, f),
    others: TEMPLATES.filter((o) => o !== t).flatMap((o) => [o.id, ...o.ownWords]),
  })),
);

describe('words', () => {
  it('splits camelCase, PascalCase, snake_case, and kebab-case', () => {
    expect(words('crossbarSpan SwingSetParams swing_angle a-frame')).toEqual([
      ['crossbar', 'span'],
      ['swing', 'set', 'params'],
      ['swing', 'angle'],
      ['a', 'frame'],
    ]);
    expect(words('CPSCGuidance swingSetAFrame')).toEqual([
      ['cpsc', 'guidance'],
      ['swing', 'set', 'a', 'frame'],
    ]);
  });

  it('matches whole words and runs inside one identifier', () => {
    expect(termsIn('const crossbarSpan = 1;', ['crossbar'])).toEqual(['crossbar']);
    expect(termsIn('legSpread', ['leg', 'legs'])).toEqual(['leg']);
    expect(termsIn('partitionCount', ['partition'])).toEqual(['partition']);
    expect(termsIn('swingSetAFrame', ['swing-set-a-frame', 'a-frame'])).toEqual([
      'swing-set-a-frame',
      'a-frame',
    ]);
    expect(termsIn('a frame of reference', ['a-frame'])).toEqual([]);
    expect(termsIn('swinging hangers', ['swing', 'hanger'])).toEqual([]);
    expect(termsIn('DiagramFrame', ['a-frame'])).toEqual([]);
  });
});

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
    expect(termsIn(readFileSync(join(root, file), 'utf8'), forbidden), file).toEqual([]);
  });
});

describe("a template's folder", () => {
  it('covers every template, tests included', () => {
    for (const t of TEMPLATES) {
      expect(foreign.some(({ file }) => file.includes(`templates/${t.id}/`))).toBe(true);
    }
    expect(foreign.some(({ file }) => file.endsWith('.test.ts'))).toBe(true);
  });

  it.each(foreign)("$file uses no other template's ID or own words", ({ file, others }) => {
    const found = termsIn(readFileSync(join(root, file), 'utf8'), others);
    expect(found, file).toEqual(shared[file] ?? []);
  });
});
