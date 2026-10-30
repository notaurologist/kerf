import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';

/** Server-rendered HTML without the comments React puts between adjacent text, for matching. */
export function render(node: ReactNode): string {
  return renderToString(node).replace(/<!-- -->/g, '');
}

/**
 * Roughly the text a reader sees: tags become spaces, runs of space collapse, and no space is
 * left before punctuation or inside parentheses, so inline markup does not split phrases.
 */
export function renderText(node: ReactNode): string {
  return textOf(render(node));
}

/** `renderText` for markup already rendered, such as one section of a screen. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:)])/g, '$1')
    .replace(/\( /g, '(')
    .trim();
}

/** The markup of one section of the plan (`PlanSection`), up to the next one. */
export function sectionOf(html: string, id: string): string {
  const open = `<section id="${id}" class="k-section"`;
  const start = html.indexOf(open);
  if (start < 0) return '';
  const next = html.indexOf(' class="k-section"', start + open.length);
  return next < 0 ? html.slice(start) : html.slice(start, html.lastIndexOf('<section', next));
}
