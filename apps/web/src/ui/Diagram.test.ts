import { createSnapshot, findTemplate, type geometry, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { drawingsFor } from '../test/projects.ts';
import { placeText } from './Diagram.tsx';

// Labels on the cut details, as a phone shows them: a cut detail is drawn no narrower than 560 px
// and scrolls sideways (Diagrams.tsx), so that is where its text is largest against the part.

type Box = { x0: number; x1: number; y0: number; y1: number };
const SHOWN = 560;

// Each worked example made now: the stored fixtures predate holes, whose labels crowd the most.
const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const details = template.examples.flatMap((example) => {
  const made = createSnapshot(template, example.params, example.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const drawings = drawingsFor(JSON.parse(JSON.stringify(made.output)));
  if (!drawings) throw new Error('the worked example draws');
  return drawings.cutDetails.map((d) => ({ ...d, title: `${example.name}, ${d.title}` }));
});

function layout(d: geometry.Drawing) {
  const u = d.bounds.width / Math.min(SHOWN, (800 * d.bounds.width) / d.bounds.height);
  const placed = placeText(d.primitives, u);
  const texts = [...placed.entries()].map(([i, t]) => ({
    text: (d.primitives[i] as Extract<geometry.Primitive, { kind: 'text' }>).text,
    box: t.box,
  }));
  return { texts, u };
}

const crosses = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe('labels on a cut detail at phone width', () => {
  it('has cut details to check', () => {
    expect(details.length).toBeGreaterThan(3);
  });

  it.each(details.map((d) => [d.title, d] as const))('%s: no label lands on another', (_, d) => {
    const { texts } = layout(d);
    const clashes = texts.flatMap((a, i) =>
      texts.slice(i + 1).flatMap((b) => (crosses(a.box, b.box) ? [`${a.text} / ${b.text}`] : [])),
    );
    expect(clashes).toEqual([]);
  });

  it.each(details.map((d) => [d.title, d] as const))(
    '%s: no label sits on a dimension line',
    (_, d) => {
      const { texts } = layout(d);
      const lines = d.primitives.flatMap((p) =>
        p.kind === 'line' && p.role === 'dimension' && p.points.length === 2
          ? [p.points as [geometry.Point2, geometry.Point2]]
          : [],
      );
      const clashes = texts.flatMap((t) =>
        lines.flatMap(([a, b]) => {
          const line = {
            x0: Math.min(a.x, b.x),
            x1: Math.max(a.x, b.x),
            y0: Math.min(a.y, b.y),
            y1: Math.max(a.y, b.y),
          };
          return crosses(t.box, line) ? [t.text] : [];
        }),
      );
      expect(clashes).toEqual([]);
    },
  );
});
