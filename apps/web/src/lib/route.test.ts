import { afterEach, describe, expect, it, vi } from 'vitest';
import { editReturn, href, navigate, parseRoute, type Route, redirect } from './route.ts';
import { PLAN_SECTIONS } from './sections.ts';

const ID = '6f1c2a3e-0000-4000-8000-000000000000';

describe('parseRoute', () => {
  it.each<[string, Route]>([
    ['', { screen: 'projects' }],
    ['#/', { screen: 'projects' }],
    ['#/projects', { screen: 'projects' }],
    ['#/tools', { screen: 'tools' }],
    ['#/tools/miter-saw', { screen: 'tools', tool: 'miter-saw' }],
    ['#/tools/elsewhere', { screen: 'not-found' }],
    ['#/tools/miter-saw/x', { screen: 'not-found' }],
    ['#/catalog', { screen: 'catalog' }],
    ['#/trash', { screen: 'trash' }],
    ['#/workshop', { screen: 'workshop' }],
    ['#/trash/x', { screen: 'not-found' }],
    ['#/catalog/x', { screen: 'not-found' }],
    ['#/glossary', { screen: 'glossary' }],
    ['#/glossary/end-cut', { screen: 'glossary', term: 'end-cut' }],
    ['#/glossary/elsewhere', { screen: 'not-found' }],
    ['#/glossary/end-cut/x', { screen: 'not-found' }],
    [`#/projects/${ID}`, { screen: 'project', id: ID }],
    [`#/projects/${ID}/edit`, { screen: 'edit-project', id: ID }],
    [
      '#/projects/new?template=swing-set-a-frame',
      { screen: 'new-project', templateId: 'swing-set-a-frame' },
    ],
    [
      '#/projects/new?template=swing-set-a-frame&example=1',
      {
        screen: 'new-project',
        templateId: 'swing-set-a-frame',
        start: { kind: 'example', index: 1 },
      },
    ],
    [
      `#/projects/new?template=swing-set-a-frame&project=${ID}`,
      {
        screen: 'new-project',
        templateId: 'swing-set-a-frame',
        start: { kind: 'project', id: ID },
      },
    ],
    [
      '#/projects/new?template=swing-set-a-frame&empty',
      { screen: 'new-project', templateId: 'swing-set-a-frame', start: { kind: 'empty' } },
    ],
    [
      '#/projects/new?template=swing-set-a-frame&questions',
      {
        screen: 'new-project',
        templateId: 'swing-set-a-frame',
        start: { kind: 'questions' },
      },
    ],
    [
      '#/projects/new?template=swing-set-a-frame&example=x',
      { screen: 'new-project', templateId: 'swing-set-a-frame' },
    ],
    ['#/projects/new', { screen: 'pick-template' }],
    [`#/projects/${ID}/delete`, { screen: 'not-found' }],
    [`#/projects/${ID}/edit/x`, { screen: 'not-found' }],
    [`#/projects/${ID}/shop`, { screen: 'shop', id: ID }],
    [`#/projects/${ID}/shop/x`, { screen: 'not-found' }],
    [`#/projects/${ID}/build`, { screen: 'build', id: ID }],
    [`#/projects/${ID}/build/steps`, { screen: 'build-steps', id: ID }],
    [`#/projects/${ID}/build/steps/x`, { screen: 'not-found' }],
    [`#/projects/${ID}/build/board-2`, { screen: 'build-step', id: ID, step: 'board-2' }],
    [
      `#/projects/${ID}/build/board-2/leg-back`,
      { screen: 'build-part', id: ID, step: 'board-2', part: 'leg-back' },
    ],
    [`#/projects/${ID}/build/board-2/leg-back/x`, { screen: 'not-found' }],
    ['#/elsewhere', { screen: 'not-found' }],
    // The plan, one section per screen (#156).
    [`#/projects/${ID}/diagrams`, { screen: 'project', id: ID, section: 'diagrams' }],
    [
      `#/projects/${ID}/structural-review`,
      { screen: 'project', id: ID, section: 'structural-review' },
    ],
    [`#/projects/${ID}/parameters`, { screen: 'not-found' }],
    [
      `#/projects/${ID}/cut-list?part=leg-front`,
      { screen: 'project', id: ID, section: 'cut-list', part: 'leg-front' },
    ],
    [
      `#/projects/${ID}/diagrams?part=leg%2Ffront`,
      { screen: 'project', id: ID, section: 'diagrams', part: 'leg/front' },
    ],
    // The summary is the project's own address, and has no part to select.
    [`#/projects/${ID}/summary`, { screen: 'not-found' }],
    [`#/projects/${ID}?part=beam`, { screen: 'project', id: ID }],
    [`#/projects/${ID}/cut-list/x`, { screen: 'not-found' }],
    [`#/projects/${ID}/cutlist`, { screen: 'not-found' }],
    [`#/projects/${ID}/edit?from=cut-list`, { screen: 'edit-project', id: ID, from: 'cut-list' }],
    [`#/projects/${ID}/edit?from=summary`, { screen: 'edit-project', id: ID }],
    [`#/projects/${ID}/edit?from=shop`, { screen: 'edit-project', id: ID, from: 'shop' }],
    [`#/projects/${ID}/edit?from=elsewhere`, { screen: 'edit-project', id: ID }],
    [
      `#/projects/${ID}/edit?from=cut-list&field=s-moisture.low`,
      { screen: 'edit-project', id: ID, from: 'cut-list', field: 's-moisture.low' },
    ],
    ['#/projects/%E0', { screen: 'not-found' }],
    // Project IDs go into API paths, so only a UUID is read as one.
    ['#/projects/abc', { screen: 'not-found' }],
    ['#/projects/abc/edit', { screen: 'not-found' }],
    ['#/projects/..%2Ftrash%2F6f1c2a3e-0000-4000-8000-000000000000', { screen: 'not-found' }],
    [
      '#/projects/new?template=swing-set-a-frame&project=..%2Ftrash',
      { screen: 'new-project', templateId: 'swing-set-a-frame' },
    ],
    ['#/tools/%', { screen: 'not-found' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it('reads back every address href makes', () => {
    const routes: Exclude<Route, { screen: 'not-found' }>[] = [
      { screen: 'projects' },
      { screen: 'tools' },
      { screen: 'tools', tool: 'post-hole-digger' },
      { screen: 'catalog' },
      { screen: 'trash' },
      { screen: 'workshop' },
      { screen: 'pick-template' },
      { screen: 'glossary' },
      { screen: 'glossary', term: 'long-point' },
      { screen: 'project', id: ID },
      { screen: 'edit-project', id: ID },
      { screen: 'edit-project', id: ID, from: 'boards', field: 's-riderWeights.0' },
      { screen: 'new-project', templateId: 'swing-set-a-frame' },
      {
        screen: 'new-project',
        templateId: 'swing-set-a-frame',
        start: { kind: 'example', index: 0 },
      },
      { screen: 'new-project', templateId: 'swing set', start: { kind: 'project', id: ID } },
      { screen: 'new-project', templateId: 'swing-set-a-frame', start: { kind: 'empty' } },
      { screen: 'shop', id: ID },
      { screen: 'build', id: ID },
      { screen: 'build-steps', id: ID },
      { screen: 'build-step', id: ID, step: 'board 1/2' },
      { screen: 'build-part', id: ID, step: 'board-1', part: 'leg/back' },
    ];
    for (const route of routes) expect(parseRoute(href(route))).toEqual(route);
  });

  it('reads back every section’s address, with and without a part, so a reload stays put', () => {
    for (const { id } of PLAN_SECTIONS) {
      const route: Route = { screen: 'project', id: ID, section: id };
      expect(parseRoute(href(route))).toEqual(route);
      const withPart: Route = { ...route, part: 'leg-back' };
      expect(parseRoute(href(withPart))).toEqual(withPart);
      const edit: Route = { screen: 'edit-project', id: ID, from: id };
      expect(parseRoute(href(edit))).toEqual(edit);
    }
  });

  it('gives the project’s own address no section, and has no summary section', () => {
    expect(href({ screen: 'project', id: 'p' })).toBe('#/projects/p');
    expect(parseRoute(`#/projects/${ID}/summary`)).toEqual({ screen: 'not-found' });
  });
});

describe('editReturn', () => {
  it('goes back to the section Edit was opened from, or to Shopping mode', () => {
    expect(editReturn('abc', 'cut-list')).toEqual({
      screen: 'project',
      id: 'abc',
      section: 'cut-list',
    });
    expect(editReturn('abc', undefined)).toEqual({ screen: 'project', id: 'abc' });
    expect(editReturn('abc', 'shop')).toEqual({ screen: 'shop', id: 'abc' });
  });
});

describe('the plan’s sections', () => {
  it('use no address a mode or the editor uses', () => {
    for (const reserved of ['edit', 'shop', 'build', 'new']) {
      expect(PLAN_SECTIONS.map((s) => s.id)).not.toContain(reserved);
    }
    // Each reserved address still opens its own screen.
    expect(parseRoute(`#/projects/${ID}/edit`).screen).toBe('edit-project');
    expect(parseRoute(`#/projects/${ID}/shop`).screen).toBe('shop');
    expect(parseRoute(`#/projects/${ID}/build`).screen).toBe('build');
  });

  it('are in order A', () => {
    expect(PLAN_SECTIONS.map((s) => s.title)).toEqual([
      'Diagrams',
      'Structural review',
      'Cut list',
      'Boards',
      'Shopping list',
      'Build steps',
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
