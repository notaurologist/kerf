import {
  findTemplate,
  geometry,
  type Inventory,
  planSteps,
  progressSummary,
  projectDrawings,
  readSnapshot,
  TEMPLATES,
} from '@kerf/core';
import fixtures from '../../../../packages/core/src/templates/swing-set-a-frame/snapshots/v1.json';
import type { DrawingsState } from '../lib/drawings.ts';
import type { Ticks } from '../lib/ticks.ts';
import type { Project } from '../lib/types.ts';

/** Ticks for a component rendered on its own: nothing ticked or waiting, and nothing sent. */
export const noTicks: Ticks = {
  done: new Set(),
  waiting: new Set(),
  status: null,
  problem: null,
  dropped: null,
  offline: false,
  isDone: () => false,
  isWaiting: () => false,
  set: () => {},
  ticked: () => [],
};

// Stored snapshots from core's committed fixture (decision 0014), upgraded to the current shape
// and wrapped as the API returns a project: the worked example with every input, the same with
// none, and a two-ply beam on pads.

export const storedSnapshots = fixtures.map((stored) => {
  const read = readSnapshot(TEMPLATES, stored);
  if (!read.ok) throw new Error(read.message);
  return read.snapshot as NonNullable<Project['snapshot']>;
});

export function projectFrom(
  snapshot: Project['snapshot'],
  overrides: Partial<Project> = {},
): Project {
  return {
    id: '6f1c2a3e-0000-4000-8000-000000000001',
    name: 'Backyard swing set',
    status: 'planned',
    templateId: 'swing-set-a-frame',
    templateVersion: 1,
    revision: 1,
    templateBehind: false,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
    snapshot,
    version: { status: 'current', version: 1 },
    // As the API sends them: chosen from the inventory, here with no tools.
    steps: snapshot ? stepsFor(snapshot, { tools: [] }) : null,
    ticks: [],
    progress: snapshot ? summaryFor(snapshot, overrides.ticks ?? []) : null,
    ...overrides,
  } as Project;
}

/** The progress summary as the API sends it, counted by core from the ticks. */
function summaryFor(snapshot: NonNullable<Project['snapshot']>, ticks: Project['ticks']) {
  const template = findTemplate(snapshot.templateId);
  const outputs = template?.storedOutputs.safeParse(snapshot.outputs);
  return template && outputs?.success ? progressSummary(template, outputs.data, ticks) : null;
}

/** The plan's drawings as the API sends them, drawn by core, through JSON, and parsed. */
export function drawingsFor(snapshot: Project['snapshot']): geometry.Drawings | null {
  const template = snapshot && findTemplate(snapshot.templateId);
  if (!snapshot || !template) return null;
  const outputs = template.storedOutputs.safeParse(snapshot.outputs);
  if (!outputs.success) return null;
  return geometry.Drawings.parse(
    JSON.parse(JSON.stringify(projectDrawings(template, outputs.data))),
  );
}

/** A project's drawings once a screen has loaded them, as `useDrawings` gives them. */
export function loadedDrawings(
  project: Project,
  drawings = drawingsFor(project.snapshot),
): DrawingsState {
  return { state: 'ready', value: drawings };
}

/** Build steps as the API sends them: chosen by core from an inventory, through JSON. */
export function stepsFor(snapshot: NonNullable<Project['snapshot']>, inventory: Inventory) {
  const template = findTemplate(snapshot.templateId);
  if (!template) return null;
  const outputs = template.storedOutputs.safeParse(snapshot.outputs);
  return outputs.success
    ? JSON.parse(JSON.stringify(planSteps(template, outputs.data, inventory)))
    : null;
}
