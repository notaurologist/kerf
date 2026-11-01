import { describe, expect, it } from 'vitest';
import { woodMovement } from '../movement/movement.ts';
import { planDigests } from './digests.ts';
import type { Plan } from './plan.ts';

// The structural review's digest with movement estimates, on a made-up plan. The swing set's
// digests are tested in its folder.

const plan = (movement: Plan['movement']): Plan => ({
  keyResults: [],
  cutList: [],
  lumber: {
    boards: [],
    kerf: 0.125,
    trimPerEnd: 0.5,
    lines: [],
    notes: [],
    issues: [],
    selection: [],
  },
  hardware: [],
  hardwareNotes: [],
  flags: [],
  checks: [],
  movement,
  checklist: [],
  boltLayout: [],
  operations: [],
  cutEnds: [],
});

const estimate = (subject: string, species: 'black-cherry' | null) =>
  woodMovement({
    subject,
    width: 15,
    species: species ? { value: species } : { missing: [{ key: 'species', label: 'Species' }] },
    orientation: { value: 'flatsawn' },
    moisture: { value: { low: 6, high: 10 } },
  });

describe('planDigests, structural review', () => {
  it('counts movement estimates, and says how many need inputs', () => {
    expect(planDigests(plan([estimate('Side', 'black-cherry')])).structuralReview).toBe(
      'No structural checks · 1 movement estimate · no expert checks',
    );
    const two = plan([estimate('Side', 'black-cherry'), estimate('Top', null)]);
    expect(planDigests(two).structuralReview).toBe(
      'No structural checks · 2 movement estimates, 1 needs inputs · no expert checks',
    );
  });

  it('says nothing about movement when the plan has none', () => {
    expect(planDigests(plan([])).structuralReview).toBe('No structural checks · no expert checks');
  });
});
