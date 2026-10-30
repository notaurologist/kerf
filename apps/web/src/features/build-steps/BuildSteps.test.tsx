import { createSnapshot, type Inventory, OPERATION_TYPE_LABELS, TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { readSteps } from '../../lib/plan.ts';
import type { Project } from '../../lib/types.ts';
import { projectFrom, stepsFor } from '../../test/projects.ts';
import { renderText } from '../../test/render.tsx';
import { ProjectView } from '../project/ProjectScreen.tsx';

// #52: the shop view needs nothing beyond the project response, so a dropped connection after
// the page loads loses no step. ProjectView renders from that one response and fetches nothing.

const template = TEMPLATES[0];
const example = template?.examples[0];
if (!template || !example) throw new Error('no worked example');
const made = createSnapshot(template, example.params, example.structuralInputs);
if (!made.ok) throw new Error('worked example does not generate');
const snapshot = JSON.parse(JSON.stringify(made.output)) as NonNullable<Project['snapshot']>;

const shop: Inventory = {
  tools: [
    { toolTypeId: 'miter-saw', capabilities: { cutDepth: 4, crosscutWidth: 12, maxMiter: 50 } },
    { toolTypeId: 'tape-measure', capabilities: {} },
  ],
  other: [],
};

function project(inventory: Inventory): Project {
  return projectFrom(snapshot, { steps: stepsFor(snapshot, inventory) });
}

describe('build steps in the project view (#52)', () => {
  it('renders every step and every operation from one project response', () => {
    const p = project(shop);
    const steps = readSteps(p);
    if (!steps) throw new Error('the response has no steps');
    expect(steps.steps.length).toBeGreaterThan(0);
    const text = renderText(<ProjectView project={p} />);
    steps.steps.forEach((step, i) => {
      expect(text).toContain(`${i + 1}. ${step.title}`);
      for (const op of step.operations) {
        expect(text).toContain(OPERATION_TYPE_LABELS[op.operation.type]);
        if (op.method) expect(text).toContain(op.method.name);
        for (const line of op.method?.technique ?? []) expect(text).toContain(line);
      }
      for (const flag of step.flags) expect(text).toContain(flag.ask);
    });
  });

  it('shows the chosen method with its numbers, and what is needed where none fits', () => {
    const text = renderText(<ProjectView project={project(shop)} />);
    // The beam's ends, with the miter saw that cuts through the 4x6.
    expect(text).toContain('Square crosscut: A Beam, end 1');
    expect(text).toContain('With a miter saw. Tools: Miter saw, Tape measure.');
    // The legs' miters at the worked example's 20° splay.
    expect(text).toContain('Set the miter saw to 20.0°, turned the way the cut detail shows.');
    // No drill: the holes name what would allow a method.
    expect(text).toContain('No method fits your tools.');
  });

  it('says which inventory the steps were chosen from, so a stale list can be found', () => {
    const withShop = readSteps(project(shop));
    const withNone = readSteps(project({ tools: [], other: [] }));
    expect(withShop?.inventoryKey).toMatch(/^[0-9a-f]{8}$/);
    expect(withShop?.inventoryKey).not.toBe(withNone?.inventoryKey);
  });

  it('shows no build steps for a plan made before operations', () => {
    const text = renderText(<ProjectView project={projectFrom(snapshot, { steps: null })} />);
    expect(text).not.toContain('Build steps');
  });
});
