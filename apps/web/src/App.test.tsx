import {
  GLOSSARY_ENTRIES,
  GLOSSARY_GROUP_LABELS,
  GLOSSARY_GROUPS,
  ILLUSTRATIONS,
} from '@kerf/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Screen } from './App.tsx';
import { LoginForm } from './features/login/LoginScreen.tsx';

describe('LoginForm', () => {
  const render = (props: Partial<Parameters<typeof LoginForm>[0]>) =>
    renderToString(<LoginForm busy={false} error={null} onSubmit={() => {}} {...props} />);

  it('asks for a password only', () => {
    const html = render({});
    expect(html).toContain('type="password"');
    expect(html).not.toMatch(/user ?name|email/i);
  });

  it('says when the password is wrong', () => {
    expect(render({ error: { kind: 'wrong-password' } })).toContain('That password is not right.');
  });

  it('says when to try again after too many attempts', () => {
    expect(render({ error: { kind: 'rate-limited', retryAfterSeconds: 900 } })).toContain(
      'Try again in 15 minutes.',
    );
  });
});

describe('Screen', () => {
  it('indexes every glossary entry once, by group, each linking to its own page', () => {
    const html = renderToString(<Screen route={{ screen: 'glossary' }} />);
    const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(headings).toEqual(GLOSSARY_GROUPS.map((g) => GLOSSARY_GROUP_LABELS[g]));
    const links = [...html.matchAll(/<a href="#\/glossary\/([a-z0-9-]+)">([^<]+)<\/a>/g)];
    const byGroup = GLOSSARY_GROUPS.flatMap((g) =>
      GLOSSARY_ENTRIES.filter((e) => e.group === g).map((e) => [e.id, e.term]),
    );
    expect(links.map((m) => [m[1], m[2]])).toEqual(byGroup);
    // Alphabetical within each group, since GLOSSARY_ENTRIES is.
    for (const g of GLOSSARY_GROUPS) {
      const terms = GLOSSARY_ENTRIES.filter((e) => e.group === g).map((e) => e.term);
      expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b)));
    }
  });

  it('shows one entry on its page: its definition, drawing, sources, and a way back', () => {
    for (const entry of GLOSSARY_ENTRIES) {
      const html = renderToString(<Screen route={{ screen: 'glossary', term: entry.id }} />);
      expect(html).toContain(`<h1>${entry.term.replaceAll("'", '&#x27;')}</h1>`);
      expect(html).toContain(entry.definition.replaceAll("'", '&#x27;'));
      expect(html).toContain('<a href="#/glossary">All terms</a>');
      expect(html).toContain(GLOSSARY_GROUP_LABELS[entry.group]);
      const drawing = entry.illustration ? ILLUSTRATIONS[entry.illustration] : undefined;
      if (drawing) {
        expect(html).toContain(`aria-label="${drawing.description.replaceAll("'", '&#x27;')}"`);
      } else {
        expect(html).not.toContain('role="img"');
      }
      expect(html.includes('>Source<')).toBe(entry.sources.length > 0);
      // No other entry's definition on this page.
      const other = GLOSSARY_ENTRIES.find(
        (e) => e.id !== entry.id && !entry.definition.includes(e.definition),
      );
      if (other) expect(html).not.toContain(other.definition.replaceAll("'", '&#x27;'));
    }
  });

  it('says when there is no page at an address', () => {
    expect(renderToString(<Screen route={{ screen: 'not-found' }} />)).toContain('no page here');
  });
});
