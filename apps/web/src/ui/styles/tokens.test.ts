import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The C1 colors were chosen with every pairing measured (docs/design/color.html, #43). This test
// keeps those measurements true of the tokens: each pairing still meets its WCAG 2.2 minimum,
// and still has the ratio recorded when it was chosen, so a changed token cannot pass unnoticed.

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Each color token as `light-dark(light, dark)`, split into the two themes. */
const pairsOf = [
  ...css.matchAll(/--([a-z0-9-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/g),
];
const themes = {
  light: Object.fromEntries(pairsOf.map((m) => [m[1], m[2]])),
  dark: Object.fromEntries(pairsOf.map((m) => [m[1], m[3]])),
} as Record<'light' | 'dark', Record<string, string>>;

/** WCAG 2.2 relative luminance of an sRGB hex color. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG 2.2 contrast ratio. */
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, kind, recorded light ratio, recorded dark ratio], from color.html.
// Text needs 4.5:1 (WCAG 1.4.3); lines, borders, and focus rings need 3:1 (1.4.11).
const PAIRS: [string, string, 'text' | 'ui', number, number][] = [
  ['text', 'bg', 'text', 16.04, 15.49],
  ['text', 'raised', 'text', 16.89, 14.16],
  ['text', 'sunken', 'text', 14.68, 16.28],
  ['muted', 'bg', 'text', 6.76, 8.3],
  ['muted', 'raised', 'text', 7.12, 7.59],
  ['accent', 'bg', 'text', 6.28, 8.35],
  ['accent', 'raised', 'text', 6.62, 7.63],
  ['on-accent', 'accent', 'text', 6.62, 8.5],
  ['flag-text', 'flag-bg', 'text', 9.26, 10.18],
  ['flag-border', 'bg', 'ui', 3.56, 8.15],
  ['flag-border', 'raised', 'ui', 3.75, 7.45],
  ['input-text', 'input-bg', 'text', 9.29, 9.73],
  ['input-border', 'bg', 'ui', 5.72, 7.49],
  ['error', 'bg', 'text', 6.27, 6.96],
  ['error', 'error-bg', 'text', 5.8, 5.62],
  ['done', 'raised', 'ui', 6.62, 7.63],
  ['focus', 'bg', 'ui', 4.67, 9.18],
  ['focus', 'raised', 'ui', 4.92, 8.4],
  ['border-strong', 'bg', 'ui', 4.42, 5.07],
  ['border-strong', 'raised', 'ui', 4.65, 4.64],
  ['ink', 'raised', 'text', 16.89, 14.16],
  ['dim', 'raised', 'text', 6.62, 7.63],
  ['hidden', 'raised', 'ui', 4.85, 4.64],
  ['ink', 'highlight', 'text', 12.42, 8.38],
  ['zone-line', 'raised', 'ui', 4.65, 6.56],
  ['ink', 'zone', 'text', 13.89, 12.1],
];

// D2's face tones (#44): the ink on the darkest face, as recorded in diagrams.html.
const TONES: [string, string, number, number][] = [
  ['ink', 'tone-3', 8.8, 0],
  ['ink', 'tone-1', 0, 7.0],
];

const MINIMUM = { text: 4.5, ui: 3 };

describe.each(['light', 'dark'] as const)('C1 %s', (theme) => {
  const t = themes[theme];
  it.each(PAIRS)('%s on %s (%s)', (fg, bg, kind, light, dark) => {
    const a = t[fg];
    const b = t[bg];
    if (!a || !b) throw new Error(`missing token ${a ? bg : fg}`);
    const r = ratio(a, b);
    expect(r).toBeGreaterThanOrEqual(MINIMUM[kind]);
    // The tokens are the measured colors rounded to hex, so allow for that rounding only.
    expect(r).toBeCloseTo(theme === 'light' ? light : dark, 1);
  });
});

describe('D2 face tones', () => {
  it.each(TONES)('%s on %s', (fg, bg, light, dark) => {
    for (const [theme, recorded] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      if (recorded === 0) continue;
      const t = themes[theme];
      expect(ratio(t[fg] ?? '', t[bg] ?? '')).toBeCloseTo(recorded, 1);
    }
  });

  it('keeps the face toward the light lightest, in both themes', () => {
    for (const t of Object.values(themes)) {
      const l = (n: string) => luminance(t[n] ?? '');
      expect(l('tone-1')).toBeGreaterThan(l('tone-2'));
      expect(l('tone-2')).toBeGreaterThan(l('tone-3'));
    }
  });
});

function blocksOf(source: string) {
  const plain = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: (m[1] ?? '').split(',').map((s) => s.trim()),
    declarations: [...(m[2] ?? '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((d) => ({
      name: d[1] ?? '',
      value: d[2] ?? '',
    })),
  }));
}

/** Tokens using a token that another block changes, not declared again where it changes. */
function stale(source: string): string[] {
  const blocks = blocksOf(source);
  return blocks.flatMap((block) =>
    block.declarations.flatMap(({ name, value }) =>
      [...value.matchAll(/var\((--[a-z0-9-]+)/g)].flatMap(([, used]) =>
        blocks
          .filter((other) => other !== block && other.declarations.some((d) => d.name === used))
          .flatMap((other) => other.selectors)
          .filter((s) => s !== ':root' && !s.startsWith('[data-theme'))
          .filter((s) => {
            const attribute = s.match(/^\[([a-z-]+)/)?.[1];
            return !block.selectors.some((own) => own === s || own === `[${attribute}]`);
          })
          .map((s) => `${name} uses ${used}, which ${s} sets`),
      ),
    ),
  );
}

describe('tokens that depend on other tokens', () => {
  it('are declared again wherever what they depend on changes', () => {
    expect(stale(css)).toEqual([]);
  });

  it('are caught when declared only on :root', () => {
    const shop = '[data-density="shop"] { --density: 1.5; }';
    const rootOnly = `:root { --density: 1; --space-s: calc(var(--density) * 1rem); } ${shop}`;
    expect(stale(rootOnly)).toEqual(['--space-s uses --density, which [data-density="shop"] sets']);
    const followed = `:root { --density: 1; }
      :root, [data-density] { --space-s: calc(var(--density) * 1rem); } ${shop}`;
    expect(stale(followed)).toEqual([]);
  });
});

const sources = readdirSync(new URL('../../', import.meta.url), {
  recursive: true,
  encoding: 'utf8',
})
  .filter((f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'));

/** Counts `var(--space-${size})` as using every size. */
function unused(declared: readonly string[], files: readonly string[]): string[] {
  const text = files.join('\n');
  const used = new Set([...text.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const prefixes = [...text.matchAll(/var\((--[a-z0-9-]+-)\$\{/g)].map((m) => m[1] ?? '');
  return declared.filter(
    (name) =>
      !used.has(name) &&
      !prefixes.some((p) => name.startsWith(p) && !name.slice(p.length).includes('-')),
  );
}

describe('declared tokens', () => {
  const declared = [...new Set(blocksOf(css).flatMap((b) => b.declarations.map((d) => d.name)))];

  // Measured but not applied: inputs use --text.
  const NOT_YET_USED = ['--input-text'];

  it('are each used somewhere', () => {
    expect(unused(declared, sources)).toEqual(NOT_YET_USED);
  });

  it('are caught when nothing uses them', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the sample is source that builds a token name.
    const files = ['a { gap: var(--space-${size}); color: var(--text); }'];
    expect(unused(['--text', '--space-s', '--space-s-base', '--size-read'], files)).toEqual([
      '--space-s-base',
      '--size-read',
    ]);
  });
});
