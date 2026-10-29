import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';

/** Server-rendered HTML without the comments React puts between adjacent text, for matching. */
export function render(node: ReactNode): string {
  return renderToString(node).replace(/<!-- -->/g, '');
}

/** Just the text a reader sees, with tags turned into spaces and runs of space collapsed. */
export function renderText(node: ReactNode): string {
  return render(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
