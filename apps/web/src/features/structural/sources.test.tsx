import { designValues, type structural } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { readPlan } from '../../lib/plan.ts';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render } from '../../test/render.tsx';
import { citationsIn, StructuralReview } from './StructuralReview.tsx';

// Issue #10: every value, factor, and formula that carries a citation shows it, linked out.

describe.each(storedSnapshots.map((s, i) => [i, s] as const))(
  'stored example %i',
  (_i, snapshot) => {
    const plan = readPlan(projectFrom(snapshot));
    if (!plan.ok) throw new Error(plan.message);
    const { checks, flags, checklist } = plan.plan;
    const html = render(
      <StructuralReview projectId="p" checks={checks} flags={flags} checklist={checklist} />,
    );

    it('links every citation in the checks to its source', () => {
      for (const c of citationsIn(checks)) {
        const url = c.url ?? designValues.SOURCES[c.source].url;
        expect(url).toMatch(/^https:\/\//);
        expect(html).toContain(`href="${url.replace(/&/g, '&amp;')}"`);
        expect(html).toContain(c.locator.replace(/"/g, '&quot;'));
      }
    });

    it('puts a source control beside each value and factor that has citations', () => {
      const computed = checks.filter(
        (c): c is Extract<structural.CheckResult, { status: 'computed' }> =>
          c.status === 'computed',
      );
      const withSources = computed.flatMap((c) => [
        ...[...c.inputs, ...c.steps, c.computed, c.allowable].filter(
          (q) => (q.sources ?? []).length > 0,
        ),
        ...c.factors.filter((f) => f.sources.length > 0),
      ]);
      expect(html.match(/<details class="source">/g)?.length ?? 0).toBe(withSources.length);
    });
  },
);
