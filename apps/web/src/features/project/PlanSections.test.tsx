import { buildSteps, createSnapshot, findTemplate, type TemplateDefinition } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { PLAN_SECTIONS, type PlanSectionId } from '../../lib/sections.ts';
import { projectFrom } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from './ProjectScreen.tsx';

// The plan, one section per screen (#147, P1; #156). Every section stays in the page so print
// gives the whole plan; on screen only the current one shows. Numbers are the worked example's
// (docs/templates/swing-set-a-frame.md), counted by core (packages/core, digests.test.ts).

const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const example = template.examples[0];
const made = createSnapshot(template, example?.params, example?.structuralInputs);
if (!made.ok) throw new Error('worked example should generate');
// A plan made now, with the drawings and build steps the API sends with it.
const outputs = template.outputs.parse(made.output.outputs);
const stored = JSON.parse(JSON.stringify(made.output));
const project = projectFrom(stored, {
  drawings: template.drawings(outputs),
  steps: {
    inventoryKey: 'none',
    steps: buildSteps(template.steps(outputs), template.plan(outputs), { tools: [], other: [] }),
  },
});
const base = `#/projects/${project.id}`;
const at = (section?: PlanSectionId, part?: string) =>
  render(
    <ProjectView project={project} {...(section ? { section } : {})} {...(part ? { part } : {})} />,
  );
const contentsOf = (html: string) =>
  html.slice(html.indexOf('<nav class="k-contents"'), html.indexOf('</nav>') + 6);
const pagerOf = (html: string) => {
  const start = html.indexOf('<nav class="k-pager"');
  return start < 0 ? '' : html.slice(start, html.indexOf('</nav>', start) + 6);
};
const shownSections = (html: string) =>
  [...html.matchAll(/<section id="([a-z-]+)" class="k-section"[^>]*>/g)]
    .filter((m) => !m[0].includes('hidden'))
    .map((m) => m[1]);

describe('each section on its own screen', () => {
  it.each(PLAN_SECTIONS.map((s) => [s.id, s.title] as const))('%s', (id, title) => {
    const html = at(id);
    // Only the current section shows; the rest stay in the page, hidden, for print.
    expect(shownSections(html)).toEqual([id]);
    expect(html.match(/<section id="[a-z-]+" class="k-section"/g)).toHaveLength(8);
    // The contents mark it as the page, with its own address.
    const href = id === 'summary' ? base : `${base}/${id}`;
    expect(contentsOf(html)).toContain(`<a href="${href}" aria-current="page">${title}</a>`);
    expect(contentsOf(html).match(/aria-current/g)).toHaveLength(1);
  });

  it('opens on the summary when the address names no section', () => {
    expect(shownSections(at())).toEqual(['summary']);
  });

  it('opens on the summary for a section the plan does not have', () => {
    const old = render(
      <ProjectView project={projectFrom(stored, { steps: null })} section="build-steps" />,
    );
    expect(shownSections(old)).toEqual(['summary']);
  });
});

describe('the phone’s bar', () => {
  it('says which section of how many, and opens the contents', () => {
    const bar = (html: string) =>
      textOf(contentsOf(html).slice(0, contentsOf(html).indexOf('</button>')));
    expect(bar(at('structural-review'))).toBe('3 of 8 · Structural review Contents');
    expect(bar(at())).toBe('1 of 8 · Summary Contents');
    expect(contentsOf(at('boards'))).toMatch(/<button type="button" [^>]*aria-expanded="false"/);
  });
});

describe('Previous and Next', () => {
  it('name the sections either side, in a navigation labeled for the plan', () => {
    const pager = pagerOf(at('structural-review'));
    expect(pager).toContain('aria-label="Plan sections"');
    expect(textOf(pager)).toBe('Previous Diagrams Next Cut list');
    expect(pager).toContain(`<a class="k-pager__link" href="${base}/diagrams" rel="prev">`);
    expect(pager).toContain(`<a class="k-pager__link" href="${base}/cut-list" rel="next">`);
  });

  it('give only Next on the summary and only Previous on the last section', () => {
    expect(textOf(pagerOf(at()))).toBe('Next Diagrams');
    expect(textOf(pagerOf(at('parameters')))).toBe('Previous Build steps');
  });

  it('come after the section, outside it', () => {
    const html = at('cut-list');
    expect(html.indexOf('<nav class="k-pager"')).toBeGreaterThan(html.lastIndexOf('</section>'));
  });
});

