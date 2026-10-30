import { createSnapshot, TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { Screen } from '../../App.tsx';
import type { Project } from '../../lib/types.ts';
import { projectFrom } from '../../test/projects.ts';
import { render, renderText } from '../../test/render.tsx';
import { ProjectView } from '../project/ProjectScreen.tsx';
import { ProjectList } from '../projects/ProjectsScreen.tsx';
import { buildingText, resumeTarget, shoppingText } from './ModeCards.tsx';
import { ModeView } from './modes.tsx';

// Shopping and Building (#61) on the worked example, generated now so it has build steps: 4
// lumber and 7 hardware lines, 7 board steps, then ease-edges, site, frames, and beam.

const template = TEMPLATES[0];
const example = template?.examples[0];
if (!template || !example) throw new Error('no worked example');
const made = createSnapshot(template, example.params, example.structuralInputs);
if (!made.ok) throw new Error('worked example does not generate');
const snapshot = JSON.parse(JSON.stringify(made.output)) as NonNullable<Project['snapshot']>;

// Each test uses its own project ID: a project's tick queue lives as long as the page.
let n = 0;
function project(ticks: { kind: Project['ticks'][number]['kind']; key: string }[] = []) {
  n++;
  return projectFrom(snapshot, {
    id: `6f1c2a3e-0000-4000-8000-${String(n).padStart(12, '0')}`,
    status: ticks.length > 0 ? 'in-progress' : 'planned',
    ticks: ticks.map((t) => ({ ...t, doneAt: '2026-10-29T12:00:00.000Z' })),
  });
}

describe('Shopping mode', () => {
  it('ticks each shopping line under the mode bar, with no other navigation', () => {
    const p = project([{ kind: 'shopping-line', key: 'lumber/2x6/10' }]);
    const html = render(<ModeView route={{ screen: 'shop', id: p.id }} project={p} />);
    const text = renderText(<ModeView route={{ screen: 'shop', id: p.id }} project={p} />);
    expect(text).toContain('Shopping · Backyard swing set Exit');
    expect(html).not.toContain('<nav');
    expect(html).toContain(`href="#/projects/${p.id}"`);
    expect(text).toContain('1 of 11 bought.');
    expect(text).toContain(`1 × 2x6, 10' 0"`);
    expect(text).toContain('2 × 1/2" through-bolt, grip 8-15/16"');
    expect(html.match(/type="checkbox"/g)).toHaveLength(11);
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  it('groups the list by where things are in the store, each with its own count (#59)', () => {
    const p = project([
      { kind: 'shopping-line', key: 'lumber/2x6/10' },
      { kind: 'shopping-line', key: 'hardware/Swing hangers' },
    ]);
    const text = renderText(<ModeView route={{ screen: 'shop', id: p.id }} project={p} />);
    const headings = [...text.matchAll(/(Lumber|Bolts and fittings|Swing hardware) (\d+ of \d+)/g)];
    expect(headings.map((m) => `${m[1]} ${m[2]}`)).toEqual([
      'Lumber 1 of 4',
      'Bolts and fittings 0 of 5',
      'Swing hardware 1 of 2',
    ]);
  });
});

describe('Building mode', () => {
  it('shows one step with where you are, its pieces linked to their cut cards, and Done, next', () => {
    const p = project();
    const route = { screen: 'build-step' as const, id: p.id, step: 'board-6' };
    const text = renderText(<ModeView route={route} project={p} />);
    const html = render(<ModeView route={route} project={p} />);
    expect(text).toContain('Building · Backyard swing set Exit');
    expect(text).toContain('Step 6 of 11 All steps');
    expect(text).toContain("Cut board 6, a 2x6 10' long");
    expect(html).toContain(`href="#/projects/${p.id}/build/board-6/crossbar"`);
    expect(text).toContain('Back Done, next');
  });

  it('says a step is done and offers Next instead', () => {
    const p = project([{ kind: 'step', key: 'board-6' }]);
    const text = renderText(
      <ModeView route={{ screen: 'build-step', id: p.id, step: 'board-6' }} project={p} />,
    );
    expect(text).toContain('Step done. Mark not done');
    expect(text).toContain('Back Next');
    expect(text).not.toContain('Done, next');
  });

  it('lists every step with its tick', () => {
    const p = project([
      { kind: 'step', key: 'board-1' },
      { kind: 'step', key: 'board-2' },
    ]);
    const html = render(<ModeView route={{ screen: 'build-steps', id: p.id }} project={p} />);
    const text = renderText(<ModeView route={{ screen: 'build-steps', id: p.id }} project={p} />);
    expect(text).toContain('2 of 11 steps done.');
    expect(text).toContain('11. Bolt');
    expect(html.match(/checked=""/g)).toHaveLength(2);
  });

  it('opens a piece’s cut card: its length to cut, its ends, and its cut detail', () => {
    const p = project();
    const route = { screen: 'build-part' as const, id: p.id, step: 'board-6', part: 'crossbar' };
    const text = renderText(<ModeView route={route} project={p} />);
    const crossbar = (
      snapshot.outputs as { cutList: { partId: string; length: string; ends: string[] }[] }
    ).cutList.find((r) => r.partId === 'crossbar');
    if (!crossbar) throw new Error('no crossbar');
    expect(text).toContain(crossbar.length);
    for (const end of crossbar.ends) expect(text).toContain(end);
    expect(render(<ModeView route={route} project={p} />)).toContain('<svg');
    expect(text).toContain('Back to the step');
  });

  it('says when a link names a step the plan no longer has', () => {
    const p = project();
    const text = renderText(
      <ModeView route={{ screen: 'build-step', id: p.id, step: 'board-9' }} project={p} />,
    );
    expect(text).toContain('This plan has no step "board-9".');
  });

  it('is served without the app header', () => {
    const html = render(<Screen route={{ screen: 'shop', id: 'x' }} />);
    expect(html).toContain('k-modebar');
    expect(html).not.toContain('k-header');
  });
});

describe('the plan’s mode cards', () => {
  it('start each mode, with its progress', () => {
    const text = renderText(<ProjectView project={project()} />);
    expect(text).toContain('Shopping 11 lines, none bought. Start shopping');
    expect(text).toContain('Building 11 steps, not started. Start building');
  });

  it('resume where you left off', () => {
    const p = project([
      { kind: 'shopping-line', key: 'lumber/2x6/10' },
      { kind: 'step', key: 'board-1' },
    ]);
    const text = renderText(<ProjectView project={p} />);
    expect(text).toContain('1 of 11 bought. Open the shopping list');
    expect(text).toContain("Step 2 of 11 next: Cut board 2, a 4x4 12' long. Resume");
    expect(render(<ProjectView project={p} />)).toContain(`href="#/projects/${p.id}/build"`);
  });
});

describe('progress in words', () => {
  const summary = (shopping: [number, number], steps: [number, number], next?: number) => ({
    shopping: { done: shopping[0], total: shopping[1] },
    steps: { done: steps[0], total: steps[1] },
    nextStep: next ? { id: `s${next}`, number: next, title: 'Bolt' } : null,
  });

  it('counts the shopping and the steps', () => {
    expect(shoppingText({ done: 11, total: 11 })).toBe('All 11 lines bought.');
    expect(buildingText(summary([0, 1], [11, 11]))).toBe('All 11 steps done.');
    expect(buildingText(summary([0, 1], [3, 11], 4))).toBe('Step 4 of 11 next: Bolt.');
  });

  it('resumes shopping until it is done or building starts, then the next step', () => {
    const summaryOf = (progress: ReturnType<typeof summary>) => ({
      ...project(),
      status: 'in-progress' as const,
      progress,
    });
    expect(resumeTarget(summaryOf(summary([4, 11], [0, 11], 1)))?.mode).toBe('shopping');
    expect(resumeTarget(summaryOf(summary([11, 11], [0, 11], 1)))).toMatchObject({
      mode: 'building',
      text: 'Step 1 of 11: Bolt.',
    });
    expect(resumeTarget(summaryOf(summary([4, 11], [2, 11], 3)))?.mode).toBe('building');
    expect(resumeTarget(summaryOf(summary([11, 11], [11, 11])))).toBeNull();
    expect(
      resumeTarget({ ...summaryOf(summary([4, 11], [0, 11], 1)), status: 'built' }),
    ).toBeNull();
  });

  it('puts a Resume card above the projects list for a project in progress', () => {
    const p = project([{ kind: 'step', key: 'board-1' }]);
    const other = { ...project([{ kind: 'shopping-line', key: 'lumber/2x6/10' }]), name: 'Other' };
    const text = renderText(
      <ProjectList projects={[p, other]} templates={[]} onStatus={() => {}} />,
    );
    // One card, for the first project in the list (the most recently updated).
    expect(text.match(/Resume /g)).toHaveLength(1);
    expect(text).toContain(
      "Resume building Backyard swing set. Step 2 of 11: Cut board 2, a 4x4 12' long. Go",
    );
    expect(text).toContain('Shopping: 11 lines, none bought. Building: Step 2 of 11 next');
  });
});
