import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const print = readFileSync(new URL('./styles/print.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** The `display` of the rule whose selector list includes `selector`. */
function displayOf(selector: string): string | undefined {
  for (const [, selectors = '', body = ''] of print.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some((s) => s.trim() === selector)) {
      return /display:\s*([\w-]+)/.exec(body)?.[1];
    }
  }
  return undefined;
}

describe('views on paper', () => {
  it('prints every view under its heading, without the control', () => {
    expect(displayOf('.k-views__control')).toBe('none');
    expect(displayOf('.k-views__view[hidden]')).toBe('block');
    expect(displayOf('.k-views__heading')).toBe('block');
  });
});
