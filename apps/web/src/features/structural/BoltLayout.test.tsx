import { createSnapshot, findTemplate, type TemplateDefinition } from '@kerf/core';
import { VERDICT_WORDS } from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { planOf } from '../../lib/plan.ts';
import { render, renderText } from '../../test/render.tsx';
import { BoltLayout } from './BoltLayout.tsx';

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = template.examples[0];
const snapshot = createSnapshot(template, example?.params, example?.structuralInputs);
if (!snapshot.ok) throw new Error('worked example should generate');
const plan = planOf(template.id, JSON.parse(JSON.stringify(snapshot.output.outputs)));
if (!plan.ok) throw new Error(plan.message);
const joints = plan.plan.boltLayout;

describe('the bolt layout, worked example', () => {
  const text = renderText(<BoltLayout joints={joints} />);

  it('gives each joint one line: its bolts, and whether any distance is outside NDS 2024 (#359)', () => {
    expect(text).toContain('Crossbar to leg 1 of 6 distances outside an NDS 2024 value 2 × 1/2"');
    expect(text).toContain('Gusset to leg 2 of 10 distances outside an NDS 2024 value 2 × 1/2"');
    expect(text).toContain('Leg to beam Every distance within its NDS 2024 values 1 × 1/2"');
    expect(render(<BoltLayout joints={joints} />).match(/data-variant="line"/g)).toHaveLength(3);
  });

  it('gives each distance in inches and bolt diameters, with the rows it is measured against', () => {
    expect(text).toContain(
      `Crossbar end distance, along the grain on each bolt's line 3-1/2" 7.0D`,
    );
    expect(text).toContain(
      '7D (3-1/2") for full design value (C∆ = 1.0), bolt bearing toward the end, softwood',
    );
  });

  it('says in words which rows a distance is under, so the mark is not only bold', () => {
    expect(text).toContain(
      'Leg edge distance 1-3/4" 3.5D Under: 4D (2") for minimum, the edge the load pushes toward',
    );
    // The beam's weight pushes the gusset's bolts toward its top edge (#456).
    expect(text).toContain(
      `Gusset edge distance under the beam's weight, to the top edge 1-13/16" 3.6D Under: 4D (2") for minimum, the edge the load pushes toward`,
    );
    expect(text).not.toMatch(VERDICT_WORDS);
    expect(text).not.toMatch(/\bOK\b/);
  });

  it('shows nothing for a plan made before bolt layouts', () => {
    expect(renderText(<BoltLayout joints={[]} />)).toBe('');
  });
});
