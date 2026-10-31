import {
  type CutListRow,
  createSnapshot,
  type Inventory,
  OPERATION_TYPE_LABELS,
  TEMPLATES,
} from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { readSteps } from '../../lib/plan.ts';
import { cutDetailId } from '../../lib/show.ts';
import type { Project } from '../../lib/types.ts';
import { projectFrom, stepsFor } from '../../test/projects.ts';
import { render, renderText, sectionOf } from '../../test/render.tsx';
import { TermScope } from '../../ui/index.ts';
import { ProjectView } from '../project/ProjectScreen.tsx';

// #52: the shop view needs nothing beyond the project response, so a dropped connection after
// the page loads loses no step. ProjectView renders from that one response and fetches nothing.

const template = TEMPLATES[0];
const example = template?.examples[0];
if (!template || !example) throw new Error('no worked example');
const made = createSnapshot(template, example.params, example.structuralInputs);
if (!made.ok) throw new Error('worked example does not generate');
const snapshot = JSON.parse(JSON.stringify(made.output)) as NonNullable<Project['snapshot']>;

const shop: Inventory = {
  tools: [
    { toolTypeId: 'miter-saw', capabilities: { cutDepth: 4, crosscutWidth: 12, maxMiter: 50 } },
    { toolTypeId: 'tape-measure', capabilities: {} },
  ],
  other: [],
};

function project(inventory: Inventory): Project {
  return projectFrom(snapshot, { steps: stepsFor(snapshot, inventory) });
}

describe('glossary terms in the plan (#178)', () => {
  const html = render(
    <TermScope entryHref={(id) => `#/glossary/${id}`}>
      <ProjectView project={project(shop)} />
    </TermScope>,
  );
  const marked = (section: string) =>
    [...sectionOf(html, section).matchAll(/class="k-term__button"[^>]*>([^<]+)</g)].map((m) =>
      (m[1] ?? '').toLowerCase(),
    );

  it("marks each term's first use in the build steps once, in method text and flags", () => {
    const terms = marked('build-steps');
    expect(terms).toEqual(expect.arrayContaining(['miter', 'bevel', 'margins', 'waste side']));
    expect(new Set(terms).size).toBe(terms.length);
  });

  it('starts each section afresh: the structural review marks its own first uses', () => {
    expect(marked('structural-review')).toEqual([
      'margin',
      'bending',
      'dynamic factor',
      'shear',
      'deflection',
      'flush',
      'gusset',
      'burial depth',
      'ground contact',
      'edge distance',
      'nds',
      'end distance',
      'grip',
      'racking',
      'backfill',
      'knots',
      'midspan',
      'grain',
      'wane',
      'design values',
      'pressure-treated',
    ]);
  });

  // Terms are reachable from every section whose text uses them, not only the build steps.
  it('marks terms in the summary, section intros, and the shopping list', () => {
    expect(marked('summary')).toEqual([
      'bending',
      'flush',
      'burial depth',
      'ground contact',
      'edge distance',
      'gusset',
      'end distance',
    ]);
    expect(marked('cut-list')).toEqual(['long point', 'level cut']);
    expect(marked('shopping-list')).toEqual([
      'grade stamp',
      'species and grade',
      'design values',
      'bow',
      'crook',
      'twist',
      'warped',
      'grain',
      'knots',
      'span',
      'shake',
      'shear',
      'crown',
      'bending',
      'end tag',
      'awpa u1',
      'use category',
      'ground contact',
      'grip',
    ]);
  });
});

