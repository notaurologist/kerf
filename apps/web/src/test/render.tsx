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
  return render(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:)])/g, '$1')
    .replace(/\( /g, '(')
    .trim();
}
