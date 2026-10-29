import { describe, expect, it } from 'vitest';
import { setFlash } from '../../lib/flash.ts';
import { readPlan } from '../../lib/plan.ts';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, renderText } from '../../test/render.tsx';
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

  it('shows the shopping list, with board lengths and pieces through formatLength', () => {
    expect(text).toContain(`4x4 12' 0" 4`);
    expect(text).toContain(`4x6, 12' 0": Beam 120". Offcut about 22-7/8".`);
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

  it('reads in section order A: structural review, cut list, shopping list', () => {
    const text = renderText(<ProjectView project={project} />);
    const at = (s: string) => text.indexOf(`${s} ${s}`);
    // Each section's printed title block names it, then its heading does.
    expect(at('Structural review')).toBeGreaterThan(0);
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
