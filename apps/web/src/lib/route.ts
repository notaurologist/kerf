import { findGlossaryEntry, findToolType } from '@kerf/core';
import { useEffect, useState } from 'react';
import { leaveGate } from '../ui/leave.ts';
import { isPlanSection, type PlanSectionId } from './sections.ts';

/** Where Edit was opened from: a plan section, or Shopping or Building mode. */
export type EditFrom = PlanSectionId | 'shop' | 'build';

/** The screen Edit's Save, Cancel, and back link go back to. */
export function editReturn(
  id: string,
  from: EditFrom | undefined,
): Extract<Route, { screen: 'shop' | 'build' | 'project' }> {
  if (from === 'shop' || from === 'build') return { screen: from, id };
  return from ? { screen: 'project', id, section: from } : { screen: 'project', id };
}

// Screens are chosen from the URL hash, so links, reload, and the back button work without a
// router library.

export type Route =
  | { screen: 'projects' }
  // `start` fills the form from a worked example or an earlier project (#98), or from answers to
  // the template's starting questions (#163), or leaves it empty; none asks how to start (#358).
  | { screen: 'new-project'; templateId: string; start?: ProjectStart }
  // Choosing what to make, before the new-project form (#357).
  | { screen: 'pick-template' }
  // The plan, one section per screen (#156). No section is the one the project opens on (#356).
  // `part` is the part selected in the drawings and the cut list, kept in the address so a reload
  // keeps it. `group` is the sub-assembly open in the diagrams (#653), so a build step can link
  // to it.
  | { screen: 'project'; id: string; section?: PlanSectionId; part?: string; group?: string }
  // `from` is the section Edit was opened from, or Shopping or Building mode, which Save, Cancel,
  // and the back link return to.
  // `field` is the id of a field to start on, such as an input a check needs.
  | { screen: 'edit-project'; id: string; from?: EditFrom; field?: string }
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
  | { screen: 'trash' }
  // Tools, the glossary, deleted projects, the backup, the theme, and Log out, in one place (#356).
  | { screen: 'workshop' }
  | { screen: 'not-found' };

/**
 * Where a new project's form starts: a template's worked example, an earlier project, the
 * template's starting questions, or nothing.
 */
export type ProjectStart =
  | { kind: 'example'; index: number }
  | { kind: 'project'; id: string }
  | { kind: 'questions' }
  | { kind: 'empty' };

// Project IDs go into API paths, so anything else is refused here rather than sent there.
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  let parts: string[];
  try {
    parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { screen: 'not-found' };
  }
  const [first, second, third, fourth, fifth] = parts;
  const search = new URLSearchParams(query);
  if (parts.length === 0) return { screen: 'projects' };
  if (first === 'tools' && parts.length === 1) return { screen: 'tools' };
  if (first === 'tools' && parts.length === 2 && second && findToolType(second)) {
    return { screen: 'tools', tool: second };
  }
  if (first === 'catalog' && parts.length === 1) return { screen: 'catalog' };
  if (first === 'trash' && parts.length === 1) return { screen: 'trash' };
  if (first === 'workshop' && parts.length === 1) return { screen: 'workshop' };
  if (first === 'glossary' && parts.length === 1) return { screen: 'glossary' };
  if (first === 'glossary' && parts.length === 2 && second && findGlossaryEntry(second)) {
    return { screen: 'glossary', term: second };
  }
  if (first !== 'projects' || parts.length > 5) return { screen: 'not-found' };
  if (second === undefined) return { screen: 'projects' };
  if (second === 'new' && parts.length === 2) {
    const templateId = search.get('template');
    if (!templateId) return { screen: 'pick-template' };
    const start = startOf(search);
    return start
      ? { screen: 'new-project', templateId, start }
      : { screen: 'new-project', templateId };
  }
  if (!PROJECT_ID.test(second)) return { screen: 'not-found' };
  if (third === undefined) return project(second, undefined, null);
  if (third === 'edit' && parts.length === 3) {
    const from = search.get('from');
    const field = search.get('field');
    return {
      screen: 'edit-project',
      id: second,
      ...(isPlanSection(from) || from === 'shop' || from === 'build' ? { from } : {}),
      ...(field ? { field } : {}),
    };
  }
  if (isPlanSection(third)) {
    return parts.length === 3
      ? project(
          second,
          third,
          search.get('part'),
          third === 'diagrams' ? search.get('group') : null,
        )
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
  if (project && PROJECT_ID.test(project)) return { kind: 'project', id: project };
  if (search.has('questions')) return { kind: 'questions' };
  return search.has('empty') ? { kind: 'empty' } : undefined;
}

