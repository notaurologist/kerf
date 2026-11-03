// @vitest-environment happy-dom
import {
  cornerViews,
  createSnapshot,
  findTemplate,
  type geometry,
  type TemplateDefinition,
} from '@kerf/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPlan } from '../../lib/plan.ts';
import { byText, click, mount } from '../../test/dom.tsx';
import { drawingsFor, projectFrom } from '../../test/projects.ts';
import { drawingInMove } from '../../ui/index.ts';
import { Diagrams } from './Diagrams.tsx';

// A plan made now, with placements; the stored fixtures predate them.
const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = template.examples[0];
const made = createSnapshot(template, example?.params, example?.structuralInputs);
if (!made.ok) throw new Error('worked example should generate');
const project = projectFrom(JSON.parse(JSON.stringify(made.output)));
const plan = readPlan(project);
const drawings = drawingsFor(project.snapshot);
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
  it('opens on the assembled view with the selected part highlighted, and one button to explode it', () => {
    const { container } = mount(section());
    const view = onScreen(container);
    expect(view.label).toMatch(/^Isometric view\. /);
    expect(view.highlighted).toBe(true);
    const buttons = [...container.querySelectorAll('.k-views button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Explode']);
    expect(buttons[0]?.hasAttribute('aria-pressed')).toBe(false);
  });

  it('keeps the part selected, and the label follows the view, when switched', async () => {
    const { container } = mount(section());
    await click(byText(container, 'button', 'Explode'));
    const view = onScreen(container);
    expect(view.label).toMatch(/^Exploded view\. /);
    expect(view.highlighted).toBe(true);
    expect(byText(container, 'button', 'Assemble').hasAttribute('aria-pressed')).toBe(false);
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

  it('shows a template’s only assembly drawing with no button', () => {
    for (const [lone, label] of [
      [{ ...worked, exploded: null }, /^Isometric view\. /],
      [{ ...worked, isometric: null }, /^Exploded view\. /],
    ] as const) {
      const { container } = mount(section(lone));
      expect(container.querySelector('.k-views button')).toBeNull();
      expect(container.querySelector('.k-views svg')?.getAttribute('aria-label')).toMatch(label);
    }
  });

  it('shows no assembly drawing when the template has neither', () => {
    const { container } = mount(section({ ...worked, isometric: null, exploded: null }));
    expect(container.querySelector('.k-views')).toBeNull();
  });
});

describe('the move between the assembled and exploded views', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const clock = () =>
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
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
  const stages = worked.exploded?.stages ?? [];
  /** The parts whose shapes slide now. */
  const sliding = (wrap: HTMLElement) =>
    [
      ...new Set(
        [...wrap.querySelectorAll('[data-moves] [data-part]')].map((e) =>
          e.getAttribute('data-part'),
        ),
      ),
    ].sort();
  const t = (wrap: HTMLElement) => Number(wrap.style.getPropertyValue('--t'));

  it('slides the parts out a stage at a time, then shows the letters', () => {
    clock();
    expect(stages.map((s) => [...new Set(s.moves.map((m) => m.partId))].sort())).toEqual([
      ['beam'],
      ['crossbar', 'gusset'],
    ]);
    const { container } = mount(section());
    const exploded = wrapOf(container, /^Exploded view/);
    press(container, 'Explode');
    // Shown at once with every part home and no letters.
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    expect(exploded.dataset.labels).toBe('hidden');
    expect(sliding(exploded)).toEqual(['beam']);
    expect(t(exploded)).toBe(0);
    advance(200);
    expect(t(exploded)).toBeGreaterThan(0);
    expect(t(exploded)).toBeLessThan(1);
    advance(300);
    expect(sliding(exploded)).toEqual(['crossbar', 'gusset']);
    expect(exploded.dataset.labels).toBe('hidden');
    advance(400);
    expect(exploded.dataset.labels).toBeUndefined();
    expect(exploded.dataset.over).toBe('end');
    expect(t(exploded)).toBe(1);
  });

  it('slides the parts home in the opposite order, then shows the assembled view with its letters', () => {
    clock();
    const { container } = mount(section());
    press(container, 'Explode');
    advance(1000);
    press(container, 'Assemble');
    const exploded = wrapOf(container, /^Exploded view/);
    const assembled = wrapOf(container, /^Isometric view/);
    // The button follows at once; the exploded drawing stays while its parts slide home.
    expect([...container.querySelectorAll('.k-views button')].map((b) => b.textContent)).toEqual([
      'Explode',
    ]);
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    expect(exploded.dataset.labels).toBe('hidden');
    expect(sliding(exploded)).toEqual(['crossbar', 'gusset']);
    advance(500);
    expect(sliding(exploded)).toEqual(['beam']);
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    advance(250);
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    // Frame by frame to the moment the assembled view shows, still without its letters.
    for (let i = 0; i < 10 && /^Exploded/.test(onScreen(container).label); i++) advance(16);
    expect(onScreen(container).label).toMatch(/^Isometric view\. /);
    expect(assembled.dataset.labels).toBe('hidden');
    advance(20);
    expect(assembled.dataset.labels).toBeUndefined();
    // The exploded view waits at rest, as it prints.
    expect(t(exploded)).toBe(1);
  });

  it('turns back from where a move has got to when pressed again', () => {
    clock();
    const { container } = mount(section());
    press(container, 'Explode');
    advance(200);
    press(container, 'Assemble');
    expect(sliding(wrapOf(container, /^Exploded view/))).toEqual(['beam']);
    advance(250);
    expect(onScreen(container).label).toMatch(/^Isometric view\. /);
  });

  it('swaps at once under reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList,
    );
    const { container } = mount(section());
    press(container, 'Explode');
    const exploded = wrapOf(container, /^Exploded view/);
    expect(onScreen(container).label).toMatch(/^Exploded view\. /);
    expect(exploded.dataset.labels).toBeUndefined();
    expect(t(exploded)).toBe(1);
    press(container, 'Assemble');
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

  it('gives each sliding part’s shapes how far it goes in its stage, and leaves guidelines', () => {
    clock();
    const { container } = mount(section());
    press(container, 'Explode');
    const exploded = wrapOf(container, /^Exploded view/);
    const beam = stages[0]?.moves.find((m) => m.partId === 'beam');
    const beamShape = [...exploded.querySelectorAll<HTMLElement>('[data-moves]')].find(
      (g) => g.querySelector('[data-part="beam"]') !== null,
    );
    expect(beamShape?.style.getPropertyValue('--move-y')).toBe(`${beam?.by.y ?? 0}px`);
    // Guidelines stay put; they fade instead.
    for (const line of exploded.querySelectorAll('[data-role="guideline"]')) {
      expect(line.closest('[data-moves]')).toBeNull();
    }
  });
});

