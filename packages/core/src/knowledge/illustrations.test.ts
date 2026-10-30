import { describe, expect, it } from 'vitest';
import { Drawing } from '../geometry/primitives.ts';
import { GLOSSARY } from './glossary.ts';
import { ILLUSTRATION_IDS, ILLUSTRATIONS } from './illustrations.ts';

describe('glossary illustrations', () => {
  it('exist for every illustration an entry names, and each is named by an entry', () => {
    const named = GLOSSARY.flatMap((e) => ('illustration' in e ? [e.illustration] : []));
    for (const id of named) expect(ILLUSTRATIONS[id]).toBeDefined();
    expect([...new Set(named)].sort()).toEqual([...ILLUSTRATION_IDS].sort());
  });

  it('cover the terms #179 asks for', () => {
    const drawn = GLOSSARY.filter((e) => 'illustration' in e).map((e) => e.id);
    expect(drawn).toEqual(
      expect.arrayContaining([
        'kerf',
        'long-point',
        'short-point',
        'miter',
        'bevel',
        'angle-to-the-edge',
        'saw-setting',
      ]),
    );
  });

  it.each(ILLUSTRATION_IDS)('%s parses as a drawing and labels in words only', (id) => {
    const drawing = ILLUSTRATIONS[id];
    expect(Drawing.safeParse(drawing).error).toBeUndefined();
    const words = drawing.primitives.flatMap((p) => (p.kind === 'text' ? [p.text] : []));
    expect(words.length).toBeGreaterThan(0);
    for (const w of [...words, ...drawing.notes]) expect(w).not.toMatch(/\d/);
  });

  it('draws the saw setting and the angle to the edge as arcs that make a right angle', () => {
    const arcs = ILLUSTRATIONS['saw-setting'].primitives.flatMap((p) =>
      p.kind === 'arc' ? [p] : [],
    );
    expect(arcs).toHaveLength(2);
    const [setting, edge] = arcs as [(typeof arcs)[0], (typeof arcs)[0]];
    // The setting runs from the cut to the square line (90°), the edge angle from the edge (0°)
    // to the cut, so the two meet at the cut and span 90° together.
    expect(setting.end).toBe(90);
    expect(edge.start).toBe(0);
    expect(edge.end).toBe(setting.start);
  });

  it('shades the cut end of the miter and the bevel as an end face, with the top face up', () => {
    for (const id of ['miter', 'bevel'] as const) {
      const fills = ILLUSTRATIONS[id].primitives.flatMap((p) =>
        p.kind === 'polygon' ? [p.fill] : [],
      );
      // Seen from above the cut end: the top, the front edge, and the cut end.
      expect([...fills].sort()).toEqual([1, 2, 3]);
    }
  });
});
