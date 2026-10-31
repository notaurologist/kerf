import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Structural checks on the stylesheets: values come from tokens, every class is used, print rules
// sit in one file, and every breakpoint is one of those listed in docs/design/system.md.

const stylesheets = Object.fromEntries(
  readdirSync(new URL('./', import.meta.url))
    .filter((f) => f.endsWith('.css'))
    .map((f) => [f, readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')]),
) as Record<string, string>;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Hex colors, rgb() colors, and px lengths written into a stylesheet rather than taken from a token. */
function literals(source: string, allowed: readonly string[]): string[] {
  const declarations = [...withoutComments(source).matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)];
  return declarations
    .map((d) => `${d[1]}: ${(d[2] ?? '').trim()}`)
    .filter((d) => /#[0-9a-f]{3,8}\b|rgba?\(|\d(\.\d+)?px\b/i.test(d))
    .filter((d) => !allowed.includes(d));
}

describe('components.css', () => {
  // Hiding an element from sight but not from screen readers takes a 1 px box, whatever the
  // tokens; a zero with a unit keeps min() comparing lengths.
  const ALLOWED = [
    'inline-size: 1px',
    'block-size: 1px',
    'inset-block: min(0px, (100% - var(--control-min)) / 2)',
  ];

  it('takes colors and pixel lengths from tokens', () => {
    expect(literals(stylesheets['components.css'] ?? '', ALLOWED)).toEqual([]);
  });

  it('catches a literal color or pixel length', () => {
    const sample = `.a { border: 2px solid var(--border); color: #fff; }
      .b { background: rgb(0 0 0 / 0.4); inline-size: 1px; gap: var(--space-s); }`;
    expect(literals(sample, ALLOWED)).toEqual([
      'border: 2px solid var(--border)',
      'color: #fff',
      'background: rgb(0 0 0 / 0.4)',
    ]);
  });
});

const sources = readdirSync(new URL('../../', import.meta.url), {
  recursive: true,
  encoding: 'utf8',
})
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'));

/** k- and l- classes a stylesheet styles that no source file names. */
function unusedClasses(css: string, files: readonly string[]): string[] {
  const text = files.join('\n');
  const classes = new Set(
    [...withoutComments(css).matchAll(/\.([kl]-[a-z0-9_-]+)/g)].map((m) => m[1] ?? ''),
  );
  return [...classes].filter((c) => !new RegExp(`(^|[^a-z0-9_-])${c}($|[^a-z0-9_-])`).test(text));
}

describe('k- and l- classes', () => {
  it('each appear in a source file', () => {
    expect(unusedClasses(Object.values(stylesheets).join('\n'), sources)).toEqual([]);
  });

  it('are caught when no source file names them', () => {
    const css = '.k-card { padding: 0; } .k-card__title, .l-full { margin: 0; }';
    expect(unusedClasses(css, ['<div className="k-card">'])).toEqual(['k-card__title', 'l-full']);
  });
});

describe('print rules', () => {
  it('are only in print.css', () => {
    const files = Object.entries(stylesheets)
      .filter(([, source]) => /@layer\s+print\s*\{/.test(withoutComments(source)))
      .map(([file]) => file);
    expect(files).toEqual(['print.css']);
  });
});

const system = readFileSync(
  new URL('../../../../../docs/design/system.md', import.meta.url),
  'utf8',
);

/** The breakpoints system.md lists, in rem. */
function listedBreakpoints(doc: string): number[] {
  const section = doc.split(/^## /m).find((s) => s.startsWith('Breakpoints')) ?? '';
  return [...section.matchAll(/^\| `([\d.]+)rem`/gm)].map((m) => Number(m[1]));
}

/** Widths in media and container queries, in rem. */
function queryWidths(css: string): number[] {
  return [...withoutComments(css).matchAll(/@(?:media|container)[^{]*/g)].flatMap((q) =>
    [...(q[0] ?? '').matchAll(/([\d.]+)(rem|px)/g)].map((m) =>
      m[2] === 'px' ? Number(m[1]) / 16 : Number(m[1]),
    ),
  );
}

describe('breakpoints', () => {
  const listed = listedBreakpoints(system);

  it('are listed in system.md', () => {
    expect(listed.length).toBeGreaterThan(0);
  });

  it('in the stylesheets are each one listed', () => {
    const used = Object.values(stylesheets).flatMap(queryWidths);
    expect(used.filter((w) => !listed.includes(w))).toEqual([]);
  });

  it('in the drawing are each one listed', () => {
    const diagram = readFileSync(new URL('../Diagram.tsx', import.meta.url), 'utf8');
    const narrow = Number(diagram.match(/narrow: (\d+)/)?.[1]);
    expect(listed).toContain(narrow / 16);
  });

  it('catch a width that is not listed', () => {
    const css = '@container (width >= 40rem) {} @media (min-width: 700px) {}';
    expect(queryWidths(css).filter((w) => !listed.includes(w))).toEqual([43.75]);
  });
});
