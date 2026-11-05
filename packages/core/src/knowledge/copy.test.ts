import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SOURCES } from '../design-values/sources.ts';
import { BRAND_NAMES, VERDICT_WORDS, withoutBrandExceptions } from '../testing.ts';
import * as knowledge from './index.ts';

// Hard rules 2 and 11 over everything the knowledge library holds, whether or not a template
// uses it yet: every exported value in this folder, the help a field built here carries, and the
// titles of the sources it cites. A new export is scanned without being listed here.

/** Every string inside `value`, each with the path that reaches it. */
function strings(value: unknown, path: string): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  return [];
}

const exported = Object.entries(knowledge).filter(
  ([, value]) => typeof value !== 'function' && !(value instanceof z.ZodType),
);

const texts = [
  ...exported.flatMap(([name, value]) => strings(value, name)),
  ...strings(knowledge.standingHeightField('height'), 'standingHeightField'),
  ...strings(SOURCES, 'SOURCES'),
];

describe('the knowledge library', () => {
  it('is all read by the scan', () => {
    const names = exported.map(([name]) => name);
    for (const name of ['METHODS', 'GLOSSARY', 'TOOL_TYPES', 'ILLUSTRATIONS', 'SKILLS'])
      expect(names).toContain(name);
    expect(texts.length).toBeGreaterThan(1000);
  });

  it('gives no verdicts (hard rule 2)', () => {
    expect(texts.filter(({ text }) => VERDICT_WORDS.test(text))).toEqual([]);
  });

  it('names no brands (hard rule 11)', () => {
    expect(texts.filter(({ text }) => BRAND_NAMES.test(withoutBrandExceptions(text)))).toEqual([]);
  });
});
