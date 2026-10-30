import {
  createSnapshot,
  findTemplate,
  type HardwareLine,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { setFlash } from '../../lib/flash.ts';
import { readPlan } from '../../lib/plan.ts';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, renderText, sectionOf, textOf } from '../../test/render.tsx';
import { CutList } from '../cut-list/CutList.tsx';
import { ShoppingList } from '../shopping-list/ShoppingList.tsx';
import { ProjectView } from './ProjectScreen.tsx';

const [workedExample] = storedSnapshots;
if (!workedExample) throw new Error('fixture has the worked example first');
const outputs = workedExample.outputs as {
  cutList: { name: string; length: string; ends: string[] }[];
  hardware: { description: string }[];
};

describe('ProjectView, from a stored snapshot', () => {
  const text = renderText(<ProjectView project={projectFrom(workedExample)} />);

  it('shows every cut-list length and end cut exactly as stored', () => {
    for (const row of outputs.cutList) {
      expect(text).toContain(row.name);
      expect(text).toContain(row.length);
      for (const end of row.ends) expect(text).toContain(end);
    }
    // Spot checks against the hand-checked worked example (spec, Worked example).
    expect(text).toContain('Beam');
    expect(text).toContain('120"');
  });

  // The fixture was stored before letters (shape 1); reading it upgrades it, as the API does.
  it("puts each part's letter from core first in its cut-list row (#66)", () => {
    expect(text).toContain('A Beam');
    expect(text).toContain('B Back leg (uphill)');
    expect(text).toContain('E Gusset');
    expect(render(<ProjectView project={projectFrom(workedExample)} />)).toContain(
      '<span class="k-part-letter">A</span>',
    );
  });

  it('shows the shopping list, with board lengths and pieces through formatLength', () => {
    expect(text).toContain(`4x4 12' 0" 4`);
    expect(text).toContain(`4x6 12' 0" 1`);
    for (const line of outputs.hardware) expect(text).toContain(line.description);
  });

  it('shows which pieces come from which board in its own section (#119)', () => {
    const boards = textOf(
      sectionOf(render(<ProjectView project={projectFrom(workedExample)} />), 'boards'),
    );
    expect(boards).toContain(`trims 1/2" off each factory end and allows 1/8" for each saw cut`);
    expect(boards).toContain(`A Beam 120" Offcut 22-7/8".`);
    for (const line of outputs.hardware) expect(text).toContain(line.description);
  });

  it('shows no unrounded number in the lists: decimals appear only in angles, to one place', () => {
    const plan = readPlan(projectFrom(workedExample));
    if (!plan.ok) throw new Error(plan.message);
    const lists = renderText(
      <>
        <CutList rows={plan.plan.cutList} />
        <ShoppingList
          lumber={plan.plan.lumber}
          hardware={plan.plan.hardware}
          hardwareNotes={plan.plan.hardwareNotes}
        />
      </>,
    );
    expect(lists).toContain('138-3/8"');
    expect(lists.match(/\d+\.\d+(?!°)/g) ?? []).toEqual([]);
    expect(lists.match(/\d+\.\d{2,}°/g) ?? []).toEqual([]);
  });
});

describe('the plan’s hardware list', () => {
  const hardware: HardwareLine[] = [
    { description: 'Bolts', quantity: 4, group: 'Bolts and fittings' },
    { description: 'Hangers', quantity: 4, group: 'Swing hardware' },
    { description: 'Washers', quantity: 8, group: 'Bolts and fittings' },
  ];
  const plan = readPlan(projectFrom(workedExample));
  if (!plan.ok) throw new Error(plan.message);
  const list = (h: HardwareLine[]) =>
    renderText(<ShoppingList lumber={plan.plan.lumber} hardware={h} hardwareNotes={[]} />);

  it('is split by store group, in the order each group first comes (#59)', () => {
    const text = list(hardware);
    expect(text).toMatch(/Bolts and fittings .*Bolts 4 .*Washers 8 .*Swing hardware .*Hangers 4/);
  });

  it('has no group headings for a plan made before groups', () => {
    const text = list(hardware.map(({ description, quantity }) => ({ description, quantity })));
    expect(text).not.toContain('Bolts and fittings');
    expect(text).toMatch(/Bolts 4 .*Hangers 4 .*Washers 8/);
  });
});

