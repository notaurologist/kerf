import { createSnapshot, findTemplate, geometry, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { drawingsFor } from '../test/projects.ts';
import { sharedFrame } from './assemblyMotion.ts';
import { drawingLayout, placeText } from './Diagram.tsx';

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

// The record cabinet's elevations and section, laid out as the plan shows them (drawn no narrower
// than 560 px, Diagrams.tsx): on a phone (375 px, a 343 px column), on paper and at the assumed
// width (720 px), and on a wide screen (1440 px, the 1200 px content column).

const LETTER = 22;
const cabinet = findTemplate('record-cabinet') as TemplateDefinition;
const elevations = cabinet.examples.flatMap((example) => {
  const made = createSnapshot(cabinet, example.params, example.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const drawings = drawingsFor(JSON.parse(JSON.stringify(made.output)));
  return (drawings?.elevations ?? []).flatMap((d) =>
    [343, 720, 1200].map(
      (width) => [`${example.name}, ${d.title}, ${width} px`, d, width] as const,
    ),
  );
});

function laidOut(d: geometry.Drawing, width: number) {
  const { u, placed, placedText } = drawingLayout(d, width, { minWidth: 560 });
  const s = (LETTER * u) / 2;
  const letters = placed.map((l) => ({
    letter: l.letter,
    box: { x0: l.at.x - s, x1: l.at.x + s, y0: l.at.y - s, y1: l.at.y + s },
    leader: [l.at, l.target] as const,
  }));
  const figures = [...placedText.entries()].flatMap(([i, t]) => {
    const p = d.primitives[i] as Extract<geometry.Primitive, { kind: 'text' }>;
    return p.role === 'dimension' ? [{ text: p.text, span: p.span, box: t.box }] : [];
  });
  const lines = d.primitives.flatMap((p) =>
    p.kind === 'line' && p.role === 'dimension'
      ? [p.points as [geometry.Point2, geometry.Point2]]
      : [],
  );
  return { letters, figures, lines };
}

const edges = (b: Box): [geometry.Point2, geometry.Point2][] => [
  [
    { x: b.x0, y: b.y0 },
    { x: b.x1, y: b.y0 },
  ],
  [
    { x: b.x1, y: b.y0 },
    { x: b.x1, y: b.y1 },
  ],
  [
    { x: b.x1, y: b.y1 },
    { x: b.x0, y: b.y1 },
  ],
  [
    { x: b.x0, y: b.y1 },
    { x: b.x0, y: b.y0 },
  ],
];

describe('letters and dimensions on the record cabinet’s elevations', () => {
  it('has the three drawings of each worked example at three widths to check', () => {
    expect(elevations).toHaveLength(cabinet.examples.length * 3 * 3);
  });

  it.each(elevations)('%s: no letter covers a dimension figure', (_, d, width) => {
    const { letters, figures } = laidOut(d, width);
    const clashes = letters.flatMap((l) =>
      figures.flatMap((f) => (crosses(l.box, f.box) ? [`${l.letter} / ${f.text}`] : [])),
    );
    expect(clashes).toEqual([]);
  });

  it.each(elevations)(
    '%s: no leader crosses another, a dimension line, or a figure',
    (_, d, width) => {
      const { letters, figures, lines } = laidOut(d, width);
      const clashes = letters.flatMap((l, i) => [
        ...letters
          .slice(i + 1)
          .flatMap((m) =>
            geometry.crosses(...l.leader, ...m.leader) ? [`${l.letter} / ${m.letter}`] : [],
          ),
        ...lines.flatMap((line) =>
          geometry.crosses(...l.leader, ...line) ? [`${l.letter} / line`] : [],
        ),
        ...figures.flatMap((f) =>
          edges(f.box).some((e) => geometry.crosses(...l.leader, ...e))
            ? [`${l.letter} / ${f.text}`]
            : [],
        ),
      ]);
      expect(clashes).toEqual([]);
    },
  );

  it.each(elevations)(
    '%s: each figure fits between its extension lines or sits outside them',
    (_, d, width) => {
      const { figures } = laidOut(d, width);
      const between = figures.flatMap((f) => {
        if (!f.span) return [`${f.text} has no span`];
        const [a, b] = f.span;
        const across = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
        const [s0, s1] = across
          ? [Math.min(a.x, b.x), Math.max(a.x, b.x)]
          : [Math.min(a.y, b.y), Math.max(a.y, b.y)];
        const [t0, t1] = across ? [f.box.x0, f.box.x1] : [f.box.y0, f.box.y1];
        const inside = t0 >= s0 && t1 <= s1;
        const outside = t1 <= s0 || t0 >= s1;
        return inside || outside ? [] : [f.text];
      });
      expect(between).toEqual([]);
    },
  );

  it.each(elevations)('%s: no figure lands on another', (_, d, width) => {
    const { figures } = laidOut(d, width);
    const clashes = figures.flatMap((a, i) =>
      figures.slice(i + 1).flatMap((b) => (crosses(a.box, b.box) ? [`${a.text} / ${b.text}`] : [])),
    );
    expect(clashes).toEqual([]);
  });
});

// The workbench's assembled view in the frame it shares with its exploded view, as the Diagrams
// section draws it, with letters drawn only from the narrow breakpoint (480 px) up.

describe('part letters on an assembly view lettered only when wide', () => {
  const bench = findTemplate('workbench') as TemplateDefinition;
  const example = bench.examples[0];
  const made = createSnapshot(bench, example?.params, example?.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const drawings = drawingsFor(JSON.parse(JSON.stringify(made.output)));
  const assembled = drawings?.isometric;
  const exploded = drawings?.exploded;
  if (!assembled || !exploded) throw new Error('the workbench has an assembled and exploded view');
  const frame = sharedFrame(assembled.bounds, exploded.bounds);
  const width = (viewBox: string) => Number(viewBox.split(' ')[2]);

  it('draws no letters on a phone, and leaves 8 px each side of the frame for its outline', () => {
    const phone = drawingLayout(assembled, 343, { frame, letters: 'wide' });
    expect(phone.placed).toEqual([]);
    // 8 px at the drawing's scale: frame width over 343 px, each side.
    const u = frame.width / 343;
    expect(width(phone.viewBox)).toBeCloseTo(frame.width + 2 * 8 * u, 9);
  });

  it('draws the drawing wider on a phone than with a column of letters', () => {
    const column = drawingLayout(assembled, 343, { frame });
    const bare = drawingLayout(assembled, 343, { frame, letters: 'wide' });
    expect(column.placed.length).toBeGreaterThan(0);
    // The same SVG width holds less of the model, so each part is drawn larger.
    expect(width(bare.viewBox)).toBeLessThan(width(column.viewBox));
  });

  it('draws every letter from the narrow breakpoint up', () => {
    const wide = drawingLayout(assembled, 720, { frame, letters: 'wide' });
    const letters = assembled.primitives.filter((p) => p.kind === 'letter');
    expect(wide.placed).toHaveLength(letters.length);
    expect(drawingLayout(assembled, 480, { frame, letters: 'wide' }).placed).toHaveLength(
      letters.length,
    );
  });
});
