import { createSnapshot, TEMPLATES } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { cutListPartId } from '../../lib/show.ts';
import type { Project } from '../../lib/types.ts';
import { projectFrom } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from './ProjectScreen.tsx';

// Each expert check sits with what it is about (#356): on the parts it concerns in the cut list,
// and on one build step. None is lost on the way, in either template.

describe.each(TEMPLATES.map((t) => [t.id, t] as const))(
  'expert checks in context: %s',
  (id, template) => {
    const example = template.examples[0];
    if (!example) throw new Error(`${id} has no worked example`);
    const made = createSnapshot(template, example.params, example.structuralInputs);
    if (!made.ok) throw new Error(`${id} worked example does not generate`);
    const snapshot = JSON.parse(JSON.stringify(made.output)) as NonNullable<Project['snapshot']>;
    const project = projectFrom(snapshot, { templateId: id });
    const html = render(<ProjectView project={project} />);
    const plan = template.plan(made.output.outputs as never);
    const cutList = sectionOf(html, 'cut-list');
    const steps = textOf(sectionOf(html, 'build-steps'));

    it('has expert checks to place', () => {
      expect(plan.flags.length).toBeGreaterThan(0);
    });

    it('shows each one on every cut-list part it concerns', () => {
      for (const flag of plan.flags) {
        for (const partId of flag.partIds) {
          expect(cutList).toContain(`id="${cutListPartId(partId)}"`);
          // The part's row, then the details row beneath it (#360).
          const row = cutList.slice(cutList.indexOf(`id="${cutListPartId(partId)}"`));
          const end = row.indexOf('</tr>', row.indexOf('</tr>') + 1);
          const own = row.slice(0, end);
          expect(textOf(own), `${flag.ask} on ${partId}`).toContain(flag.ask);
        }
      }
    });

    it('shows each one on a build step', () => {
      for (const flag of plan.flags) expect(steps).toContain(flag.ask);
    });

    it('keeps a part’s checks in its details, closed until opened', () => {
      expect(cutList).not.toContain('k-callout" data-tone="flag"></div>');
      expect(cutList.match(/data-details="" hidden=""/g)?.length).toBe(plan.cutList.length);
    });
  },
);
