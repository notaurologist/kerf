import { createSnapshot, findTemplate, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { loadedDrawings, projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from './ProjectScreen.tsx';

// The plan as Stage 1 drew it (#40, revised laptop plan; #119), as Stage 12 changed it (#356): a
// header with what is next and the modes, the contents in section order A, Boards, the values
// used on paper, and Edit in the header. Numbers are the worked
// example's (docs/templates/swing-set-a-frame.md), as core formats them.

const [complete, noInputs] = storedSnapshots;
if (!complete || !noInputs) throw new Error('fixture has the worked examples');
const html = (snapshot: typeof complete) =>
  render(
    <ProjectView
      project={projectFrom(snapshot)}
      drawings={loadedDrawings(projectFrom(snapshot))}
    />,
  );
const section = (snapshot: typeof complete, id: string) => textOf(sectionOf(html(snapshot), id));

describe('the plan’s header (#356)', () => {
  const head = (snapshot: typeof complete) => {
    const page = html(snapshot);
    return page.slice(0, page.indexOf('<div class="k-with-contents"'));
  };

  it('says what is next: the expert checks, and the inputs while any are needed', () => {
    // The stored fixture predates build steps and the bolt-distance flags: three flags.
    expect(textOf(head(complete))).toContain('3 expert checks');
    expect(textOf(head(complete))).not.toContain('needed');
    // Every structural input the checks name, once each.
    expect(textOf(head(noInputs))).toContain('8 inputs needed · 3 expert checks');
    expect(head(noInputs)).toContain(
      `<a href="#/projects/${projectFrom(noInputs).id}/structural-review">8 inputs needed</a>`,
    );
  });

  it('has Shop on every section, in the shopping color', () => {
    expect(head(complete)).toMatch(
      /<a class="k-button" data-variant="primary" data-mode="shopping" href="#\/projects\/[^/]+\/shop"><span class="k-button__label"><span>Shop<\/span><span class="k-button__sep"> · <\/span><span class="k-button__detail">11 to buy<\/span><\/span><\/a>/,
    );
  });

  it('keeps no list of expert checks', () => {
    expect(textOf(html(complete))).not.toContain('Read them in full');
  });

  it('shows the lowest margin and its check once every check has one (#448)', () => {
    const id = projectFrom(complete).id;
    expect(head(complete)).toContain(
      `<p class="k-text" data-screen-only="true"><a href="#/projects/${id}/structural-review">Lowest margin 1.1x: bending, top beam, 4x6</a></p>`,
    );
    // A check waiting for inputs could be the lowest.
    expect(textOf(head(noInputs))).not.toContain('Lowest margin');
  });

  it('shows a lowest margin under 1.0 the same way, and puts the review first (#448)', () => {
    // The worked example with heavier riders: the beam's computed bending stress is larger than
    // its allowable one. Roughly 1.1 × (2 × 300 lb) / (3 × 500 lb) = 0.44, a little more since the
    // beam's own weight, which the dynamic factor does not multiply, stays the same.
    const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
    const example = template.examples[0];
    if (!example) throw new Error('no worked example');
    const made = createSnapshot(template, example.params, {
      ...(example.structuralInputs as object),
      riderWeights: [250, 250],
      dynamicFactor: 3,
    });
    if (!made.ok) throw new Error('heavier riders do not generate');
    const text = textOf(head(JSON.parse(JSON.stringify(made.output))));
    expect(text).toContain('Lowest margin 0.4x: bending, top beam, 4x6');
    expect(text).toMatch(/Next: Structural review · .*expert checks/);
  });

  it('shares the first printed page with the first section', () => {
    expect(sectionOf(html(complete), 'diagrams')).toContain('data-page="same"');
    expect(sectionOf(html(complete), 'structural-review')).not.toContain('data-page="same"');
  });
});

describe('the plan’s contents', () => {
  // A plan made now, so it has build steps; the stored fixture predates them.
  const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
  const example = template.examples[0];
  const made = createSnapshot(template, example?.params, example?.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const page = render(
    <ProjectView
      project={projectFrom(JSON.parse(JSON.stringify(made.output)))}
      drawings={loadedDrawings(projectFrom(JSON.parse(JSON.stringify(made.output))))}
    />,
  );
  const contents = page.slice(page.indexOf('<nav class="k-contents"'), page.indexOf('</nav>'));

  it('lists the sections in order A, the same order as the sections themselves', () => {
    const listed = textOf(contents.slice(contents.indexOf('<ol')));
    expect(listed).toBe(
      'Diagrams Structural review Cut list Boards Shopping list Build steps Values used',
    );
    const order = [...page.matchAll(/<section id="([a-z-]+)" class="k-section"/g)].map((m) => m[1]);
    expect(order).toEqual([
      'diagrams',
      'structural-review',
      'cut-list',
      'boards',
      'shopping-list',
      'build-steps',
      // Printed only, after the plan: the values used (#356) and the terms (#180).
      'values-used',
      'terms-used',
    ]);
  });

  it('can move focus to each section’s heading', () => {
    expect(page).toContain('<h2 id="boards-heading" tabindex="-1">Boards</h2>');
  });

  it('leaves out sections the plan does not have', () => {
    const none = render(
      <ProjectView
        project={projectFrom(complete)}
        drawings={loadedDrawings(projectFrom(complete), null)}
      />,
    );
    const list = none.slice(none.indexOf('<nav class="k-contents"'), none.indexOf('</nav>'));
    expect(textOf(list.slice(list.indexOf('<ol')))).toMatch(/^Structural review Cut list/);
    expect(textOf(list)).toMatch(/^1 of 4 · Structural review/);
  });
});

describe('the plan’s header', () => {
  it('offers Edit and leaves printing to the browser', () => {
    const top = textOf(html(complete).slice(0, html(complete).indexOf('</header>')));
    expect(top).toBe(
      'Backyard swing set Planned About this plan Template Two-swing A-frame swing set, version 1. Edit',
    );
  });

  it('shows the status as a tag, with the template and its version behind an info button', () => {
    const header = html(complete).slice(0, html(complete).indexOf('</header>'));
    expect(header).toContain(
      '<span class="k-tag" data-tone="status" data-status="planned">Planned</span>',
    );
    expect(header).toMatch(
      /<button type="button" class="k-info__button" popoverTarget="([^"]+)"[^>]*>.*<span id="\1" popover="auto" class="k-popover"><b>Template<\/b> Two-swing A-frame swing set, version 1\.<\/span>/s,
    );
  });
});

describe('Values used', () => {
  it('links to Edit from the contents, where the values are on screen', () => {
    const page = html(complete);
    const contents = page.slice(page.indexOf('<nav class="k-contents"'), page.indexOf('</nav>'));
    expect(contents).toContain(
      `</ol><a class="k-contents__end" href="#/projects/${projectFrom(complete).id}/edit?from=diagrams">Values used</a>`,
    );
  });

  it('closes the printed plan with every parameter and input as entered, by part as in the editor', () => {
    const text = section(complete, 'values-used');
    const part = sectionOf(html(complete), 'values-used');
    expect(part).toMatch(/<section id="values-used" class="k-section"[^>]*hidden/);
    expect([...part.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1])).toEqual([
      'Beam',
      'Legs',
      'Crossbars',
      'Gussets',
      'Site',
      'Swings',
      'Loads',
    ]);
    // A part's parameters and structural inputs share its table.
    expect(text).toContain('Beam Field As entered Beam length');
    expect(text).toMatch(/Beam plies [\s\S]*Beam species and grade/);
    expect(text).toContain(`Beam length 10' 0" · 120"`);
    expect(text).toContain('Leg angle from vertical 20.0°');
    expect(text).toContain('Beam stock 4x6');
    expect(text).not.toContain('Footprint depth');
  });

  it('gives every section’s table equal columns, so As entered lines up from table to table', () => {
    const part = sectionOf(html(complete), 'values-used');
    const tables = part.match(/<table class="k-table[^>]*>/g) ?? [];
    expect(tables.length).toBeGreaterThan(3);
    for (const table of tables) expect(table).toBe('<table class="k-table" data-equal="">');
  });

  it('says input needed for structural inputs not entered, and fills nothing in', () => {
    const text = section(noInputs, 'values-used');
    expect(text.match(/Input needed/g)?.length).toBeGreaterThan(3);
    expect(text).not.toMatch(/southern|Southern/);
  });
});