describe('the drawing under a move', () => {
  const box = (part: string): geometry.Primitive => ({
    kind: 'polygon',
    role: 'visible',
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    fill: 1,
    part: { partId: part, instance: 0, letter: 'A' },
  });
  const assembled = { ...(worked.isometric as geometry.Drawing), primitives: [box('home')] };
  const exploded: geometry.Drawing = {
    ...(worked.exploded as geometry.Drawing),
    primitives: [box('exploded')],
    stages: [
      { moves: [], from: 0.2, primitives: [box('first')] },
      { moves: [], from: 0 },
    ],
  };
  const under = (stage: number, over: 'start' | 'end') =>
    drawingInMove(assembled, exploded, { stage, over }).primitives.map(
      (p) => p.kind === 'polygon' && p.part?.partId,
    );

  it('is the drawing a stage starts from until its parts leave their joints, then its own', () => {
    expect(under(0, 'start')).toEqual(['home']);
    expect(under(0, 'end')).toEqual(['first']);
    expect(under(1, 'start')).toEqual(['first']);
    expect(under(1, 'end')).toEqual(['exploded']);
  });
});

describe('the corner the views are seen from (#364)', () => {
  const outputs = template.storedOutputs.parse(JSON.parse(JSON.stringify(made.output.outputs)));
  const backRight = JSON.parse(JSON.stringify(cornerViews(template, outputs, 'back-right')));
  const menu = (container: HTMLElement) => {
    const select = container.querySelector<HTMLSelectElement>('.k-views__control select');
    if (!select) throw new Error('no corner menu');
    return select;
  };
  const choose = async (container: HTMLElement, corner: string) => {
    await act(async () => {
      const select = menu(container);
      select.value = corner;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  const withCorners = (load: (c: geometry.Corner) => Promise<unknown>, key = 'abc/1') => (
    <Diagrams
      drawings={worked}
      rows={rows}
      describedBy="cut-list"
      selected={selected}
      onSelect={() => {}}
      partHref={(id) => `#/projects/abc/cut-list?part=${id}`}
      corners={{ key, load: load as never }}
    />
  );

  it('offers the four corners beside the button, the plan’s own from the front left', () => {
    const { container } = mount(withCorners(async () => ({ ok: true, value: backRight })));
    expect([...menu(container).options].map((o) => o.textContent)).toEqual([
      'From the front left',
      'From the front right',
      'From the back right',
      'From the back left',
    ]);
    expect(menu(container).value).toBe('front-left');
    expect(menu(container).closest('.k-views__control')?.querySelector('button')?.textContent).toBe(
      'Explode',
    );
  });

  it('draws both views from a corner when chosen, fetching each corner once', async () => {
    const asked: string[] = [];
    const { container } = mount(
      withCorners(async (c) => {
        asked.push(c);
        return { ok: true, value: backRight };
      }),
    );
    await choose(container, 'back-right');
    expect(onScreen(container).label).toMatch(
      /^Isometric view\. .*Seen from the back right, above\./,
    );
    await click(byText(container, 'button', 'Explode'));
    expect(onScreen(container).label).toMatch(
      /^Exploded view\. .*Seen from the back right, above\./,
    );
    await choose(container, 'front-left');
    expect(onScreen(container).label).not.toMatch(/Seen from/);
    await choose(container, 'back-right');
    expect(asked).toEqual(['back-right']);
  });

  /** A load that waits until the test answers it. */
  const held = () => {
    const asked: geometry.Corner[] = [];
    const answers = new Map<geometry.Corner, (result: unknown) => void>();
    const load = (c: geometry.Corner) => {
      asked.push(c);
      return new Promise((resolve) => answers.set(c, resolve));
    };
    const answer = (c: geometry.Corner, result: unknown) =>
      act(async () => {
        answers.get(c)?.(result);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    return { asked, load, answer };
  };
  /** The status lines about the corner, leaving out the selected part's. */
  const cornerStatus = (container: HTMLElement) =>
    [...container.querySelectorAll('[role="status"]')]
      .map((s) => s.textContent ?? '')
      .filter((t) => !t.includes(' selected.'));

  it('shows the corner chosen last when an earlier one arrives after it, and keeps the earlier one', async () => {
    const { asked, load, answer } = held();
    const { container } = mount(withCorners(load));
    await choose(container, 'back-right');
    expect(cornerStatus(container)).toEqual(['Drawing the view from the back right…']);
    await choose(container, 'front-left');
    await answer('back-right', { ok: true, value: backRight });
    expect(menu(container).value).toBe('front-left');
    expect(onScreen(container).label).not.toMatch(/Seen from/);
    expect(cornerStatus(container)).toEqual([]);
    await choose(container, 'back-right');
    expect(onScreen(container).label).toMatch(/Seen from the back right/);
    expect(asked).toEqual(['back-right']);
  });

  it('asks once for a corner chosen again while it is being drawn', async () => {
    const { asked, load, answer } = held();
    const { container } = mount(withCorners(load));
    await choose(container, 'back-right');
    await choose(container, 'front-left');
    await choose(container, 'back-right');
    expect(asked).toEqual(['back-right']);
    await answer('back-right', { ok: true, value: backRight });
    expect(menu(container).value).toBe('back-right');
    expect(onScreen(container).label).toMatch(/Seen from the back right/);
    expect(cornerStatus(container)).toEqual([]);
  });

  it('says nothing of a corner that failed after another was chosen', async () => {
    const { load, answer } = held();
    const { container } = mount(withCorners(load));
    await choose(container, 'back-left');
    await choose(container, 'back-right');
    await answer('back-right', { ok: true, value: backRight });
    await answer('back-left', {
      ok: false,
      error: { kind: 'failed', status: 0, message: 'Offline.' },
    });
    expect(menu(container).value).toBe('back-right');
    expect(onScreen(container).label).toMatch(/Seen from the back right/);
    expect(cornerStatus(container)).toEqual([]);
  });

  it('shows nothing from a corner that arrives after the plan changed', async () => {
    const { load, answer } = held();
    const { container, rerender } = mount(withCorners(load, 'abc/1'));
    await choose(container, 'back-right');
    rerender(withCorners(load, 'abc/2'));
    await answer('back-right', { ok: true, value: backRight });
    expect(menu(container).value).toBe('front-left');
    expect(onScreen(container).label).not.toMatch(/Seen from/);
    expect(cornerStatus(container)).toEqual([]);
  });

  it('keeps the views it shows, and says so, when a corner cannot be fetched', async () => {
    const { container } = mount(
      withCorners(async () => ({
        ok: false,
        error: { kind: 'failed', status: 0, message: 'Offline.' },
      })),
    );
    await choose(container, 'back-left');
    expect(menu(container).value).toBe('front-left');
    expect(onScreen(container).label).not.toMatch(/Seen from/);
    expect(container.textContent).toContain(
      'The view from that corner could not be drawn. Offline.',
    );
  });

  it('goes back to the front left when the plan changes', async () => {
    const load = async () => ({ ok: true, value: backRight });
    const { container, rerender } = mount(withCorners(load, 'abc/1'));
    await choose(container, 'back-right');
    expect(onScreen(container).label).toMatch(/Seen from the back right/);
    rerender(withCorners(load, 'abc/2'));
    expect(menu(container).value).toBe('front-left');
    expect(onScreen(container).label).not.toMatch(/Seen from/);
  });
});
