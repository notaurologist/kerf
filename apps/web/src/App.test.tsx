import { GLOSSARY, ILLUSTRATIONS } from '@kerf/core';
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
  it('lists every glossary entry, in order, each term a dfn at its own id', () => {
    const html = renderToString(<Screen route={{ screen: 'glossary' }} />);
    const terms = [...html.matchAll(/<div id="term-([a-z-]+)"[^>]*><dt><dfn>([^<]+)<\/dfn>/g)];
    expect(terms.map((m) => [m[1], m[2]])).toEqual(GLOSSARY.map((e) => [e.id, e.term]));
    for (const entry of GLOSSARY) {
      expect(html).toContain(entry.definition.replaceAll("'", '&#x27;'));
    }
  });

  it('shows each illustrated entry with its drawing', () => {
    const html = renderToString(<Screen route={{ screen: 'glossary' }} />);
    GLOSSARY.forEach((entry, i) => {
      const start = html.indexOf(`<div id="term-${entry.id}"`);
      const next = GLOSSARY[i + 1];
      const block = html.slice(start, next ? html.indexOf(`<div id="term-${next.id}"`) : undefined);
      const drawing = 'illustration' in entry ? ILLUSTRATIONS[entry.illustration] : undefined;
      if (drawing) {
        expect(block).toContain(`aria-label="${drawing.description.replaceAll("'", '&#x27;')}"`);
      } else {
        expect(block).not.toContain('role="img"');
      }
    });
  });

  it('says when there is no page at an address', () => {
    expect(renderToString(<Screen route={{ screen: 'not-found' }} />)).toContain('no page here');
  });
});
