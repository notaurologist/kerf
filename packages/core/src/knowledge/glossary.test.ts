import { describe, expect, it } from 'vitest';
import { findGlossaryEntry, findTerms, GLOSSARY, GlossaryEntry } from './glossary.ts';
import { TOOL_TYPES } from './tools.ts';

const used = (text: string) => findTerms(text).map((u) => [u.id, text.slice(u.start, u.end)]);

describe('glossary', () => {
  it('parses every entry with its schema', () => {
    for (const entry of GLOSSARY) expect(GlossaryEntry.safeParse(entry).error).toBeUndefined();
  });

  it('has unique IDs, and each term and form belongs to one entry', () => {
    expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length);
    const words = GLOSSARY.flatMap((e) => [e.term, ...e.forms].map((w) => w.toLowerCase()));
    expect(new Set(words).size).toBe(words.length);
  });

  it('lists the terms in alphabetical order', () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b)));
  });

  it('defines each term in one or two sentences', () => {
    for (const entry of GLOSSARY) {
      const sentences = entry.definition.split(/(?<=\.)\s+/);
      expect([entry.id, sentences.length <= 2]).toEqual([entry.id, true]);
    }
  });

  it('sources the margin, whose definition is safety-relevant (hard rule 5)', () => {
    expect(findGlossaryEntry('margin')?.sources).not.toEqual([]);
  });

  it('says no verdicts (hard rule 2)', () => {
    for (const entry of GLOSSARY) {
      expect(entry.definition).not.toMatch(/\b(safe|unsafe|pass|fail)\b/i);
    }
  });
});

describe('findTerms', () => {
  it.each(
    GLOSSARY.flatMap((e) =>
      [e.term.toLowerCase(), ...e.forms].map((words) => [e.id, words] as const),
    ),
  )('finds %s written as "%s" in a sentence', (id, words) => {
    expect(used(`Check the ${words}, then go on.`)).toEqual([[id, words]]);
  });

  it('ignores case and finds every use, in order', () => {
    expect(used('End cuts first. Then the end cut on the gusset; Kerf, kerf.')).toEqual([
      ['end-cut', 'End cuts'],
      ['end-cut', 'end cut'],
      ['gusset', 'gusset'],
      ['kerf', 'kerf'],
    ]);
  });

  it('matches whole words only', () => {
    expect(used('Stocky gussetted margins-wide')).toEqual([['margin', 'margins']]);
    expect(used('Kerfing the plumber’s stockpile')).toEqual([]);
  });

  it('takes the longest term at each place', () => {
    expect(used('Mark the long point.')).toEqual([['long-point', 'long point']]);
    expect(used('Read the angles to the edge.')).toEqual([
      ['angle-to-the-edge', 'angles to the edge'],
    ]);
  });

  it('matches across a line break or a hyphen between words', () => {
    expect(used('the long\npoint and the saw-setting')).toEqual([
      ['long-point', 'long\npoint'],
      ['saw-setting', 'saw-setting'],
    ]);
  });

  it('never finds a term inside a tool name', () => {
    expect(used('Set the miter saw to the angle with a sliding bevel.')).toEqual([]);
    expect(used('Two miter saws, a miter-saw setting, and a miter.')).toEqual([['miter', 'miter']]);
    for (const tool of TOOL_TYPES) {
      expect([tool.id, used(`Use the ${tool.name}.`)]).toEqual([tool.id, []]);
    }
  });

  it('reads "Kerf" with a capital as the app, and any other case as the term', () => {
    expect(used('Kerf gives the kerf. KERF.')).toEqual([
      ['kerf', 'kerf'],
      ['kerf', 'KERF'],
    ]);
  });
});
