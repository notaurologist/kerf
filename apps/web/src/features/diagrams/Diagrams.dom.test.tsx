// @vitest-environment happy-dom
import { createSnapshot, findTemplate, type geometry, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { readDrawings, readPlan } from '../../lib/plan.ts';
import { byText, click, mount } from '../../test/dom.tsx';
import { projectFrom } from '../../test/projects.ts';
import { Diagrams } from './Diagrams.tsx';

// A plan made now, with placements; the stored fixtures predate them.
const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = template.examples[0];
const made = createSnapshot(template, example?.params, example?.structuralInputs);
if (!made.ok) throw new Error('worked example should generate');
const project = projectFrom(JSON.parse(JSON.stringify(made.output)));
const plan = readPlan(project);
const drawings = readDrawings(project);
if (!plan.ok || !drawings?.isometric || !drawings.exploded) {
  throw new Error('the worked example has an assembled and an exploded view');
}
const rows = plan.plan.cutList;
const selected = rows[0]?.partId ?? null;
const worked: geometry.Drawings = drawings;

function section(d = worked) {
  return (
    <Diagrams
      drawings={d}
      rows={rows}
      describedBy="cut-list"
      selected={selected}
      onSelect={() => {}}
      partHref={(id) => `#/projects/abc/cut-list?part=${id}`}
    />
  );
}

/** The assembly drawing on screen: its label, and whether the selected part is highlighted. */
function onScreen(container: HTMLElement) {
  const views = [...container.querySelectorAll<HTMLElement>('.k-views__view')];
  const shown = views.filter((v) => !v.hidden);
  expect(shown).toHaveLength(1);
  const svg = shown[0]?.querySelector('svg[role="img"]');
  return {
    label: svg?.getAttribute('aria-label') ?? '',
    highlighted: (svg?.querySelectorAll('[data-selected]').length ?? 0) > 0,
  };
}

describe('the Diagrams section’s assembly view', () => {
  it('opens on the assembled view with the selected part highlighted', () => {
    const { container } = mount(section());
    const view = onScreen(container);
    expect(view.label).toMatch(/^Isometric view\. /);
    expect(view.highlighted).toBe(true);
  });

  it('keeps the part selected, and the label follows the view, when switched', async () => {
    const { container } = mount(section());
    await click(byText(container, 'button', 'Exploded'));
    const view = onScreen(container);
    expect(view.label).toMatch(/^Exploded view\. /);
    expect(view.highlighted).toBe(true);
  });

  it('keeps both views in the page for print', () => {
    const { container } = mount(section());
    const labels = [...container.querySelectorAll('.k-views__view svg[role="img"]')].map(
      (s) => s.getAttribute('aria-label')?.split('.')[0],
    );
    expect(labels).toEqual(['Isometric view', 'Exploded view']);
    expect([...container.querySelectorAll('.k-views__heading')].map((h) => h.textContent)).toEqual([
      'Assembled',
      'Exploded',
    ]);
  });

  it('shows a template’s only assembly drawing with no control', () => {
    const { container } = mount(section({ ...worked, exploded: null }));
    expect(container.querySelector('.k-views [role="group"]')).toBeNull();
    expect(container.querySelector('.k-views svg')?.getAttribute('aria-label')).toMatch(
      /^Isometric view\. /,
    );
  });
});
