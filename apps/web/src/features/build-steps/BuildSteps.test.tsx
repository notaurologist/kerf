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
import { loadedDrawings, projectFrom, stepsFor } from '../../test/projects.ts';
import { render, renderText, sectionOf, textOf } from '../../test/render.tsx';
import { TermScope } from '../../ui/index.ts';
import { ProjectView } from '../project/ProjectScreen.tsx';
import { groupOperations } from './BuildSteps.tsx';

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
};

function project(inventory: Inventory): Project {
  return projectFrom(snapshot, { steps: stepsFor(snapshot, inventory) });
}

describe('glossary terms in the plan (#178)', () => {
  const html = render(
    <TermScope entryHref={(id) => `#/glossary/${id}`}>
      <ProjectView project={project(shop)} drawings={loadedDrawings(project(shop))} />
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
    // The To do band comes first. A line's own words (a check's name, an expert check's
    // question) are not marked, since a term's button there would also open the line; terms are
    // marked in what each line opens to (#359).
    expect(marked('structural-review')).toEqual([
      'margin',
      'gusset',
      'nds',
      'grip',
      'end distances',
      'racking',
      'burial depth',
      'backfill',
      'ground contact',
      'knots',
      'midspan',
      'grain',
      'wane',
      'design values',
      'pressure-treated',
      'dynamic factor',
      'deflection',
    ]);
  });

  // Terms are reachable from every section whose text uses them, not only the build steps.
  it('marks terms in the section intros, the cut list, and the shopping list', () => {
    // The cut list's own words, then those in the expert checks on its parts (#356).
    expect(marked('cut-list')).toEqual([
      'long point',
      'flush',
      'gusset',
      'level cut',
      'burial depth',
      'ground contact',
      'edge distance',
      'nds',
      'end distance',
    ]);
    // The hardware's notes sit beside the lumber, before the guidance on choosing boards (#361).
    expect(marked('shopping-list')).toEqual([
      'through-bolt',
      'grip',
      'pressure-treated',
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
    };
    const text = renderText(
      <ProjectView project={project(named)} drawings={loadedDrawings(project(named))} />,
    );
    expect(text).toContain('With a miter saw. Tools: Miter saw (Sliding), Tape measure.');
  });

  it('renders every step and every operation from one project response', () => {
    const p = project(shop);
    const steps = readSteps(p);
    if (!steps) throw new Error('the response has no steps');
    expect(steps.steps.length).toBeGreaterThan(0);
    const text = renderText(<ProjectView project={p} drawings={loadedDrawings(p)} />);
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
    const text = renderText(
      <ProjectView project={project(shop)} drawings={loadedDrawings(project(shop))} />,
    );
    // The beam's two ends, done alike, as one line with the tools that do them (#362).
    expect(text).toContain(
      'Square crosscut × 2 A Beam, end 1; A Beam, end 2 Miter saw, Tape measure',
    );
    expect(text).toContain('With a miter saw. Tools: Miter saw, Tape measure.');
    // The legs' miters at the worked example's 20° splay.
    expect(text).toContain('Set the miter saw to 20.0°, turned the way the cut detail shows.');
    // No drill: the step says once what would allow a method.
    expect(text).toContain('No method fits your tools for');
    expect(text).toContain('Add a tool in My toolbox');
  });

  it("puts each tool's icon before its name in a method's tools (#86)", () => {
    const html = render(
      <ProjectView project={project(shop)} drawings={loadedDrawings(project(shop))} />,
    );
    expect(html).toMatch(
      /<span class="k-tool-label"><svg class="k-tool-icon"[^>]*aria-hidden="true"[^>]*>.*?<\/svg>Miter saw<\/span>/,
    );
  });

  it("links each of a method's tools to its page", () => {
    const html = render(
      <ProjectView project={project(shop)} drawings={loadedDrawings(project(shop))} />,
    );
    expect(html).toMatch(/<a href="#\/tools\/miter-saw"><span class="k-tool-label">/);
    expect(html).toMatch(/<a href="#\/tools\/tape-measure"><span class="k-tool-label">/);
  });

  it('says which inventory the steps were chosen from, so a stale list can be found', () => {
    const withShop = readSteps(project(shop));
    const withNone = readSteps(project({ tools: [] }));
    expect(withShop?.inventoryKey).toMatch(/^[0-9a-f]{8}$/);
    expect(withShop?.inventoryKey).not.toBe(withNone?.inventoryKey);
  });

  // The worked example's board plan (core's steps.test.ts checks the numbers): the beam alone on
  // a 12' 4x6, each leg on its own 12' 4x4, and both crossbars on a 10' 2x6.
  it('cuts board by board, each piece naming its part and opening its cut detail (#58)', () => {
    const p = project(shop);
    const steps = readSteps(p)?.steps ?? [];
    const text = renderText(<ProjectView project={p} drawings={loadedDrawings(p)} />);
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
    const html = render(<ProjectView project={p} drawings={loadedDrawings(p)} />);
    for (const piece of steps.flatMap((s) => s.board?.pieces ?? [])) {
      expect(html).toContain(`id="${cutDetailId(piece.partId)}"`);
    }
  });

  it('shows no build steps for a plan made before operations', () => {
    const text = renderText(
      <ProjectView
        project={projectFrom(snapshot, { steps: null })}
        drawings={loadedDrawings(projectFrom(snapshot, { steps: null }))}
      />,
    );
    expect(text).not.toContain('Build steps');
  });
});

