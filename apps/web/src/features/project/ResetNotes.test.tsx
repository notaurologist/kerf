import {
  createSnapshot,
  progressItems,
  progressToReset,
  recordResets,
  resetNotes,
  TEMPLATES,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { indexChanges } from '../../lib/changes.tsx';
import { planOf } from '../../lib/plan.ts';
import type { Project } from '../../lib/types.ts';
import { loadedDrawings, projectFrom } from '../../test/projects.ts';
import { renderText } from '../../test/render.tsx';
import { ModeView } from '../modes/modes.tsx';
import { PreviewPane, WhatChanges } from '../project-editor/Preview.tsx';
import { ProjectView } from './ProjectScreen.tsx';

// A change made mid-build (#444) on the worked example: the first front leg cut at 138-3/8", the
// 4x6 beam board bought, then the beam changed to a 4x8, which makes the leg 140-3/16". The notes
// are core's, as the API sends them; this checks where they show.

const template = TEMPLATES[0];
const example = template?.examples[0];
if (!template || !example) throw new Error('no worked example');

const { params, structuralInputs } = example;

function generate(beamStock: string) {
  const made = createSnapshot(
    template as NonNullable<typeof template>,
    { ...(params as object), beamStock },
    structuralInputs,
  );
  if (!made.ok) throw new Error('worked example does not generate');
  return JSON.parse(JSON.stringify(made.output)) as NonNullable<Project['snapshot']>;
}
const before = generate('4x6');
const after = generate('4x8');
const outputs = (s: typeof before) => template.storedOutputs.parse(s.outputs);
const reset = progressToReset(
  [
    { kind: 'part', key: 'leg-front/0' },
    { kind: 'shopping-line', key: 'lumber/4x6/12' },
  ],
  progressItems(template, outputs(before)),
  progressItems(template, outputs(after)),
);
const notes = resetNotes(template, outputs(after), recordResets(template, outputs(before), reset));
const resets = notes.map((n) => ({ ...n, resetAt: '2026-11-03T12:00:00.000Z' }));
const project = projectFrom(after, { status: 'in-progress', resets });

const LEG =
  'C Front leg (downhill), piece 1: cut at 138-3/8", now 140-3/16". It is 1-7/8" short. Cut a new one from another board: the shopping list adds a 4x4 × 12\' 0" for it.';
const BEAM = '4x6 × 12\' 0": bought 1; no longer in the plan.';

describe('notes on work a change cleared', () => {
  it('list every one on the plan, with Dismiss', () => {
    const text = renderText(<ProjectView project={project} drawings={loadedDrawings(project)} />);
    expect(text).toContain('Done before a change to the plan.');
    expect(text).toContain(LEG);
    expect(text).toContain(BEAM);
    expect(text).toContain('Dismiss notes');
    // The shopping list adds a board for the leg cut short.
    expect(text).toContain(
      'Also buy, for pieces cut before a change and now too short: 1 x 4x4, 12\' 0" for C Front leg (downhill), piece 1.',
    );
  });

  it('show on the step that cuts the piece, and not on other steps', () => {
    const on = (step: string) =>
      renderText(
        <ModeView
          route={{ screen: 'build-step', id: project.id, step }}
          project={project}
          drawings={loadedDrawings(project)}
        />,
      );
    const step2 = on('board-2');
    expect(step2).toContain(LEG);
    expect(step2).not.toContain(BEAM);
    expect(step2).toContain('Dismiss note');
    expect(on('board-3')).not.toContain('Done before a change');
  });

  it('show in Shopping with the board to buy for the piece cut short', () => {
    const text = renderText(
      <ModeView
        route={{ screen: 'shop', id: project.id }}
        project={project}
        drawings={loadedDrawings(project)}
      />,
    );
    expect(text).toContain(BEAM);
    expect(text).toContain(LEG);
    expect(text).toContain('Replacements 1 × 4x4, 12\' 0", for C Front leg (downhill), piece 1');
  });

  it('are listed in the preview before saving', () => {
    const plan = planOf(template.id, after.outputs, after.suggested);
    if (!plan.ok) throw new Error(plan.message);
    const state = {
      kind: 'ready' as const,
      plan: plan.plan,
      changes: indexChanges([]),
      truncated: false,
      resets: notes,
    };
    for (const text of [
      renderText(<WhatChanges state={state} />),
      renderText(<PreviewPane saved={plan.plan} state={state} />),
    ]) {
      expect(text).toContain('Saving clears marks on work already done.');
      expect(text).toContain(LEG);
      expect(text).toContain(BEAM);
    }
  });
});