describe('ProjectView, when the plan cannot be shown', () => {
  it('says why for an unreadable snapshot, without an edit link', () => {
    const text = renderText(
      <ProjectView
        project={projectFrom(null, {
          unreadable: { reason: 'malformed', message: 'The stored snapshot is not a snapshot.' },
          version: null,
        })}
      />,
    );
    expect(text).toContain(
      'The stored plan cannot be read: The stored snapshot is not a snapshot.',
    );
    expect(text).not.toContain('Edit');
  });

  it('refuses outputs that do not match the template’s schema', () => {
    const damaged = { ...workedExample, outputs: { cutList: 'damaged' } };
    expect(renderText(<ProjectView project={projectFrom(damaged)} />)).toContain(
      'does not match this template’s shape',
    );
  });
});

describe('ProjectView, as a document (#40, #41)', () => {
  const project = projectFrom(workedExample);

  it('reads in section order A: diagrams, structural review, cut list, shopping list', () => {
    const text = renderText(<ProjectView project={project} />);
    const at = (s: string) => text.indexOf(`${s} ${s}`);
    // Each section's printed title block names it, then its heading does.
    expect(at('Diagrams')).toBeGreaterThan(0);
    expect(at('Diagrams')).toBeLessThan(at('Structural review'));
    expect(at('Structural review')).toBeLessThan(at('Cut list'));
    expect(at('Cut list')).toBeLessThan(at('Shopping list'));
  });

  it('gives each section a title block for print, naming the project', () => {
    const html = render(<ProjectView project={project} />);
    expect(html).toContain('<b>Kerf</b> · Backyard swing set · Cut list');
  });

  it('says "Saved." once after the editor saves, and not again', () => {
    setFlash('Saved.');
    expect(renderText(<ProjectView project={project} />)).toContain('Saved.');
    expect(renderText(<ProjectView project={project} />)).not.toContain('Saved.');
  });
});

describe('the diagrams in the plan (#91)', () => {
  // A plan made now, with placements; the stored fixture predates them.
  const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
  const example = template.examples[0];
  const made = createSnapshot(template, example?.params, example?.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const project = projectFrom(JSON.parse(JSON.stringify(made.output)));
  const html = render(<ProjectView project={project} />);
  const text = renderText(<ProjectView project={project} />);

  it('draws the assembled and exploded views, a cut detail per part, and the site layout', () => {
    expect(text).toContain('Assembled');
    expect(text).toContain('Exploded');
    for (const row of outputs.cutList) expect(text).toContain(row.name);
    expect(text).toContain('Site layout');
    // Five cut details, three views.
    expect(sectionOf(html, 'diagrams').match(/<svg[^>]*role="img"/g)).toHaveLength(8);
  });

  it('labels each drawing from the same data, and points to the cut list as its long description', () => {
    expect(html).toContain(
      'aria-label="Isometric view. The swing set, assembled. Parts A to E, lettered as in the cut list."',
    );
    expect(html).toMatch(
      /aria-label="Cut detail for B, Back leg \(uphill\): 131-1\/2&quot; overall, ends cut at 20\.0°, 5 holes\./,
    );
    expect(html.match(/aria-describedby="cut-list"/g)).toHaveLength(8);
  });

  it('prints the three views on landscape pages', () => {
    expect(html.match(/data-page="landscape"/g)).toHaveLength(3);
  });

  it('makes each cut-list part a link to the drawings with it selected (#156)', () => {
    expect(html).toContain(
      `<a id="cut-list-part-beam" href="#/projects/${project.id}/diagrams?part=beam"><span class="k-part-letter">A</span><b>Beam</b></a>`,
    );
  });

  it('shows a plan made before placements with its cut details and site layout only', () => {
    const old = render(<ProjectView project={projectFrom(workedExample)} />);
    expect(sectionOf(old, 'diagrams').match(/<svg[^>]*role="img"/g)).toHaveLength(6);
    expect(old).not.toContain('Isometric view');
  });

  it('shows no diagrams section when the API sent no drawings', () => {
    const none = renderText(
      <ProjectView project={projectFrom(workedExample, { drawings: null })} />,
    );
    expect(none).not.toContain('Diagrams Diagrams');
  });
});
