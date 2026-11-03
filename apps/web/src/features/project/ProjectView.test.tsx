import {
  createSnapshot,
  findTemplate,
  type HardwareLine,
  type TemplateDefinition,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { setFlash } from '../../lib/flash.ts';
import { readPlan } from '../../lib/plan.ts';
import { loadedDrawings, projectFrom, storedSnapshots } from '../../test/projects.ts';
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
  const text = renderText(
    <ProjectView
      project={projectFrom(workedExample)}
      drawings={loadedDrawings(projectFrom(workedExample))}
    />,
  );

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
    expect(
      render(
        <ProjectView
          project={projectFrom(workedExample)}
          drawings={loadedDrawings(projectFrom(workedExample))}
        />,
      ),
    ).toContain('<span class="k-part-letter">A</span>');
  });

  it('keeps the cut list’s short columns narrow, with the stock under the part (#158, #360)', () => {
    const html = render(
      <ProjectView
        project={projectFrom(workedExample)}
        drawings={loadedDrawings(projectFrom(workedExample))}
      />,
    );
    const header = (label: string) => new RegExp(`<th scope="col"[^>]*>(?:<span[^>]*>)?${label}<`);
    const width = (label: string) =>
      header(label)
        .exec(html)?.[0]
        .match(/data-width="(\w+)"/)?.[1];
    expect(html).toMatch(header('Part'));
    expect(width('Part')).toBeUndefined();
    expect(width('Qty')).toBe('fit');
    expect(width('Length')).toBe('fit');
    expect(width('Ends')).toBe('fit');
    const cutList = sectionOf(html, 'cut-list');
    expect(cutList).not.toMatch(header('Stock'));
    expect(cutList).not.toMatch(header('Marks and notes'));
    // Stock breaks only between its nominal size and its actual size.
    expect(html).toContain(
      '<span class="k-length">4x6</span> <span class="k-length">(3-1/2&quot; x 5-1/2&quot;)</span>',
    );
  });

  it('shows the shopping list, with board lengths and pieces through formatLength', () => {
    // The count to buy first (#361).
    expect(text).toContain(`4 4x4 12' 0"`);
    expect(text).toContain(`1 4x6 12' 0"`);
    for (const line of outputs.hardware) expect(text).toContain(line.description);
  });

  it('shows which pieces come from which board in its own section (#119)', () => {
    const boards = textOf(
      sectionOf(
        render(
          <ProjectView
            project={projectFrom(workedExample)}
            drawings={loadedDrawings(projectFrom(workedExample))}
          />,
        ),
        'boards',
      ),
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
    { description: 'Bolts', quantity: 4, group: 'Bolts and fittings', notes: [] },
    { description: 'Hangers', quantity: 4, group: 'Swing hardware', notes: [] },
    { description: 'Washers', quantity: 8, group: 'Bolts and fittings', notes: [] },
  ];
  const plan = readPlan(projectFrom(workedExample));
  if (!plan.ok) throw new Error(plan.message);
  const list = (h: HardwareLine[]) =>
    renderText(<ShoppingList lumber={plan.plan.lumber} hardware={h} hardwareNotes={[]} />);

  it('is split by store group, in the order each group first comes (#59)', () => {
    const text = list(hardware);
    expect(text).toMatch(/Bolts and fittings .*4 Bolts .*8 Washers .*Swing hardware .*4 Hangers/);
  });

  it('has no group headings for a plan made before groups', () => {
    const text = list(
      hardware.map(({ description, quantity, notes }) => ({ description, quantity, notes })),
    );
    expect(text).not.toContain('Bolts and fittings');
    expect(text).toMatch(/4 Bolts .*4 Hangers .*8 Washers/);
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
        drawings={loadedDrawings(
          projectFrom(null, {
            unreadable: { reason: 'malformed', message: 'The stored snapshot is not a snapshot.' },
            version: null,
          }),
        )}
      />,
    );
    expect(text).toContain(
      'The stored plan cannot be read: The stored snapshot is not a snapshot.',
    );
    expect(text).not.toContain('Edit');
    // With no Edit to reach it through, Delete stays here.
    expect(text).toContain('Delete project');
  });

  it('refuses outputs that do not match the template’s schema', () => {
    const damaged = { ...workedExample, outputs: { cutList: 'damaged' } };
    expect(
      renderText(
        <ProjectView
          project={projectFrom(damaged)}
          drawings={loadedDrawings(projectFrom(damaged))}
        />,
      ),
    ).toContain('does not match this template’s shape');
  });
});

describe('ProjectView, as a document (#40, #41)', () => {
  const project = projectFrom(workedExample);

  it('leaves Delete to the Edit screen, away from Previous and Next', () => {
    expect(
      renderText(<ProjectView project={project} drawings={loadedDrawings(project)} />),
    ).not.toContain('Delete');
  });

  it('reads in section order A: diagrams, structural review, cut list, shopping list', () => {
    const text = renderText(<ProjectView project={project} drawings={loadedDrawings(project)} />);
    const at = (s: string) => text.indexOf(`${s} ${s}`);
    // Each section's printed title block names it, then its heading does.
    expect(at('Diagrams')).toBeGreaterThan(0);
    expect(at('Diagrams')).toBeLessThan(at('Structural review'));
    expect(at('Structural review')).toBeLessThan(at('Cut list'));
    expect(at('Cut list')).toBeLessThan(at('Shopping list'));
  });

  it('gives each section a title block for print, naming the project', () => {
    const html = render(<ProjectView project={project} drawings={loadedDrawings(project)} />);
    expect(html).toContain('<b>Kerf</b> · Backyard swing set · Cut list');
  });

  it('says "Saved." once after the editor saves, and not again', () => {
    setFlash('Saved.');
    expect(
      renderText(<ProjectView project={project} drawings={loadedDrawings(project)} />),
    ).toContain('Saved.');
    expect(
      renderText(<ProjectView project={project} drawings={loadedDrawings(project)} />),
    ).not.toContain('Saved.');
  });
});

describe('the diagrams in the plan (#91)', () => {
  // A plan made now, with placements; the stored fixture predates them.
  const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
  const example = template.examples[0];
  const made = createSnapshot(template, example?.params, example?.structuralInputs);
  if (!made.ok) throw new Error('worked example should generate');
  const project = projectFrom(JSON.parse(JSON.stringify(made.output)));
  const html = render(<ProjectView project={project} drawings={loadedDrawings(project)} />);
  const text = renderText(<ProjectView project={project} drawings={loadedDrawings(project)} />);

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
    const old = render(
      <ProjectView
        project={projectFrom(workedExample)}
        drawings={loadedDrawings(projectFrom(workedExample))}
      />,
    );
    expect(sectionOf(old, 'diagrams').match(/<svg[^>]*role="img"/g)).toHaveLength(6);
    expect(old).not.toContain('Isometric view');
  });

  it('shows no diagrams section when the API sent no drawings', () => {
    const none = renderText(
      <ProjectView
        project={projectFrom(workedExample)}
        drawings={loadedDrawings(projectFrom(workedExample), null)}
      />,
    );
    expect(none).not.toContain('Diagrams Diagrams');
  });
});
