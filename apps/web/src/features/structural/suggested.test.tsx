import {
  createSnapshot,
  findTemplate,
  readSnapshot,
  type SuggestedValue,
  suggestedItems,
  TEMPLATES,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import type { Suggested } from '../../lib/suggested.ts';
import type { Project } from '../../lib/types.ts';
import { loadedDrawings, noTicks, projectFrom } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from '../project/ProjectScreen.tsx';
import { BoltLayout } from './BoltLayout.tsx';
import { StructuralReview } from './StructuralReview.tsx';

// Suggested values in the structural review (#417): listed under To do with a tick each, and named
// by every result that uses one not yet confirmed. The worked example enters 240 and a 1/2" leg
// bolt; here they stand as Kerf's suggestions.

const swingSet = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = swingSet.examples[0];
const made = createSnapshot(swingSet, example?.params, example?.structuralInputs);
if (!made.ok) throw new Error('worked example should generate');
const read = readSnapshot(TEMPLATES, JSON.parse(JSON.stringify(made.output)));
if (!read.ok) throw new Error(read.message);
const complete = read.snapshot as NonNullable<Project['snapshot']>;

const limit: SuggestedValue = {
  from: 'structuralInputs',
  path: 'deflectionLimit',
  basis: { kind: 'source', citation: 'International Building Code (2021), Table 1604.3' },
  confirmed: false,
};
const bolt: SuggestedValue = {
  from: 'params',
  path: 'hardware.legBoltDiameter',
  basis: { kind: 'source', citation: 'NDS 2024, Tables 12.5.1A to 12.5.1D' },
  confirmed: false,
};

const withSuggested = (suggested: SuggestedValue[]) => ({ ...complete, suggested });
const review = (suggested: SuggestedValue[]) => {
  const project = projectFrom(withSuggested(suggested));
  const html = sectionOf(
    render(<ProjectView project={project} drawings={loadedDrawings(project)} />),
    'structural-review',
  );
  return { html, text: textOf(html) };
};

describe('the structural review with suggested values', () => {
  const { html, text } = review([limit, bolt]);

  it('lists each under To do, unticked, counted as open', () => {
    expect(text).toContain('Suggested values');
    expect(text).toContain('Deflection limit (span divided by) 240');
    expect(text).toContain(
      'Suggested by Kerf, not confirmed yet. Source: International Building Code (2021), Table 1604.3.',
    );
    expect(text).toContain('Leg-to-beam bolt diameter 1/2"');
    expect(html.match(/<input type="checkbox"(?![^>]*checked)[^>]*>/g)?.length).toBeGreaterThan(1);
  });

  it('labels the deflection margin as using a suggested value, and gives its basis in the working', () => {
    expect(html).toContain('margin 2.7x, with a suggested value');
    expect(text).toContain(
      'Uses a suggested value not confirmed yet: Deflection limit (span divided by), 240.',
    );
    expect(text).toContain(
      'Deflection limit, span divided by (Suggested by Kerf, not confirmed yet. Source: International Building Code (2021), Table 1604.3.)',
    );
    // The strength checks do not use the limit.
    expect(html).toContain('margin 1.0x</span>');
  });

  it('marks the leg-to-beam bolt as suggested in the bolt layout', () => {
    expect(text).toContain(
      'Leg to beam Every distance within its NDS 2024 values 1 × 1/2", suggested',
    );
    expect(text).toContain(
      'Suggested by Kerf, not confirmed yet: Leg-to-beam bolt diameter, 1/2". Confirm it under To do, or change it in Edit.',
    );
  });

  it('drops the label once confirmed, and names the basis as confirmed', () => {
    const confirmed = review([{ ...limit, confirmed: true }]);
    expect(confirmed.html).not.toContain('with a suggested value');
    expect(confirmed.text).toContain('Suggested by Kerf, confirmed by you.');
    expect(confirmed.html).toMatch(/<input type="checkbox"[^>]*checked/);
  });

  it('says nothing of suggestions for a plan whose values were all entered', () => {
    const entered = review([]);
    expect(entered.text).not.toContain('Suggested values');
    expect(entered.text).toContain('Deflection limit, span divided by (Entered)');
  });
});

describe('ticking a suggested value', () => {
  const items = suggestedItems(swingSet.form, withSuggested([limit]));
  const calls: [string, boolean][] = [];
  const suggested: Suggested = {
    items,
    sending: new Set(),
    problem: 'Changed on another device. Reload to see the newer plan, then tick it again.',
    set: (item, done) => calls.push([item.key, done]),
  };
  const text = textOf(
    render(
      <StructuralReview
        inputHref={() => '#'}
        checks={[]}
        flags={[]}
        checklist={[]}
        ticks={noTicks}
        suggested={suggested}
      />,
    ),
  );

  it('counts it as open, and says why the last tick did not go through', () => {
    expect(text).toContain('To do · 1');
    expect(text).toContain('Changed on another device.');
  });

  it('shows no bolt layout when there are no joints', () => {
    expect(textOf(render(<BoltLayout joints={[]} suggested={items} />))).toBe('');
  });
});
