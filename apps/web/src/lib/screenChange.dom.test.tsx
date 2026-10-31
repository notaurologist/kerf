// @vitest-environment happy-dom
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goTo, mount, settle } from '../test/dom.tsx';
import { ScreenHeader } from '../ui/ScreenHeader.tsx';
import { type Route, useRoute } from './route.ts';
import { screenKey, useScreenChange } from './screenChange.ts';

function Later(props: { title: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <ScreenHeader title={props.title} /> : <p>Loading…</p>;
}

function Screen(props: { route: Route }) {
  const { route } = props;
  switch (route.screen) {
    case 'projects':
      return <ScreenHeader title="Projects" />;
    case 'glossary':
      return <ScreenHeader title={route.term ?? 'Glossary'} />;
    case 'project':
      return (
        <ScreenHeader title="Swing set" pageTitle={`${route.section ?? 'Summary'} · Swing set`} />
      );
    case 'tools':
      return <Later title="Tools" />;
    default:
      return <p>Elsewhere</p>;
  }
}

function App() {
  const route = useRoute();
  useScreenChange(route);
  return (
    <>
      <a href="#/glossary">Glossary</a>
      <main>
        <Screen route={route} />
      </main>
    </>
  );
}

const h1 = () => document.querySelector('h1');
let scrollTo: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.history.replaceState(null, '', '#/projects');
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  scrollTo.mockRestore();
});

describe('a screen change', () => {
  it('leaves focus and scroll alone when the app first opens, and names the document', () => {
    mount(<App />);
    expect(document.activeElement).toBe(document.body);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.title).toBe('Projects · Kerf');
  });

  it('scrolls to the top, focuses the new heading, and names the document', async () => {
    mount(<App />);
    await goTo('#/glossary/end-cut');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(h1()?.textContent).toBe('end-cut');
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe('end-cut · Kerf');
    await goTo('#/glossary');
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe('Glossary · Kerf');
  });

  it('focuses a heading that arrives after the screen loads', async () => {
    mount(<App />);
    await goTo('#/tools');
    expect(h1()).toBeNull();
    expect(document.title).toBe('Kerf');
    await settle();
    expect(h1()?.textContent).toBe('Tools');
    expect(document.activeElement).toBe(h1());
  });

  it('leaves moves between the plan’s sections to the plan', async () => {
    window.history.replaceState(null, '', '#/projects/abc');
    mount(<App />);
    expect(document.title).toBe('Summary · Swing set · Kerf');
    await goTo('#/projects/abc/cut-list');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
    expect(document.title).toBe('cut-list · Swing set · Kerf');
  });
});

describe('screenKey', () => {
  it('names the screen without the place within it', () => {
    expect(screenKey({ screen: 'project', id: 'a', section: 'cut-list', part: 'p' })).toBe(
      screenKey({ screen: 'project', id: 'a' }),
    );
    expect(screenKey({ screen: 'edit-project', id: 'a', from: 'cut-list' })).toBe(
      screenKey({ screen: 'edit-project', id: 'a' }),
    );
    expect(screenKey({ screen: 'project', id: 'a' })).not.toBe(
      screenKey({ screen: 'project', id: 'b' }),
    );
    expect(screenKey({ screen: 'build-step', id: 'a', step: '1' })).not.toBe(
      screenKey({ screen: 'build-step', id: 'a', step: '2' }),
    );
  });
});
