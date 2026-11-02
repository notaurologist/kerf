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
