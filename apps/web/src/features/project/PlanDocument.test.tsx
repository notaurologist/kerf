import { createSnapshot, findTemplate, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from './ProjectScreen.tsx';

// The plan as Stage 1 drew it (#40, revised laptop plan; #119): a summary, the contents in
// section order A, Boards, Parameters and inputs, and Print beside Edit. Numbers are the worked
// example's (docs/templates/swing-set-a-frame.md), as core formats them.

const [complete, noInputs] = storedSnapshots;
if (!complete || !noInputs) throw new Error('fixture has the worked examples');
const html = (snapshot: typeof complete) => render(<ProjectView project={projectFrom(snapshot)} />);
const section = (snapshot: typeof complete, id: string) => textOf(sectionOf(html(snapshot), id));

describe('the plan’s summary', () => {
  const summary = section(complete, 'summary');

  it('opens the plan with the template’s key results', () => {
    expect(summary).toContain('Summary Summary Beam 120", 4x6 Back leg (uphill) 131-1/2"');
    expect(summary).toContain('Front leg (downhill) 138-3/8"');
    expect(summary).toContain('Leg end cuts Saw at 20.0°, 70.0° to the edge');
  });

  it('gives the lowest margin, chosen by core, with the check it comes from', () => {
    // Bending, 1.08 (spec, Structural model, worked example), the lowest of the four.
    expect(summary).toContain(
      'Lowest margin margin 1.1x under these assumptions Bending: Top beam, 4x6',
    );
  });

  it('says input needed in place of a margin while any check lacks its inputs', () => {
    const none = section(noInputs, 'summary');
    expect(none).toContain(
      'Lowest margin Input needed 4 of 4 checks need structural inputs. Enter structural inputs',
    );
    expect(none).not.toContain('under these assumptions');
  });

  it('counts the expert checks and lists each in one line, pointing to the review', () => {
    // The stored fixture predates the bolt-distance flags: three, all load-bearing.
    expect(summary).toContain('3 expert checks · Load-bearing design Confirm the bolt size');
    expect(summary).toContain('Confirm the burial depth (24")');
    expect(summary).toContain('Read them in full in the structural review');
    expect(sectionOf(html(complete), 'summary').match(/class="k-one-line"/g)).toHaveLength(3);
  });

  it('says so when the design has no expert checks', () => {
    const outputs = complete.outputs as { design: { flags: unknown[] } };
    const noFlags = {
      ...complete,
      outputs: { ...outputs, design: { ...outputs.design, flags: [] } },
    } as typeof complete;
    const text = section(noFlags, 'summary');
    expect(text).toContain('No expert checks on this design.');
    expect(text).not.toContain('Expert check');
  });

  it('has the Shopping and Building cards', () => {
    expect(summary).toContain('Shopping 11 lines, none bought. Start shopping');
  });

  it('shares the first printed page with the title', () => {
    expect(sectionOf(html(complete), 'summary')).toContain('data-page="same"');
  });
});

describe('the plan’s contents', () => {
  // A plan made now, so it has build steps; the stored fixture predates them.
  const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
  const example = template.examples[0];
  const made = createSnapshot(template, example?.params, example?.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const page = render(
    <ProjectView project={projectFrom(JSON.parse(JSON.stringify(made.output)))} />,
  );
  const contents = page.slice(page.indexOf('<nav class="k-contents"'), page.indexOf('</nav>'));

  it('lists the sections in order A, the same order as the sections themselves', () => {
    const listed = textOf(contents.slice(contents.indexOf('<ol')));
    expect(listed).toBe(
      'Summary Diagrams Structural review Cut list Boards Shopping list Build steps Parameters and inputs',
    );
    const order = [...page.matchAll(/<section id="([a-z-]+)" class="k-section"/g)].map((m) => m[1]);
    expect(order).toEqual([
      'summary',
      'diagrams',
      'structural-review',
      'cut-list',
      'boards',
      'shopping-list',
      'build-steps',
      'parameters',
      // Printed only, after the plan (#180).
      'terms-used',
    ]);
  });

  it('can move focus to each section’s heading', () => {
    expect(page).toContain('<h2 id="boards-heading" tabindex="-1">Boards</h2>');
  });

  it('leaves out sections the plan does not have', () => {
    const none = render(<ProjectView project={projectFrom(complete, { drawings: null })} />);
    const list = none.slice(none.indexOf('<nav class="k-contents"'), none.indexOf('</nav>'));
    expect(textOf(list.slice(list.indexOf('<ol')))).toMatch(/^Summary Structural review/);
    expect(textOf(list)).toMatch(/^1 of 6 · Summary/);
  });
});

describe('the plan’s header', () => {
  it('puts Print beside Edit', () => {
    const top = textOf(html(complete).slice(0, html(complete).indexOf('</header>')));
    expect(top).toBe(
      'Backyard swing set Print Edit Planned. Two-swing A-frame swing set, version 1.',
    );
  });
});

describe('Parameters and inputs', () => {
  it('closes the plan with every parameter and input as entered, by part as in the editor', () => {
    const text = section(complete, 'parameters');
    const part = sectionOf(html(complete), 'parameters');
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
    expect(text).toContain('Edit');
    expect(text).not.toContain('Footprint depth');
  });

  it('gives every section’s table equal columns, so As entered lines up from table to table', () => {
    const part = sectionOf(html(complete), 'parameters');
    const tables = part.match(/<table class="k-table[^>]*>/g) ?? [];
    expect(tables.length).toBeGreaterThan(3);
    for (const table of tables) expect(table).toBe('<table class="k-table" data-equal="">');
  });

  it('says input needed for structural inputs not entered, and fills nothing in', () => {
    const text = section(noInputs, 'parameters');
    expect(text.match(/Input needed/g)?.length).toBeGreaterThan(3);
    expect(text).not.toMatch(/southern|Southern/);
  });
});
