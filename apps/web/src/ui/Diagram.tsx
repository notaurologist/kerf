import type { geometry } from '@kerf/core';
import { useEffect, useId, useRef, useState } from 'react';
import { DiagramFrame } from './DiagramFrame.tsx';

// Core's drawing primitives (#90) drawn as SVG (#91), in the language of the drawing standard
// (docs/design/diagrams.html). Each primitive carries a role; its width, dash, and color come
// from the line and diagram tokens in CSS, with strokes that do not scale. Text, arrowheads, and
// part letters are sized in pixels for the width the drawing is shown at, so text stays at least
// 13 px however small the drawing. Nothing here computes a dimension: every label is core's text.

type Drawing = geometry.Drawing;
type Primitive = geometry.Primitive;
type Point2 = geometry.Point2;

/** Sizes in CSS pixels at the drawing's shown width (diagrams.html, Text and Part letters). */
const PX = {
  dimension: 14,
  label: 14,
  note: 13,
  /** Arrowheads 9 by 3. */
  arrowLength: 9,
  arrowWidth: 3,
  letter: 22,
  dot: 2.5,
  /** Below this container width, part letters stack in one column (the phone layout). */
  narrow: 480,
};

/** The tallest a drawing is shown, in CSS pixels: most of the window, so it fits on screen. */
function maxHeight(): number {
  return typeof window === 'undefined' ? 800 : Math.max(320, window.innerHeight * 0.8);
}

/** Width the drawing is shown at, before it is measured (server rendering, tests). */
const ASSUMED_WIDTH = 720;

