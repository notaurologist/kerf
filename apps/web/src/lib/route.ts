import { useEffect, useState } from 'react';

// Screens are chosen from the URL hash, so links, reload, and the back button work without a
// router library.

export type Route =
  | { screen: 'projects' }
  | { screen: 'new-project'; templateId: string }
  | { screen: 'project'; id: string }
  | { screen: 'edit-project'; id: string }
  | { screen: 'tools' }
  | { screen: 'catalog' }
  | { screen: 'not-found' };

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second, third] = parts;
  if (parts.length === 0) return { screen: 'projects' };
  if (first === 'tools' && parts.length === 1) return { screen: 'tools' };
  if (first === 'catalog' && parts.length === 1) return { screen: 'catalog' };
  if (first !== 'projects' || parts.length > 3) return { screen: 'not-found' };
  if (second === undefined) return { screen: 'projects' };
  if (second === 'new' && parts.length === 2) {
    const templateId = new URLSearchParams(query).get('template');
    return templateId ? { screen: 'new-project', templateId } : { screen: 'not-found' };
  }
  if (third === undefined) return { screen: 'project', id: second };
  if (third === 'edit') return { screen: 'edit-project', id: second };
  return { screen: 'not-found' };
}

export function href(route: Exclude<Route, { screen: 'not-found' }>): string {
  switch (route.screen) {
    case 'projects':
      return '#/projects';
    case 'new-project':
      return `#/projects/new?template=${encodeURIComponent(route.templateId)}`;
    case 'project':
      return `#/projects/${encodeURIComponent(route.id)}`;
    case 'edit-project':
      return `#/projects/${encodeURIComponent(route.id)}/edit`;
    case 'tools':
      return '#/tools';
    case 'catalog':
      return '#/catalog';
  }
}

export function navigate(route: Exclude<Route, { screen: 'not-found' }>) {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}
