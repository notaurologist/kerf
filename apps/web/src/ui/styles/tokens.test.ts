import { readFileSync } from 'node:fs';
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