describe('build steps in the project view (#52)', () => {
  it('names the tool chosen when there are several of its type', () => {
    const named: Inventory = {
      tools: [
        { toolTypeId: 'miter-saw', name: 'Small', capabilities: { cutDepth: 1, crosscutWidth: 3 } },
        {
          toolTypeId: 'miter-saw',
          name: 'Sliding',
          capabilities: { cutDepth: 4, crosscutWidth: 12, maxMiter: 50 },
        },
        { toolTypeId: 'tape-measure', capabilities: {} },
      ],
      other: [],
    };
    const text = renderText(<ProjectView project={project(named)} />);
    expect(text).toContain('With a miter saw. Tools: Miter saw (Sliding), Tape measure.');
  });

  it('renders every step and every operation from one project response', () => {
    const p = project(shop);
    const steps = readSteps(p);
    if (!steps) throw new Error('the response has no steps');
    expect(steps.steps.length).toBeGreaterThan(0);
    const text = renderText(<ProjectView project={p} />);
    steps.steps.forEach((step, i) => {
      expect(text).toContain(`${i + 1}. ${step.title}`);
      for (const op of step.operations) {
        expect(text).toContain(OPERATION_TYPE_LABELS[op.operation.type]);
        if (op.method) expect(text).toContain(op.method.name);
        for (const line of op.method?.technique ?? []) expect(text).toContain(line);
      }
      for (const flag of step.flags) expect(text).toContain(flag.ask);
    });
  });

  it('shows the chosen method with its numbers, and what is needed where none fits', () => {
    const text = renderText(<ProjectView project={project(shop)} />);
    // The beam's ends, with the miter saw that cuts through the 4x6.
    expect(text).toContain('Square crosscut: A Beam, end 1');
    expect(text).toContain('With a miter saw. Tools: Miter saw, Tape measure.');
    // The legs' miters at the worked example's 20° splay.
    expect(text).toContain('Set the miter saw to 20.0°, turned the way the cut detail shows.');
    // No drill: the holes name what would allow a method.
    expect(text).toContain('No method fits your tools.');
  });

  it("puts each tool's icon before its name in a method's tools (#86)", () => {
    const html = render(<ProjectView project={project(shop)} />);
    expect(html).toMatch(
      /<span class="k-tool-label"><svg class="k-tool-icon"[^>]*aria-hidden="true"[^>]*>.*?<\/svg>Miter saw<\/span>/,
    );
  });

  it("links each of a method's tools to its glossary entry", () => {
    const html = render(<ProjectView project={project(shop)} />);
    expect(html).toMatch(/<a href="#\/glossary\/miter-saw"><span class="k-tool-label">/);
    expect(html).toMatch(/<a href="#\/glossary\/tape-measure"><span class="k-tool-label">/);
  });

  it('says which inventory the steps were chosen from, so a stale list can be found', () => {
    const withShop = readSteps(project(shop));
    const withNone = readSteps(project({ tools: [], other: [] }));
    expect(withShop?.inventoryKey).toMatch(/^[0-9a-f]{8}$/);
    expect(withShop?.inventoryKey).not.toBe(withNone?.inventoryKey);
  });

  // The worked example's board plan (core's steps.test.ts checks the numbers): the beam alone on
  // a 12' 4x6, each leg on its own 12' 4x4, and both crossbars on a 10' 2x6.
  it('cuts board by board, each piece naming its part and opening its cut detail (#58)', () => {
    const p = project(shop);
    const steps = readSteps(p)?.steps ?? [];
    const text = renderText(<ProjectView project={p} />);
    expect(text).toContain("1. Cut board 1, a 4x6 12' long: Beam");
    expect(text).toContain(
      'Trim 1/2" off the end to square it, then cut these in order, measuring each from the fresh cut. Each saw cut takes about 1/8".',
    );
    expect(text).toContain('Left over after both ends are trimmed: 22-7/8"');
    // A part with more than one piece says which piece this is.
    const crossbars = steps.find((s) => s.board?.pieces.length === 2);
    const crossbar = crossbars?.board?.pieces[1];
    if (!crossbar) throw new Error('no board with two pieces');
    const { cutList } = made.output.outputs as { cutList: CutListRow[] };
    const row = cutList.find((r) => r.partId === crossbar.partId);
    expect(text).toContain(`${row?.letter} ${row?.name} 59", piece 2 of 2`);
    // The assembly steps follow the boards.
    const titles = steps.map((s) => s.title);
    expect(titles.findIndex((t) => !t.startsWith('Cut board'))).toBe(
      steps.filter((s) => s.board).length,
    );
    // Every piece's cut detail is on the page to open.
    const html = render(<ProjectView project={p} />);
    for (const piece of steps.flatMap((s) => s.board?.pieces ?? [])) {
      expect(html).toContain(`id="${cutDetailId(piece.partId)}"`);
    }
  });

  it('shows no build steps for a plan made before operations', () => {
    const text = renderText(<ProjectView project={projectFrom(snapshot, { steps: null })} />);
    expect(text).not.toContain('Build steps');
  });
});
