// @vitest-environment happy-dom
import { createSnapshot, findTemplate, type geometry, type TemplateDefinition } from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('the move between the assembled and exploded views', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const wrapOf = (container: HTMLElement, label: RegExp) =>
    [...container.querySelectorAll<HTMLElement>('.k-diagram-wrap')].find((w) =>
      label.test(w.querySelector('svg')?.getAttribute('aria-label') ?? ''),
    ) as HTMLElement;
  const press = (container: HTMLElement, name: string) =>
    act(() => {
      byText(container, 'button', name).click();
    });
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('slides the parts out, then shows the letters', () => {
    vi.useFakeTimers();
    const { container } = mount(section());
    const exploded = wrapOf(container, /^Exploded view/);
    press(container, 'Exploded');
    // Shown at once with every part home and no letters, jumping there without a transition.
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    expect(exploded.dataset.collapsed).toBe('true');
    expect(exploded.dataset.instant).toBe('true');
    expect(exploded.dataset.labels).toBe('hidden');
    advance(20);
    expect(exploded.dataset.collapsed).toBeUndefined();
    expect(exploded.dataset.instant).toBeUndefined();
    expect(exploded.dataset.labels).toBe('hidden');
    advance(400);
    expect(exploded.dataset.labels).toBeUndefined();
  });

  it('slides the parts home, then shows the assembled view with its letters', () => {
    vi.useFakeTimers();
    const { container } = mount(section());
    press(container, 'Exploded');
    advance(500);
    press(container, 'Assembled');
    const exploded = wrapOf(container, /^Exploded view/);
    const assembled = wrapOf(container, /^Isometric view/);
    // The button follows at once; the exploded drawing stays while its parts slide home.
    expect(byText(container, 'button', 'Assembled').getAttribute('aria-pressed')).toBe('true');
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    expect(exploded.dataset.collapsed).toBe('true');
    expect(exploded.dataset.instant).toBeUndefined();
    expect(exploded.dataset.labels).toBe('hidden');
    advance(399);
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    advance(1);
    expect(onScreen(container).label).toMatch(/^Isometric view\. /);
    expect(assembled.dataset.labels).toBe('hidden');
    advance(20);
    expect(assembled.dataset.labels).toBeUndefined();
  });

  it('swaps at once under reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList,
    );
    const { container } = mount(section());
    press(container, 'Exploded');
    const exploded = wrapOf(container, /^Exploded view/);
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    expect(exploded.dataset.collapsed).toBeUndefined();
    expect(exploded.dataset.labels).toBeUndefined();
    press(container, 'Assembled');
    expect(onScreen(container).label).toMatch(/^Isometric view\. /);
    expect(wrapOf(container, /^Isometric view/).dataset.labels).toBeUndefined();
  });

  it('draws both views in one frame, so nothing rescales during a move', () => {
    const { container } = mount(section());
    const boxes = [...container.querySelectorAll('.k-views__view svg')].map((s) =>
      s.getAttribute('viewBox'),
    );
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBe(boxes[1]);
  });

  it('gives each moved part’s shapes the way back to where it sits assembled', () => {
    const { container } = mount(section());
    const exploded = wrapOf(container, /^Exploded view/);
    for (const move of worked.exploded?.moves ?? []) {
      const shapes = [...exploded.querySelectorAll<HTMLElement>('[data-moves]')].filter(
        (g) => g.querySelector(`[data-part="${move.partId}"]`) !== null,
      );
      expect(shapes.length, move.partId).toBeGreaterThan(0);
    }
    const beam = worked.exploded?.moves?.find((m) => m.partId === 'beam');
    const beamShape = [...exploded.querySelectorAll<HTMLElement>('[data-moves]')].find(
      (g) => g.querySelector('[data-part="beam"]') !== null,
    );
    expect(beamShape?.style.getPropertyValue('--move-y')).toBe(`${-(beam?.by.y ?? 0)}px`);
    // Guidelines stay put; they fade instead.
    for (const line of exploded.querySelectorAll('[data-role="guideline"]')) {
      expect(line.closest('[data-moves]')).toBeNull();
    }
  });
});
