import type { geometry } from '@kerf/core';

// A drawing as plain SVG line art: no fills, visible lines solid, hidden lines dashed, other
// lines thin, and part letters as text with their leaders. In the drawing's own inches, so it can be scaled to print.

type Drawing = geometry.Drawing;

const n = (x: number) => String(x + 0);

const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function lineArtSvg(drawing: Drawing): string {
  const { x, y, width, height } = drawing.bounds;
  const stroke = Math.max(width, height) / 800;
  const body = drawing.primitives.flatMap((p) => {
    if (p.kind === 'line') {
      const points = p.points.map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
      const style =
        p.role === 'visible'
          ? `stroke-width="${n(stroke)}"`
          : p.role === 'hidden'
            ? `stroke-width="${n(stroke / 2)}" stroke-dasharray="${n(stroke * 6)} ${n(stroke * 4)}"`
            : `stroke-width="${n(stroke / 2)}"`;
      return [
        `<polyline class="${p.role}" points="${points}" fill="none" stroke="#000" ${style}/>`,
      ];
    }
    if (p.kind === 'letter') {
      return [
        `<line x1="${n(p.at.x)}" y1="${n(p.at.y)}" x2="${n(p.target.x)}" y2="${n(p.target.y)}" stroke="#000" stroke-width="${n(stroke / 2)}"/>`,
        `<text x="${n(p.at.x)}" y="${n(p.at.y)}" font-size="${n(stroke * 14)}" text-anchor="middle">${escapeText(p.letter)}</text>`,
      ];
    }
    return [];
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x)} ${n(y)} ${n(width)} ${n(height)}" font-family="sans-serif">`,
    `<title>${escapeText(drawing.title)}</title>`,
    ...body,
    '</svg>',
    '',
  ].join('\n');
}