function useWidth(assumed: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(assumed);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

const pts = (points: readonly Point2[]) => points.map((p) => `${p.x},${p.y}`).join(' ');

/** Part letters in one column on the left, sorted by height (diagrams.html, phone). */
function oneColumn(letters: Extract<Primitive, { kind: 'letter' }>[], x: number, gap: number) {
  let y = -Infinity;
  return [...letters]
    .sort((a, b) => a.target.y - b.target.y)
    .map((l) => {
      y = Math.max(l.target.y, y + gap);
      return { ...l, at: { x, y } };
    });
}

export function Diagram(props: {
  drawing: Drawing;
  /** A short description generated from the same data. */
  label: string;
  /** The id of the long description, such as the cut list. */
  describedBy?: string;
  /** The part to highlight. */
  selected?: string | null;
  /** Called with a part's ID when it is tapped. */
  onSelect?: (partId: string) => void;
  /** Landscape views print on their own landscape page (#41). */
  page?: 'landscape' | 'portrait';
  caption?: string;
  /** The width to draw for until the container is measured; tests and the catalog set it. */
  assumedWidth?: number;
  /**
   * The narrowest the drawing is drawn, in CSS pixels. A long, labeled drawing such as a cut
   * detail keeps its labels apart on a phone by scrolling sideways instead of shrinking.
   */
  minWidth?: number;
}) {
  const { drawing } = props;
  const { ref, width } = useWidth(props.assumedWidth ?? ASSUMED_WIDTH);
  const hatch = `${useId().replace(/:/g, '')}-hatch`;
  const b = drawing.bounds;
  const narrow = width < PX.narrow;
  // Model units per CSS pixel at the shown width. Letters in one column widen the view a little,
  // so the scale is taken from the bounds; the difference is a few pixels.
  // A tall drawing is shown no taller than most of the window, so it is narrower than its
  // container; text is sized for the width it is drawn at.
  const shown = Math.max(
    Math.min(width, (maxHeight() * b.width) / b.height),
    Math.min(props.minWidth ?? 0, (maxHeight() * b.width) / b.height),
  );
  const u = b.width / shown;
  const letters = drawing.primitives.filter(
    (p): p is Extract<Primitive, { kind: 'letter' }> => p.kind === 'letter',
  );
  const placed = narrow ? oneColumn(letters, b.x - PX.letter * u, PX.letter * 1.4 * u) : letters;
  const pad = PX.letter * u;
  // Core bounds text by its anchor point; the text's size is known only here, so the view grows
  // to hold each label's estimated extent, and each part letter's square.
  const boxes = [
    ...drawing.primitives.flatMap((p) => (p.kind === 'text' ? [textBox(p, PX[p.role] * u)] : [])),
    ...placed.map((l) => ({
      x0: l.at.x - pad,
      x1: l.at.x + pad,
      y0: l.at.y - pad,
      y1: l.at.y + pad,
    })),
  ];
  const minX = Math.min(b.x, ...boxes.map((r) => r.x0));
  const maxX = Math.max(b.x + b.width, ...boxes.map((r) => r.x1));
  const minY = Math.min(b.y, ...boxes.map((r) => r.y0));
  const maxY = Math.max(b.y + b.height, ...boxes.map((r) => r.y1));
  const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  // A selected part, and an action drawing's emphasis (#118), are tinted and outlined heavily.
  const selected = (p: { part?: { partId: string } }) =>
    p.part && (p.part.partId === props.selected || drawing.emphasis?.includes(p.part.partId))
      ? ''
      : undefined;
  // One handler for the whole drawing: the tapped shape names its part.
  const tap = (event: { target: EventTarget }) => {
    const id = (event.target as Element).closest?.('[data-part]')?.getAttribute('data-part');
    if (id) props.onSelect?.(id);
  };

  const shapes = drawing.primitives.map((p, i) => {
    const key = i;
    switch (p.kind) {
      case 'polygon': {
        const zone = p.fill === 'zone';
        return (
          <g key={key}>
            <polygon
              className="k-shape"
              points={pts(p.points)}
              data-role={p.role}
              data-fill={p.fill}
              data-outline={p.outline === false ? 'none' : undefined}
              data-selected={selected(p)}
              data-part={p.part?.partId}
            />
            {zone && <polygon className="k-hatch" points={pts(p.points)} fill={`url(#${hatch})`} />}
          </g>
        );
      }
      case 'line': {
        // Both ends for a dimension; the last point only for a motion arrow.
        const ends = [
          [p.points[0], p.points[1]],
          [p.points[p.points.length - 1], p.points[p.points.length - 2]],
        ];
        const arrows =
          p.arrows && p.points.length >= 2
            ? (p.arrows === 'end' ? ends.slice(1) : ends).map(([tip, from], k) => (
                <polygon
                  // biome-ignore lint/suspicious/noArrayIndexKey: the two ends of one line.
                  key={k}
                  className="k-arrow"
                  points={pts(arrowhead(tip as Point2, from as Point2, u))}
                />
              ))
            : null;
        return (
          <g key={key}>
            <polyline
              className="k-shape"
              points={pts(p.points)}
              data-role={p.role}
              data-selected={selected(p)}
              data-part={p.part?.partId}
            />
            {arrows}
          </g>
        );
      }
      case 'arc': {
        const at = (deg: number) => ({
          x: p.center.x + p.radius * Math.cos((deg * Math.PI) / 180),
          y: p.center.y - p.radius * Math.sin((deg * Math.PI) / 180),
        });
        const s = at(p.start);
        const e = at(p.end);
        const large = Math.abs(p.end - p.start) > 180 ? 1 : 0;
        return (
          <path
            key={key}
            className="k-shape"
            d={`M${s.x},${s.y} A${p.radius},${p.radius} 0 ${large} 0 ${e.x},${e.y}`}
            data-role={p.role}
          />
        );
      }
      case 'circle':
        return (
          <circle
            key={key}
            className="k-shape"
            cx={p.center.x}
            cy={p.center.y}
            r={p.radius}
            data-role={p.role}
            data-fill="none"
          />
        );
      case 'text':
        return (
          <text
            key={key}
            className="k-text"
            x={p.at.x}
            y={p.at.y}
            fontSize={PX[p.role] * u}
            textAnchor={p.anchor}
            dominantBaseline="middle"
            data-role={p.role}
            transform={p.rotate ? `rotate(${p.rotate} ${p.at.x} ${p.at.y})` : undefined}
          >
            {p.text}
          </text>
        );
    }
    // Letters are drawn after every shape, below.
    return null;
  });

  const s = PX.letter * u;
  const marks = placed.map((l) => (
    <g
      key={l.part.partId}
      className="k-letter"
      data-selected={selected(l)}
      data-part={l.part.partId}
    >
      <line
        className="k-shape"
        data-role="leader"
        x1={l.at.x + (l.at.x < l.target.x ? s / 2 : -s / 2)}
        y1={l.at.y}
        x2={l.target.x}
        y2={l.target.y}
      />
      <circle className="k-letter__dot" cx={l.target.x} cy={l.target.y} r={PX.dot * u} />
      <rect
        className="k-letter__box"
        x={l.at.x - s / 2}
        y={l.at.y - s / 2}
        width={s}
        height={s}
        rx={s / 5}
      />
      <text
        className="k-letter__text"
        x={l.at.x}
        y={l.at.y}
        fontSize={PX.label * u}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {l.letter}
      </text>
    </g>
  ));

  return (
    <div ref={ref} className="k-diagram-wrap" data-page={props.page ?? 'portrait'}>
      <DiagramFrame
        label={props.label}
        describedBy={props.describedBy}
        caption={props.caption}
        viewBox={viewBox}
        width={shown}
      >
        <defs>
          <pattern
            id={hatch}
            patternUnits="userSpaceOnUse"
            width={8 * u}
            height={8 * u}
            patternTransform="rotate(45)"
          >
            <line className="k-hatch__line" x1="0" y1="0" x2="0" y2={8 * u} />
          </pattern>
        </defs>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: tapping a part is a pointer shortcut; the cut list's part buttons select the same parts from the keyboard. */}
        <g onClick={props.onSelect ? tap : undefined}>
          {shapes}
          {marks}
        </g>
      </DiagramFrame>
      {drawing.notes.length > 0 && (
        <ul className="k-diagram__notes">
          {drawing.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The page area a label takes, estimated at 0.6 of the font size per character, for a text
 * written across the page or turned −90° to read upward.
 */
function textBox(t: Extract<Primitive, { kind: 'text' }>, size: number) {
  const w = 0.6 * size * t.text.length;
  const [lo, hi] = t.anchor === 'start' ? [0, w] : t.anchor === 'end' ? [-w, 0] : [-w / 2, w / 2];
  if (t.rotate === -90) {
    return { x0: t.at.x - size / 2, x1: t.at.x + size / 2, y0: t.at.y - hi, y1: t.at.y - lo };
  }
  return { x0: t.at.x + lo, x1: t.at.x + hi, y0: t.at.y - size / 2, y1: t.at.y + size / 2 };
}

/** An arrowhead with its tip at `tip`, pointing away from `from`, 9 by 3 px. */
function arrowhead(tip: Point2, from: Point2, u: number): Point2[] {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const back = { x: tip.x - ux * PX.arrowLength * u, y: tip.y - uy * PX.arrowLength * u };
  const w = PX.arrowWidth * u;
  return [
    tip,
    { x: back.x - uy * w, y: back.y + ux * w },
    { x: back.x + uy * w, y: back.y - ux * w },
  ];
}