function project(
  id: string,
  section: PlanSectionId | undefined,
  part: string | null,
  group: string | null = null,
): Route {
  return {
    screen: 'project',
    id,
    ...(section ? { section } : {}),
    ...(part ? { part } : {}),
    ...(group ? { group } : {}),
  };
}

export function href(route: Exclude<Route, { screen: 'not-found' }>): string {
  switch (route.screen) {
    case 'projects':
      return '#/projects';
    case 'pick-template':
      return '#/projects/new';
    case 'new-project': {
      const start =
        route.start?.kind === 'example'
          ? `&example=${route.start.index}`
          : route.start?.kind === 'project'
            ? `&project=${encodeURIComponent(route.start.id)}`
            : route.start?.kind === 'questions'
              ? '&questions'
              : route.start?.kind === 'empty'
                ? '&empty'
                : '';
      return `#/projects/new?template=${encodeURIComponent(route.templateId)}${start}`;
    }
    case 'project': {
      const section = route.section ? `/${encodeURIComponent(route.section)}` : '';
      const query = new URLSearchParams({
        ...(route.part ? { part: route.part } : {}),
        ...(route.group ? { group: route.group } : {}),
      }).toString();
      return `#/projects/${encodeURIComponent(route.id)}${section}${query ? `?${query}` : ''}`;
    }
    case 'edit-project': {
      const query = new URLSearchParams({
        ...(route.from ? { from: route.from } : {}),
        ...(route.field ? { field: route.field } : {}),
      }).toString();
      return `#/projects/${encodeURIComponent(route.id)}/edit${query ? `?${query}` : ''}`;
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
    case 'trash':
      return '#/trash';
    case 'workshop':
      return '#/workshop';
  }
}

export function navigate(route: Exclude<Route, { screen: 'not-found' }>) {
  leaveGate.pass(href(route));
}

/** Goes to `route` in place of the current entry, so Back skips the one left. */
export function redirect(route: Exclude<Route, { screen: 'not-found' }>) {
  const target = href(route);
  leaveGate.allow(target);
  window.location.replace(target);
}

/** The frame's places, in the sidebar's order (#356). */
export const PLACES = ['projects', 'workshop'] as const;
export type PlaceId = (typeof PLACES)[number];

const IN_WORKSHOP: readonly Route['screen'][] = ['workshop', 'tools', 'glossary', 'trash'];

/** The place a screen is in. Every screen not in Workshop belongs to Projects. */
export function placeOf(route: Route): PlaceId {
  return IN_WORKSHOP.includes(route.screen) ? 'workshop' : 'projects';
}

/** True for Shopping and Building, which fill the screen under their own bar (#61). */
export function isMode(route: Route): boolean {
  return ['shop', 'build', 'build-steps', 'build-step', 'build-part'].includes(route.screen);
}

export type RouteChange = (from: Route, to: Route, update: () => void) => void;

const changeAtOnce: RouteChange = (_from, _to, update) => update();

/**
 * The route the address names, following it as it changes. `change` runs each change, such as
 * to play it as a move (lib/moves.ts); it must call `update` once.
 */
export function useRoute(change: RouteChange = changeAtOnce): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    let shown = window.location.hash;
    let current = parseRoute(shown);
    const update = () => {
      if (!leaveGate.follow(shown)) return;
      shown = window.location.hash;
      const next = parseRoute(shown);
      const from = current;
      current = next;
      change(from, next, () => setRoute(next));
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [change]);
  return route;
}
