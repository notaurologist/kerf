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

describe('board cards (#59)', () => {
  const p = project();
  const text = renderText(<ModeView route={{ screen: 'shop', id: p.id }} project={p} />);
  const html = render(<ModeView route={{ screen: 'shop', id: p.id }} project={p} />);

  it('open under each lumber line', () => {
    expect(text.match(/The boards?, and what to look for/g)).toHaveLength(4);
    expect(text).toContain(`4 × 4x4, 12' 0" The boards, and what to look for`);
  });

  it('draw each board of the line with its pieces and offcut', () => {
    // The worked example's 4x4 boards are boards 2 to 5, one leg each.
    for (const n of [2, 3, 4, 5]) expect(text).toContain(`Board ${n}: 4x4, 12' 0"`);
    expect(text).toContain(`Board 1: 4x6, 12' 0"`);
    expect(text).toContain('A Beam 120" Offcut 22-7/8".');
    expect(html.match(/class="k-diagram-wrap"/g)).toHaveLength(7);
  });

  it('say what to look for in the boards of that line only', () => {
    const beamCard = text.slice(text.indexOf('Board 1:'), text.indexOf('Board 2:'));
    expect(beamCard).toContain('What to look for');
    expect(beamCard).toContain('For: Beam.');
    expect(beamCard).not.toContain('leg');
  });
});

describe('Building mode', () => {
  it('shows a cutting step: its board drawn, trim and kerf, each piece at glance size (#118)', () => {
    const p = project([{ kind: 'part', key: 'crossbar/0' }]);
    const route = { screen: 'build-step' as const, id: p.id, step: 'board-6' };
    const text = renderText(<ModeView route={route} project={p} />);
    const html = render(<ModeView route={route} project={p} />);
    expect(text).toContain('Building · Backyard swing set Exit');
    expect(text).toContain('Step 6 of 11 · Cutting All steps');
    expect(text).toContain("Cut board 6, a 2x6 10' long");
    expect(text).toContain('Trim 1/2" off the factory end to square it');
    expect(text).toContain('Each saw cut takes 1/8"');
    // Both crossbars, each with its tick, its length to cut, and its cut card.
    expect(text).toContain('D Crossbar, piece 1 of 2 cut 59" Cut card');
    expect(text).toContain('D Crossbar, piece 2 of 2 cut 59" Cut card');
    expect(html.match(/class="k-glance"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain(`href="#/projects/${p.id}/build/board-6/crossbar"`);
    // The board's drawing sits beside the step from the 8-column width.
    expect(html).toContain('class="l-switcher"');
    expect(html).toContain('A 2x6 board 10');
    expect(text).toContain('Back Done, next');
  });

  it('shows an assembly step with its methods and flags, and no board', () => {
    const p = project();
    const route = { screen: 'build-step' as const, id: p.id, step: 'frames' };
    const text = renderText(<ModeView route={route} project={p} />);
    const html = render(<ModeView route={route} project={p} />);
    expect(text).toContain('Step 10 of 11 All steps');
    expect(text).not.toContain('Cutting');
    expect(text).not.toContain('Trim 1/2"');
    // The bolted joints' expert checks (#51), on the step that drills for them.
    expect(text).toContain('Expert check');
    expect(text).toContain('Crossbar to leg, 2 1/2" bolts');
    expect(html).not.toContain('class="k-glance"');
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

  it('opens a piece’s cut card: the length largest, each end as a saw setting (#118)', () => {
    const p = project([{ kind: 'part', key: 'crossbar/1' }]);
    const route = { screen: 'build-part' as const, id: p.id, step: 'board-6', part: 'crossbar' };
    const text = renderText(<ModeView route={route} project={p} />);
    const html = render(<ModeView route={route} project={p} />);
    expect(text).toContain('Step 6 of 11 · Cutting All steps');
    expect(text).toContain(
      `D Crossbar 2x6 (1-1/2" x 5-1/2"). Cut 2. From board 6, a 2x6 10' 0" long.`,
    );
    expect(text).toContain('Length, long point to long point 59"');
    // Each end: the saw setting boxed, the angle to the edge smaller (Stage 3, SawSetting).
    expect(text.match(/End \d Saw at 20\.0° To the edge 70\.0°/g)).toHaveLength(2);
    expect(text).toContain('The ends mirror each other.');
    expect(text).toContain('Top edge: 55"');
    expect(text).toContain('Bottom edge: 59"');
    expect(text).toContain('Fastened to the outside face of the legs.');
    expect(text).toContain('Piece 1 of 2 cut');
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('<svg');
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