describe('a step taken in at a glance (#362)', () => {
  const steps = readSteps(project({ tools: [] }))?.steps ?? [];
  const legs = steps.find((s) => s.id === 'board-2');
  if (!legs) throw new Error('the worked example has a second board');

  it('takes operations of one kind done alike as one group, in the order each first comes', () => {
    const groups = groupOperations(legs.operations);
    expect(groups.reduce((n, g) => n + g.ops.length, 0)).toBe(legs.operations.length);
    expect(groups.length).toBeLessThan(legs.operations.length);
    for (const g of groups) {
      const [first] = g.ops;
      for (const op of g.ops) expect(op.operation.type).toBe(first?.operation.type);
    }
  });

  it('says once per step what the tools lack, not on every operation', () => {
    const html = sectionOf(
      render(
        <ProjectView
          project={project({ tools: [] })}
          drawings={loadedDrawings(project({ tools: [] }))}
        />,
      ),
      'build-steps',
    );
    const text = textOf(html);
    expect(text.match(/No method fits your tools for/g)?.length).toBe(
      steps.filter((s) => s.operations.some((op) => !op.method && op.alternatives.length > 0))
        .length,
    );
    expect(text).not.toContain('No method fits your tools. ');
  });

  it('with an empty toolbox, offers My toolbox in the plan and its header', () => {
    const empty = project({ tools: [] });
    const html = render(<ProjectView project={empty} drawings={loadedDrawings(empty)} />);
    expect(textOf(sectionOf(html, 'build-steps'))).toContain(
      'My toolbox is empty, so no step has a way to do its work yet.',
    );
    expect(html).toContain('<a href="#/tools">Add your tools</a>');
    const stocked = render(
      <ProjectView project={project(shop)} drawings={loadedDrawings(project(shop))} />,
    );
    expect(stocked).not.toContain('My toolbox is empty');
    expect(stocked).not.toContain('Add your tools');
  });

  it("lists each operation's methods in core's order, labeled by operation", () => {
    // A circular saw that cuts 2-3/8": past half of a 4x4 leg, not through it. Core puts the
    // two-face methods first, since they use the saw the owner has.
    const saw = project({
      tools: [{ toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.375 } }],
    });
    const legs = (readSteps(saw)?.steps ?? []).find((s) => s.title.includes('Front leg'));
    const html = render(<ProjectView project={saw} drawings={loadedDrawings(saw)} />);
    const text = textOf(sectionOf(html, 'build-steps'));
    const start = text.indexOf(legs?.title ?? '?');
    const step = text.slice(start, text.indexOf('Miter × 2', start));
    expect(step).toContain(
      'Miter, closest to your tools first: With a circular saw, from two faces: you need',
    );
    expect(step).toContain(
      'Taper, closest to your tools first: With a circular saw, from two faces: you need Hand saw',
    );
    const order = [
      'With a circular saw, from two faces',
      'With a circular saw:',
      'With a miter saw',
      'With a hand saw',
    ];
    const miter = step.slice(step.indexOf('Miter, closest'), step.indexOf('Taper, closest'));
    const at = order.map((m) => miter.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('puts the saw settings beside a mitered piece, and none beside a square one', () => {
    const text = textOf(
      sectionOf(
        render(<ProjectView project={project(shop)} drawings={loadedDrawings(project(shop))} />),
        'build-steps',
      ),
    );
    // Each setting named for its end, and whether the ends are parallel (#455).
    expect(text).toMatch(
      /B Back leg \(uphill\) 131-1\/2", piece 1 of 2 Top 20\.0° Foot 20\.0° Ends parallel/,
    );
    expect(text).toMatch(/D Crossbar 59", piece 1 of 2 End 1 20\.0° End 2 20\.0° Ends mirror/);
    expect(text).toMatch(/A Beam 120" (?!\d)/);
  });
});
