import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  readFileSync(new URL(`./styles/${file}`, import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
const screen = read('components.css');
const print = read('print.css');

/** A property of the rule whose selector list includes `selector`. */
function propertyOf(css: string, selector: string, property: string): string | undefined {
  for (const [, selectors = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some((s) => s.trim() === selector)) {
      const value = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+);`).exec(body)?.[1];
      if (value) return value.trim();
    }
  }
  return undefined;
}

describe('views on screen', () => {
  it('stack in one place that keeps the tallest view’s height, so nothing below moves', () => {
    expect(propertyOf(screen, '.k-views__stage', 'display')).toBe('grid');
    expect(propertyOf(screen, '.k-views__view', 'grid-area')).toBe('1 / 1');
    expect(propertyOf(screen, '.k-views__view[hidden]', 'display')).toBe('block');
    expect(propertyOf(screen, '.k-views__view[hidden]', 'visibility')).toBe('hidden');
  });
});

describe('views on paper', () => {
  it('prints every view under its heading, one after another, without the control', () => {
    expect(propertyOf(print, '.k-views__control', 'display')).toBe('none');
    expect(propertyOf(print, '.k-views__stage', 'display')).toBe('block');
    expect(propertyOf(print, '.k-views__heading', 'display')).toBe('block');
    expect(propertyOf(print, '.k-views__view[hidden]', 'visibility')).toBe('visible');
  });

  it('prints each view alone, out of the cell the views share on screen', () => {
    expect(propertyOf(print, '.k-views__view', 'grid-area')).toBe('auto');
  });

  it('puts a landscape drawing on its own landscape page with its heading', () => {
    for (const holder of ['.l-stack', '.k-views', '.k-views__view']) {
      const page = `${holder}:has(> .k-diagram-wrap[data-page="landscape"])`;
      expect(propertyOf(print, page, 'page')).toBe('landscape');
      expect(propertyOf(print, page, 'break-before')).toBe('page');
    }
    expect(propertyOf(print, '.k-diagram-wrap[data-page="landscape"]', 'page')).toBeUndefined();
  });
});

describe('the plan on paper', () => {
  it('keeps a drawing with its heading and notes on one page, and a heading with what follows', () => {
    expect(propertyOf(print, '.l-stack:has(> .k-diagram-wrap)', 'break-inside')).toBe('avoid');
    expect(propertyOf(print, '.k-diagram-wrap', 'break-inside')).toBe('avoid');
    for (const h of ['h2', 'h3', 'h4']) expect(propertyOf(print, h, 'break-after')).toBe('avoid');
  });

  it('wraps a formula, which scrolls sideways on screen', () => {
    expect(propertyOf(screen, '.k-code', 'white-space')).toBe('nowrap');
    expect(propertyOf(print, '.k-code', 'white-space')).toBe('normal');
    expect(propertyOf(print, '.k-code', 'overflow-wrap')).toBe('anywhere');
  });

  it('leaves out popover triggers and screen-only lines', () => {
    expect(propertyOf(print, '.k-info', 'display')).toBe('none');
    expect(propertyOf(print, '[data-screen-only]', 'display')).toBe('none');
    expect(propertyOf(print, '.k-menu', 'display')).toBe('none');
  });
});

describe('the shop set on paper (#469)', () => {
  const shop = ':root[data-print="shop"]';

  it('prints only the sections in it, and the whole plan leaves out the shop set’s own', () => {
    expect(propertyOf(print, '.k-section[data-sets="shop"]', 'display')).toBe('none');
    expect(propertyOf(print, `${shop} .k-section[data-sets="whole"]`, 'display')).toBe('none');
    expect(propertyOf(print, `${shop} .k-section[data-sets="shop"]`, 'display')).toBe('grid');
  });

  it('starts its first section on the header’s page', () => {
    const first = `${shop} .k-section[data-sets="both"]:not([data-sets="both"] ~ .k-section)`;
    expect(propertyOf(print, first, 'break-before')).toBe('auto');
  });

  it('prints its own line, and no sources', () => {
    expect(propertyOf(screen, '.k-text[data-shop-set-only]', 'display')).toBe('none');
    expect(propertyOf(print, `${shop} .k-text[data-shop-set-only]`, 'display')).toBe('block');
    expect(propertyOf(print, `${shop} .k-disclosure[data-size="small"]`, 'display')).toBe('none');
  });

  it('leaves out a repeated method’s lines, which lay out as usual everywhere else (#534)', () => {
    expect(propertyOf(screen, '.k-shop-set-out', 'display')).toBe('contents');
    expect(propertyOf(print, `${shop} .k-shop-set-out`, 'display')).toBe('none');
    expect(propertyOf(print, `${shop} .k-list > li[data-shop-set-out]`, 'display')).toBe('none');
  });

  it('lets an operation run onto the next page, each instruction kept whole (#534)', () => {
    const rows = `${shop} .k-rows[data-shop-set-split] > .k-row`;
    expect(propertyOf(print, '.k-row', 'break-inside')).toBe('avoid');
    expect(propertyOf(print, rows, 'break-inside')).toBe('auto');
    expect(propertyOf(print, `${rows} li`, 'break-inside')).toBe('avoid');
  });
});

describe('the move between views', () => {
  it('slides a moving part by its move times how far through its stage the move is', () => {
    const transform = (selector: string) =>
      propertyOf(screen, selector, 'transform')?.replace(/\s+/g, ' ');
    // Over the drawing the stage starts from, out from where the part starts.
    expect(transform('.k-diagram-wrap[data-over="start"] [data-moves]')).toBe(
      'translate(calc(var(--move-x) * var(--t, 0)), calc(var(--move-y) * var(--t, 0)))',
    );
    // Over the stage's own drawing, back from where the part ends.
    expect(transform('.k-diagram-wrap[data-over="end"] [data-moves]')).toBe(
      'translate( calc(var(--move-x) * (var(--t, 1) - 1)), calc(var(--move-y) * (var(--t, 1) - 1)) )',
    );
  });

  it('hides letters and guidelines', () => {
    expect(propertyOf(screen, '.k-diagram-wrap[data-labels="hidden"] .k-letter', 'opacity')).toBe(
      '0',
    );
    expect(
      propertyOf(
        screen,
        '.k-diagram-wrap[data-labels="hidden"] [data-role="guideline"]',
        'opacity',
      ),
    ).toBe('0');
  });
});
