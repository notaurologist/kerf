import {
  checklistProgressKey,
  createSnapshot,
  findTemplate,
  flagProgressKey,
  movement,
  type TemplateDefinition,
} from '@kerf/core';
import { VERDICT_WORDS } from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { readPlan } from '../../lib/plan.ts';
import { noTicks, projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from '../project/ProjectScreen.tsx';
import { byMargin, StructuralReview } from './StructuralReview.tsx';

const swingSet = findTemplate('swing-set-a-frame') as TemplateDefinition;
const [complete, noInputs, builtUp] = storedSnapshots;
if (!complete || !noInputs || !builtUp) throw new Error('fixture has three worked examples');
/** The plan's structural review section, as text. */
const text = (snapshot: typeof complete) =>
  textOf(sectionOf(render(<ProjectView project={projectFrom(snapshot)} />), 'structural-review'));

describe('the structural review, worked example with every input', () => {
  const review = text(complete);
  const html = sectionOf(
    render(<ProjectView project={projectFrom(complete)} />),
    'structural-review',
  );

  it('puts what the owner has to do first, then the checks, lowest margin first (#359)', () => {
    expect(review.indexOf('To do ·')).toBeLessThan(review.indexOf('Checks'));
    expect(review.indexOf('Expert checks')).toBeLessThan(review.indexOf('Confirmation checklist'));
    const lines = [...html.matchAll(/class="k-result-line__result">([^<]*)</g)].map((m) => m[1]);
    const margins = lines
      .filter((l) => l?.startsWith('margin'))
      .map((l) => Number(l?.slice(7, -1)));
    expect(margins.length).toBe(4);
    expect(margins).toEqual([...margins].sort((a, b) => a - b));
  });

  it('opens each check from a line naming it, its load case, and its margin', () => {
    expect(html).toMatch(
      /<details class="k-disclosure" data-variant="line"><summary><span><span class="k-result-line"><span class="k-result-line__what"><b>Bending: Top beam, 4x6<\/b>/,
    );
    expect(html).toContain('<span class="k-result-line__result">margin 1.1x</span>');
  });

  it("shows each check's margin under its assumptions", () => {
    // Bending margin 1.08 (spec, Structural model, worked example).
    expect(review).toContain('Bending: Top beam, 4x6');
    expect(review).toContain('margin 1.1x under these assumptions');
    expect(review).toContain('Rated load: Swing hanger');
    expect(review).toContain('margin 4.0x under these assumptions');
  });

  it('shows the full working: inputs, formulas, steps, factors, assumptions, and sources', () => {
    expect(review).toContain(
      'Span between support centerlines (From the template geometry) Source National Design Specification (NDS) for Wood Construction (2024), 3.2.1, p. 17 92.5 in (92-1/2")',
    );
    expect(review).toContain('f_b = M / S');
    expect(review).toContain('Section modulus 17.6 in³');
    expect(review).toContain('C_D Load duration (on Fb, Fv) 1');
    expect(review).toContain('Smooth pendulum');
    expect(review).toContain(
      'National Design Specification (NDS) for Wood Construction (2024), 3.3.2',
    );
  });

  it('lets a long value break between its readings, so a stacked row fits at 320 px (#152)', () => {
    const html = sectionOf(
      render(<ProjectView project={projectFrom(complete)} />),
      'structural-review',
    );
    expect(html).toContain(
      '<span class="k-length">170.2 in</span> <span class="k-length">(170-3/16&quot;)</span>',
    );
    expect(html).not.toMatch(/class="k-length">[^<]* \(/);
  });

  it('says where each strength check reaches margin 1.0 as the dynamic factor grows (#401)', () => {
    // A plan made now: the stored fixture predates the break-even factor.
    const made = createSnapshot(swingSet, complete.params, complete.structuralInputs);
    if (!made.ok) throw new Error('worked example should generate');
    const review = text(JSON.parse(JSON.stringify(made.output)));
    expect(review).toContain(
      'With the other inputs as entered: margin 1.0 or more while the dynamic factor is 2.1 or less.',
    );
    expect(review).toContain(
      'With the other inputs as entered: margin 1.0 or more while the dynamic factor is 8.0 or less.',
    );
    expect(review.match(/With the other inputs as entered/g)).toHaveLength(3);
  });

  it('shows the checklist and the expert-check flags', () => {
    expect(review).toContain('Confirmation checklist');
    expect(review).toContain('Leg-to-beam bolt and gusset, each frame');
    expect(review).toContain('Ask an experienced builder, and tick Asked once you have.');
    expect(review).toContain('Load-bearing design Why: This joint and the gusset carry the beam');
    expect(review).toContain('Load-bearing design');
  });
});

describe('ticks in the To do band (#393)', () => {
  const plan = readPlan(projectFrom(complete));
  if (!plan.ok) throw new Error(plan.message);
  const { flags, checklist } = plan.plan;
  const [flag] = flags;
  const [item] = checklist;
  if (!flag || !item) throw new Error('the worked example has expert checks and a checklist');
  const project = projectFrom(complete, {
    id: '6f1c2a3e-0000-4000-8000-000000000393',
    ticks: [
      { kind: 'flag', key: flagProgressKey(flag), doneAt: '2026-11-02T12:00:00.000Z' },
      {
        kind: 'checklist-item',
        key: checklistProgressKey(item),
        doneAt: '2026-11-02T12:00:00.000Z',
      },
    ],
  });
  const html = render(<ProjectView project={project} section="structural-review" />);
  const review = sectionOf(html, 'structural-review');

  it('gives each expert check an Asked tick and each checklist item a Confirmed one', () => {
    expect(review.match(/type="checkbox"/g)).toHaveLength(flags.length + checklist.length);
    expect(textOf(review).match(/Asked: /g)).toHaveLength(flags.length);
    expect(textOf(review).match(/Confirmed: /g)).toHaveLength(checklist.length);
    expect(textOf(review)).toContain(`Asked: ${flag.ask}`);
    expect(textOf(review)).toContain(`Confirmed: ${item.element}`);
  });

  it('shows the saved ticks, and counts only what is still open', () => {
    expect(review.match(/checked=""/g)).toHaveLength(2);
    // Every input is entered, so the count is the expert checks and checklist items not ticked.
    expect(textOf(review)).toContain(`To do · ${flags.length + checklist.length - 2}`);
  });

  it('counts only the expert checks not yet asked in the project header', () => {
    const open = flags.length - 1;
    expect(textOf(html)).toContain(`${open} ${open === 1 ? 'expert check' : 'expert checks'}`);
    expect(textOf(html)).not.toContain(`${flags.length} expert checks`);
  });
});

describe('the structural review, no structural inputs', () => {
  const review = text(noInputs);

  it('says input needed for every check, with what is missing and where to enter it', () => {
    expect(review.match(/Input needed/g)).toHaveLength(4);
    expect(review).toContain('Beam species and grade');
    expect(review).toContain('Swing hanger rated working load');
    expect(review).not.toContain('under these assumptions');
  });

  it('links each missing input to its own field in Edit', () => {
    const html = sectionOf(
      render(<ProjectView project={projectFrom(noInputs)} />),
      'structural-review',
    );
    // With inputs needed the project opens on the review, so Edit returns there.
    const edit = `#/projects/${projectFrom(noInputs).id}/edit?from=structural-review`;
    expect(html).toContain(
      `<a href="${edit}&amp;field=s-beamSpeciesGrade">Beam species and grade</a>`,
    );
    expect(html).toContain(
      `<a href="${edit}&amp;field=s-hangerRating">Swing hanger rated working load</a>`,
    );
  });
});

describe('every stored worked example', () => {
  it.each([complete, noInputs, builtUp].map((s, i) => [i, s] as const))(
    'example %i has no verdict words and no unrounded numbers',
    (_i, snapshot) => {
      const review = text(snapshot);
      expect(review).not.toMatch(VERDICT_WORDS);
      expect(review.match(/\d+\.\d{4,}/g) ?? []).toEqual([]);
    },
  );
});

describe('wood movement in the structural review', () => {
  const missing = (label: string) => ({ missing: [{ key: label, label }] });
  const results = [
    // A 15" cherry panel, flatsawn, 6% to 10%: 15 · 0.00248 · 4 = 0.1488 in (movement.test.ts in core).
    movement.woodMovement({
      subject: 'Left side',
      width: 15,
      species: { value: 'black-cherry' },
      orientation: { value: 'flatsawn' },
      moisture: { value: { low: 6, high: 10 } },
    }),
    movement.woodMovement({
      subject: 'Top',
      width: 15.75,
      species: missing('Species'),
      orientation: { value: 'unknown' },
      moisture: { value: { low: 6, high: 10 } },
    }),
    movement.woodMovement({
      subject: 'Back rail',
      width: 3,
      species: { value: 'black-cherry' },
      orientation: { value: 'flatsawn' },
      moisture: { value: { low: 4, high: 10 } },
    }),
  ];
  const html = render(
    <StructuralReview
      inputHref={(key) => `#/edit?field=s-${key}`}
      checks={[]}
      flags={[]}
      checklist={[]}
      ticks={noTicks}
      movement={results}
    />,
  );
  const review = textOf(html);

  it('shows each estimate with its working, and says it is not a check', () => {
    expect(review).toContain('Wood movement');
    expect(review).toContain('not checks, so they have no margin');
    expect(review).toContain('Left side');
    expect(review).toContain('Changes about 0.149 in across the grain');
    expect(review).toContain('ΔD = D · C_T · (M_F − M_I)');
    expect(review).toContain('Coefficients are species averages');
  });

  it('asks for a missing input, and says why one is not computed', () => {
    expect(review).toContain('Input needed: Species');
    expect(html).toContain('<a href="#/edit?field=s-Species">Species</a>');
    expect(review).toContain('Not computed. Moisture content from 4% to 10% is outside 6% to 14%');
  });

  it('lists its sources with the checks', () => {
    expect(review).toContain('Publications these checks draw on');
    expect(review).toContain('Wood Handbook');
  });

  it('says no verdicts', () => {
    expect(review).not.toMatch(VERDICT_WORDS);
  });

  it('leaves the subsection out when the plan has no estimates', () => {
    const none = textOf(
      render(
        <StructuralReview
          inputHref={(key) => `#/edit?field=s-${key}`}
          checks={[]}
          flags={[]}
          checklist={[]}
          ticks={noTicks}
        />,
      ),
    );
    expect(none).not.toContain('Wood movement');
  });
});

describe('byMargin', () => {
  const check = (
    subject: string,
    status: 'computed' | 'input-needed' | 'not-computed',
    margin = 0,
  ) => ({ subject, status, margin }) as unknown as Parameters<typeof byMargin>[0][number];

  it('puts checks waiting for inputs first, then the lowest margin, then those not computed', () => {
    const ordered = byMargin([
      check('a', 'computed', 3.1),
      check('b', 'not-computed'),
      check('c', 'computed', 1.1),
      check('d', 'input-needed'),
    ]);
    expect(ordered.map((c) => c.subject)).toEqual(['d', 'c', 'a', 'b']);
  });
});