describe('links between sections', () => {
  it('open a part selected in a drawing in the cut list', () => {
    const diagrams = sectionOf(at('diagrams', 'leg-front'), 'diagrams');
    expect(textOf(diagrams)).toContain(
      'C · Front leg (downhill) selected. Show it in the cut list',
    );
    expect(diagrams).toContain(
      `<a href="${base}/cut-list?part=leg-front">Show it in the cut list</a>`,
    );
  });

  it('mark the part in the cut list, in words, with a link back to the drawings', () => {
    const cutList = sectionOf(at('cut-list', 'leg-front'), 'cut-list');
    expect(textOf(cutList)).toContain('C · Front leg (downhill) selected. Show it in the drawings');
    expect(cutList).toContain(
      `<a href="${base}/diagrams?part=leg-front">Show it in the drawings</a>`,
    );
    expect(cutList.match(/data-selected/g)).toHaveLength(1);
  });

  it('open a cut-list row’s part in the drawings', () => {
    const cutList = sectionOf(at('cut-list'), 'cut-list');
    expect(cutList).toContain(`href="${base}/diagrams?part=gusset"`);
    expect(cutList).not.toContain('selected.');
  });

  it('give each cut detail a heading a link can move focus to', () => {
    expect(sectionOf(at('diagrams'), 'diagrams')).toContain(
      '<h4 id="cut-detail-leg-front-heading" tabindex="-1">',
    );
  });

  it('open a build step’s piece at its cut detail in the drawings', () => {
    const steps = sectionOf(at('build-steps'), 'build-steps');
    expect(steps).toContain(`<a href="${base}/diagrams?part=leg-back">B Back leg (uphill)</a>`);
  });

  it('open the structural review at the expert checks from the summary’s flags', () => {
    const summary = sectionOf(at(), 'summary');
    expect(summary).toContain(
      `<a href="${base}/structural-review">Read them in full in the structural review</a>`,
    );
    expect(sectionOf(at('structural-review'), 'structural-review')).toContain(
      '<h3 id="expert-checks" tabindex="-1">Expert checks</h3>',
    );
  });
});

describe('the summary’s list of sections', () => {
  it('links every other section with core’s digest of it, in order A', () => {
    const summary = sectionOf(at(), 'summary');
    const list = summary.slice(summary.indexOf('<ul class="k-section-list"'));
    expect(textOf(list.slice(0, list.indexOf('</ul>')))).toBe(
      [
        'Diagrams Assembled, exploded, and site views · 5 cut details',
        'Structural review 4 checks, lowest margin 1.1x · 6 expert checks · 7 items to confirm',
        'Cut list 5 parts, 9 pieces',
        'Boards 9 pieces from 7 boards',
        'Shopping list 4 lumber lines, 7 hardware lines',
        'Build steps 11 steps: 7 boards to cut, then 4 more',
        'Parameters and inputs Every structural input entered',
      ].join(' '),
    );
    expect(list).toContain(`<a href="${base}/boards">Boards</a>`);
  });
});

describe('Edit', () => {
  it('carries the section it was opened from', () => {
    expect(at('cut-list')).toContain(`href="${base}/edit?from=cut-list"`);
    expect(at()).toContain(`href="${base}/edit"`);
  });

  it('enters structural inputs from the review and returns there', () => {
    const none = createSnapshot(template, example?.params, {});
    if (!none.ok) throw new Error('worked example should generate without inputs');
    const html = render(
      <ProjectView
        project={projectFrom(JSON.parse(JSON.stringify(none.output)))}
        section="structural-review"
      />,
    );
    expect(sectionOf(html, 'structural-review')).toContain(
      `href="${base}/edit?from=structural-review">Enter structural inputs</a>`,
    );
  });
});
