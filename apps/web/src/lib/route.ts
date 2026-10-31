import { findGlossaryEntry, findToolType } from '@kerf/core';
import { useEffect, useState } from 'react';
import { isPlanSection, type PlanSectionId } from './sections.ts';

// Screens are chosen from the URL hash, so links, reload, and the back button work without a
// router library.

export type Route =
  | { screen: 'projects' }
  // `start` fills the form from a worked example or an earlier project (#98), or from answers to
  // the template's starting questions (#163); none is empty.
  | { screen: 'new-project'; templateId: string; start?: ProjectStart }
  // The plan, one section per screen (#156). No section is the summary. `part` is the part
  // selected in the drawings and the cut list, kept in the address so a reload keeps it.
  | { screen: 'project'; id: string; section?: PlanSectionId; part?: string }
  // `from` is the section Edit was opened from, which Save and Cancel return to.
  | { screen: 'edit-project'; id: string; from?: PlanSectionId }
  // Shopping and Building, full-screen modes launched from the plan (#61). The URL carries the
  // mode and step, so a reload or a shared link reopens the same place.
  | { screen: 'shop'; id: string }
  | { screen: 'build'; id: string }
  | { screen: 'build-steps'; id: string }
  | { screen: 'build-step'; id: string; step: string }
  | { screen: 'build-part'; id: string; step: string; part: string }
  // With `tool`, that tool type's own page; without, the owner's tool list.
  | { screen: 'tools'; tool?: string }
  // With `term`, that entry's own page; without, the index.
  | { screen: 'glossary'; term?: string }
  | { screen: 'catalog' }
  | { screen: 'not-found' };

/**
 * Where a new project's form starts: a template's worked example, an earlier project, or the
 * template's starting questions.
 */
export type ProjectStart =
  | { kind: 'example'; index: number }
  | { kind: 'project'; id: string }
  | { kind: 'questions' };

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second, third, fourth, fifth] = parts;
  const search = new URLSearchParams(query);
  if (parts.length === 0) return { screen: 'projects' };
  if (first === 'tools' && parts.length === 1) return { screen: 'tools' };
  if (first === 'tools' && parts.length === 2 && second && findToolType(second)) {
    return { screen: 'tools', tool: second };
  }
  if (first === 'catalog' && parts.length === 1) return { screen: 'catalog' };
  if (first === 'glossary' && parts.length === 1) return { screen: 'glossary' };
  if (first === 'glossary' && parts.length === 2 && second && findGlossaryEntry(second)) {
    return { screen: 'glossary', term: second };
  }
  if (first !== 'projects' || parts.length > 5) return { screen: 'not-found' };
  if (second === undefined) return { screen: 'projects' };
  if (second === 'new' && parts.length === 2) {
    const templateId = search.get('template');
    if (!templateId) return { screen: 'not-found' };
    const start = startOf(search);
    return start
      ? { screen: 'new-project', templateId, start }
      : { screen: 'new-project', templateId };
  }
  if (third === undefined) return project(second, undefined, null);
  if (third === 'edit' && parts.length === 3) {
    const from = search.get('from');
    return isPlanSection(from) && from !== 'summary'
      ? { screen: 'edit-project', id: second, from }
      : { screen: 'edit-project', id: second };
  }
  // The summary has the project's own address, so `summary` is not one of its sections'.
  if (isPlanSection(third) && third !== 'summary') {
    return parts.length === 3
      ? project(second, third, search.get('part'))
      : { screen: 'not-found' };
  }
  if (third === 'shop' && parts.length === 3) return { screen: 'shop', id: second };
  if (third !== 'build') return { screen: 'not-found' };
  // "steps" is the step list, so no step may have that ID.
  if (fourth === undefined) return { screen: 'build', id: second };
  if (fourth === 'steps') {
    return parts.length === 4 ? { screen: 'build-steps', id: second } : { screen: 'not-found' };
  }
  if (fifth === undefined) return { screen: 'build-step', id: second, step: fourth };
  return { screen: 'build-part', id: second, step: fourth, part: fifth };
}

function startOf(search: URLSearchParams): ProjectStart | undefined {
  const example = search.get('example');
  if (example !== null && /^\d+$/.test(example)) return { kind: 'example', index: Number(example) };
  const project = search.get('project');
  if (project) return { kind: 'project', id: project };
  return search.has('questions') ? { kind: 'questions' } : undefined;
}

function project(id: string, section: PlanSectionId | undefined, part: string | null): Route {
  return {
    screen: 'project',
    id,
    ...(section ? { section } : {}),
    ...(part ? { part } : {}),
  };
}

export function href(route: Exclude<Route, { screen: 'not-found' }>): string {
  switch (route.screen) {
    case 'projects':
      return '#/projects';
    case 'new-project': {
      const start =
        route.start?.kind === 'example'
          ? `&example=${route.start.index}`
          : route.start?.kind === 'project'
            ? `&project=${encodeURIComponent(route.start.id)}`
            : route.start?.kind === 'questions'
              ? '&questions'
              : '';
      return `#/projects/new?template=${encodeURIComponent(route.templateId)}${start}`;
    }
    case 'project': {
      const section =
        route.section && route.section !== 'summary' ? `/${encodeURIComponent(route.section)}` : '';
      const part = route.part ? `?part=${encodeURIComponent(route.part)}` : '';
      return `#/projects/${encodeURIComponent(route.id)}${section}${part}`;
    }
    case 'edit-project': {
      const from =
        route.from && route.from !== 'summary' ? `?from=${encodeURIComponent(route.from)}` : '';
      return `#/projects/${encodeURIComponent(route.id)}/edit${from}`;
    }
    case 'shop':
      return `#/projects/${encodeURIComponent(route.id)}/shop`;
    case 'build':
      return `#/projects/${encodeURIComponent(route.id)}/build`;
    case 'build-steps':
      return `#/projects/${encodeURIComponent(route.id)}/build/steps`;
    case 'build-step':
      return `#/projects/${encodeURIComponent(route.id)}/build/${encodeURIComponent(route.step)}`;
    case 'build-part':
      return `#/projects/${encodeURIComponent(route.id)}/build/${encodeURIComponent(route.step)}/${encodeURIComponent(route.part)}`;
    case 'tools':
      return route.tool ? `#/tools/${encodeURIComponent(route.tool)}` : '#/tools';
    case 'glossary':
      return route.term ? `#/glossary/${encodeURIComponent(route.term)}` : '#/glossary';
    case 'catalog':
      return '#/catalog';
  }
}

export function navigate(route: Exclude<Route, { screen: 'not-found' }>) {
  window.location.hash = href(route);
}

/** Goes to `route` in place of the current entry, so Back skips the one left. */
export function redirect(route: Exclude<Route, { screen: 'not-found' }>) {
  window.location.replace(href(route));
}

/** True for Shopping and Building, which fill the screen under their own bar (#61). */
export function isMode(route: Route): boolean {
  return ['shop', 'build', 'build-steps', 'build-step', 'build-part'].includes(route.screen);
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
