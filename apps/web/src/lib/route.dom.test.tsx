// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { goTo, mount, settle } from '../test/dom.tsx';
import { navigate, redirect, useRoute } from './route.ts';

function Shown() {
  const route = useRoute();
  return <p id="route">{JSON.stringify(route)}</p>;
}

const shown = () => JSON.parse(document.getElementById('route')?.textContent ?? 'null');

describe('useRoute', () => {
  it('starts from the address and follows each hashchange', async () => {
    window.history.replaceState(null, '', '#/glossary');
    mount(<Shown />);
    expect(shown()).toEqual({ screen: 'glossary' });
    await goTo('#/projects/abc/cut-list');
    expect(shown()).toEqual({ screen: 'project', id: 'abc', section: 'cut-list' });
    await goTo('#/nowhere');
    expect(shown()).toEqual({ screen: 'not-found' });
  });

  // happy-dom adds a history entry for location.replace, so redirect's entry count is not checked.
  it('follows navigate as a new entry, and redirect', async () => {
    window.history.replaceState(null, '', '#/projects');
    mount(<Shown />);
    const length = window.history.length;
    navigate({ screen: 'catalog' });
    await settle();
    expect(shown()).toEqual({ screen: 'catalog' });
    expect(window.history.length).toBe(length + 1);
    redirect({ screen: 'tools' });
    await settle();
    expect(shown()).toEqual({ screen: 'tools' });
  });
});
