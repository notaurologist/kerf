import {
  findTemplate,
  type Inventory,
  planSteps,
  progressSummary,
  projectDrawings,
  readSnapshot,
  TEMPLATES,
} from '@kerf/core';
import fixtures from '../../../../packages/core/src/templates/swing-set-a-frame/snapshots/v1.json';
import type { Project } from '../lib/types.ts';

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
    templateBehind: false,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
    snapshot,
    version: { status: 'current', version: 1 },
    // As the API sends them: drawn by core from the stored snapshot.
    drawings: snapshot ? drawingsFor(snapshot) : null,
    // As the API sends them: chosen from the inventory, here with no tools.
    steps: snapshot ? stepsFor(snapshot, { tools: [], other: [] }) : null,
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

function drawingsFor(snapshot: NonNullable<Project['snapshot']>) {
  const template = findTemplate(snapshot.templateId);
  if (!template) return null;
  const outputs = template.storedOutputs.safeParse(snapshot.outputs);
  if (!outputs.success) return null;
  return JSON.parse(JSON.stringify(projectDrawings(template, outputs.data)));
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
