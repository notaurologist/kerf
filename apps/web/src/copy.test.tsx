import { GLOSSARY } from '@kerf/core';
import {
  BRAND_EXCEPTIONS,
  BRAND_NAMES,
  VERDICT_WORDS,
  withoutBrandExceptions,
} from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { GlossaryScreen } from './features/glossary/GlossaryScreen.tsx';
import { ProjectView } from './features/project/ProjectScreen.tsx';
import { projectFrom, storedSnapshots } from './test/projects.ts';
import { renderText } from './test/render.tsx';

// Hard rules 2 and 11 over everything a reader sees: the whole plan for each worked example (its
// build steps, flags, board guides, hardware notes and review) and every glossary page.

const pages = [
  ...storedSnapshots.map((snapshot, i) => ({
    name: `the plan for worked example ${i}`,
    text: renderText(<ProjectView project={projectFrom(snapshot)} />),
  })),
  { name: 'the glossary index', text: renderText(<GlossaryScreen />) },
  ...GLOSSARY.map((entry) => ({
    name: `the glossary entry ${entry.id}`,
    text: renderText(<GlossaryScreen term={entry.id} />),
  })),
];

describe('copy on every page', () => {
  it.each(pages)('$name gives no verdicts', ({ text }) => {
    expect(text.length).toBeGreaterThan(0);
    expect(text.match(VERDICT_WORDS)?.[0]).toBeUndefined();
  });

  it.each(pages)('$name names no brands', ({ text }) => {
    expect(withoutBrandExceptions(text).match(BRAND_NAMES)?.[0]).toBeUndefined();
  });

  it.each(BRAND_EXCEPTIONS)('still needs the exception for "$text"', ({ text }) => {
    expect(pages.some((page) => page.text.includes(text))).toBe(true);
  });
});
