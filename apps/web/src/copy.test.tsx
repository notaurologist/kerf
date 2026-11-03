import { createSnapshot, GLOSSARY, readSnapshot, TEMPLATES } from '@kerf/core';
import {
  BRAND_EXCEPTIONS,
  BRAND_NAMES,
  VERDICT_WORDS,
  withoutBrandExceptions,
} from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { GlossaryScreen } from './features/glossary/GlossaryScreen.tsx';
import { ProjectView } from './features/project/ProjectScreen.tsx';
import type { Project } from './lib/types.ts';
import { projectFrom, storedSnapshots } from './test/projects.ts';
import { renderText } from './test/render.tsx';

// Hard rules 2 and 11 over everything a reader sees: the whole plan (its build steps, flags, board
// guides, hardware notes and review) for each stored swing set fixture and for every template's
// worked examples at its current version, and every glossary page.

/** A worked example as the API returns it: generated, stored as JSON, and read back. */
function currentSnapshot(t: (typeof TEMPLATES)[number], e: (typeof t.examples)[number]) {
  const made = createSnapshot(t, e.params, e.structuralInputs);
  if (!made.ok) throw new Error(JSON.stringify(made.issues));
  const read = readSnapshot(TEMPLATES, JSON.parse(JSON.stringify(made.output)));
  if (!read.ok) throw new Error(read.message);
  return read.snapshot as NonNullable<Project['snapshot']>;
}

const pages = [
  ...storedSnapshots.map((snapshot, i) => ({
    name: `the plan for stored example ${i}`,
    text: renderText(<ProjectView project={projectFrom(snapshot)} />),
  })),
  ...TEMPLATES.flatMap((t) =>
    t.examples.map((e) => ({
      name: `the plan for ${t.id}, ${e.name}`,
      text: renderText(
        <ProjectView
          project={projectFrom(currentSnapshot(t, e), {
            templateId: t.id,
            templateVersion: t.version,
            version: { status: 'current', version: t.version },
          })}
        />,
      ),
    })),
  ),
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
