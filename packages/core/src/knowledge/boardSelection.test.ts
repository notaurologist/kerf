import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates/index.ts';
import { BOARD_GUIDES, BoardGuide, findBoardGuide } from './boardSelection.ts';

describe('board selection guides', () => {
  it('parses every entry with its schema', () => {
    for (const guide of BOARD_GUIDES) expect(BoardGuide.safeParse(guide).error).toBeUndefined();
  });

  it('has unique IDs', () => {
    expect(new Set(BOARD_GUIDES.map((g) => g.id)).size).toBe(BOARD_GUIDES.length);
  });

  // Shop practice that no number or structural result depends on. Anything else about strength,
  // decay, or treatment cites its source (hard rule 5).
  it('cites a source for every check except the listed shop practice', () => {
    const unsourced = BOARD_GUIDES.flatMap((g) =>
      g.checks.filter((c) => c.sources.length === 0).map((c) => `${g.id}: ${c.look}`),
    );
    expect(unsourced).toEqual([
      'structural: Read the grade stamp. Confirm the species and grade match what you entered for the structural checks.',
      'span: Sight along the narrow edge to find the crown, the edge that bows outward. Mark it so it goes on top.',
    ]);
  });

  it('every guide a template gives its parts exists, and every part that carries load has one', () => {
    for (const template of TEMPLATES) {
      for (const example of template.examples) {
        const result = template.generate(example.params, example.structuralInputs);
        if (!result.ok) throw new Error(`${template.id} example does not generate`);
        const { lumber } = template.plan(result.output);
        expect(lumber.selection?.length, template.id).toBeGreaterThan(0);
        for (const entry of lumber.selection ?? []) {
          expect(entry.guides[0], entry.partId).toBe('structural');
          for (const id of entry.guides) expect(findBoardGuide(id), id).toBeDefined();
        }
      }
    }
  });
});
