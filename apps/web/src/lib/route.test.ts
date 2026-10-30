import { describe, expect, it } from 'vitest';
import { href, parseRoute, type Route } from './route.ts';

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
});
