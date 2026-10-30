import { afterEach, describe, expect, it, vi } from 'vitest';
import { href, navigate, parseRoute, type Route, redirect } from './route.ts';
import { PLAN_SECTIONS } from './sections.ts';

describe('parseRoute', () => {
  it.each<[string, Route]>([
    ['', { screen: 'projects' }],
    ['#/', { screen: 'projects' }],
    ['#/projects', { screen: 'projects' }],
    ['#/tools', { screen: 'tools' }],
    ['#/catalog', { screen: 'catalog' }],
    ['#/catalog/x', { screen: 'not-found' }],
    ['#/projects/abc', { screen: 'project', id: 'abc' }],
    ['#/projects/abc/edit', { screen: 'edit-project', id: 'abc' }],
    [
      '#/projects/new?template=swing-set-a-frame',
      { screen: 'new-project', templateId: 'swing-set-a-frame' },
    ],
    ['#/projects/new', { screen: 'not-found' }],
    ['#/projects/abc/delete', { screen: 'not-found' }],
    ['#/projects/abc/edit/x', { screen: 'not-found' }],
    ['#/projects/abc/shop', { screen: 'shop', id: 'abc' }],
    ['#/projects/abc/shop/x', { screen: 'not-found' }],
    ['#/projects/abc/build', { screen: 'build', id: 'abc' }],
    ['#/projects/abc/build/steps', { screen: 'build-steps', id: 'abc' }],
    ['#/projects/abc/build/steps/x', { screen: 'not-found' }],
    ['#/projects/abc/build/board-2', { screen: 'build-step', id: 'abc', step: 'board-2' }],
    [
      '#/projects/abc/build/board-2/leg-back',
      { screen: 'build-part', id: 'abc', step: 'board-2', part: 'leg-back' },
    ],
    ['#/projects/abc/build/board-2/leg-back/x', { screen: 'not-found' }],
    ['#/elsewhere', { screen: 'not-found' }],
    // The plan, one section per screen (#156).
    ['#/projects/abc/diagrams', { screen: 'project', id: 'abc', section: 'diagrams' }],
    [
      '#/projects/abc/structural-review',
      { screen: 'project', id: 'abc', section: 'structural-review' },
    ],
    ['#/projects/abc/parameters', { screen: 'project', id: 'abc', section: 'parameters' }],
    [
      '#/projects/abc/cut-list?part=leg-front',
      { screen: 'project', id: 'abc', section: 'cut-list', part: 'leg-front' },
    ],
    [
      '#/projects/abc/diagrams?part=leg%2Ffront',
      { screen: 'project', id: 'abc', section: 'diagrams', part: 'leg/front' },
    ],
    // The summary is the project's own address, and has no part to select.
    ['#/projects/abc/summary', { screen: 'not-found' }],
    ['#/projects/abc?part=beam', { screen: 'project', id: 'abc' }],
    ['#/projects/abc/cut-list/x', { screen: 'not-found' }],
    ['#/projects/abc/cutlist', { screen: 'not-found' }],
    ['#/projects/abc/edit?from=cut-list', { screen: 'edit-project', id: 'abc', from: 'cut-list' }],
    ['#/projects/abc/edit?from=summary', { screen: 'edit-project', id: 'abc' }],
    ['#/projects/abc/edit?from=elsewhere', { screen: 'edit-project', id: 'abc' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it('reads back every address href makes', () => {
    const routes: Exclude<Route, { screen: 'not-found' }>[] = [
      { screen: 'projects' },
      { screen: 'tools' },
      { screen: 'catalog' },
      { screen: 'project', id: '6f1c2a3e-0000-4000-8000-000000000000' },
      { screen: 'edit-project', id: 'x y' },
      { screen: 'new-project', templateId: 'swing-set-a-frame' },
      { screen: 'shop', id: 'abc' },
      { screen: 'build', id: 'abc' },
      { screen: 'build-steps', id: 'abc' },
      { screen: 'build-step', id: 'abc', step: 'board 1/2' },
      { screen: 'build-part', id: 'abc', step: 'board-1', part: 'leg/back' },
    ];
    for (const route of routes) expect(parseRoute(href(route))).toEqual(route);
  });

  it('reads back every section’s address, with and without a part, so a reload stays put', () => {
    for (const { id } of PLAN_SECTIONS) {
      const section = id === 'summary' ? {} : { section: id };
      const route: Route = { screen: 'project', id: 'p 1', ...section };
      expect(parseRoute(href(route))).toEqual(route);
      if (id === 'summary') continue;
      const withPart: Route = { ...route, part: 'leg-back' };
      expect(parseRoute(href(withPart))).toEqual(withPart);
      const edit: Route = { screen: 'edit-project', id: 'p 1', from: id };
      expect(parseRoute(href(edit))).toEqual(edit);
    }
  });

  it('gives the summary the project’s own address, and Edit from it no section', () => {
    expect(href({ screen: 'project', id: 'p', section: 'summary' })).toBe('#/projects/p');
    expect(href({ screen: 'edit-project', id: 'p', from: 'summary' })).toBe('#/projects/p/edit');
  });
});

describe('the plan’s sections', () => {
  it('use no address a mode or the editor uses', () => {
    for (const reserved of ['edit', 'shop', 'build', 'new']) {
      expect(PLAN_SECTIONS.map((s) => s.id)).not.toContain(reserved);
    }
    // Each reserved address still opens its own screen.
    expect(parseRoute('#/projects/abc/edit').screen).toBe('edit-project');
    expect(parseRoute('#/projects/abc/shop').screen).toBe('shop');
    expect(parseRoute('#/projects/abc/build').screen).toBe('build');
  });

  it('are in order A', () => {
    expect(PLAN_SECTIONS.map((s) => s.title)).toEqual([
      'Summary',
      'Diagrams',
      'Structural review',
      'Cut list',
      'Boards',
      'Shopping list',
      'Build steps',
      'Parameters and inputs',
    ]);
  });
});

describe('history', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Back returns to the section before (#156): a move between sections sets the hash, which adds
  // an entry; selecting a part replaces the entry, so selections do not fill Back.
  it('adds an entry for a move between sections and replaces it for a selection', () => {
    const location = { hash: '#/projects/p/diagrams', replace: vi.fn() };
    vi.stubGlobal('window', { location });
    navigate({ screen: 'project', id: 'p', section: 'cut-list' });
    expect(location.hash).toBe('#/projects/p/cut-list');
    expect(location.replace).not.toHaveBeenCalled();
    redirect({ screen: 'project', id: 'p', section: 'cut-list', part: 'beam' });
    expect(location.replace).toHaveBeenCalledWith('#/projects/p/cut-list?part=beam');
  });
});
