import { movement } from '@kerf/core';
import { VERDICT_WORDS } from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from '../project/ProjectScreen.tsx';
import { StructuralReview } from './StructuralReview.tsx';

const [complete, noInputs, builtUp] = storedSnapshots;
if (!complete || !noInputs || !builtUp) throw new Error('fixture has three worked examples');
/** The plan's structural review section, as text. */
const text = (snapshot: typeof complete) =>
  textOf(sectionOf(render(<ProjectView project={projectFrom(snapshot)} />), 'structural-review'));

describe('the structural review, worked example with every input', () => {
  const review = text(complete);

  it("shows each check's margin under its assumptions", () => {
    // Bending margin 1.08 (spec, Structural model, worked example).
    expect(review).toContain('Bending: Top beam, 4x6');
    expect(review).toContain('margin 1.1x under these assumptions');
    expect(review).toContain('Rated load: Swing hanger');
    expect(review).toContain('margin 4.0x under these assumptions');
  });

  it('shows the full working: inputs, formulas, steps, factors, assumptions, and sources', () => {
    expect(review).toContain('Show the working');
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

  it('shows the checklist and the expert-check flags', () => {
    expect(review).toContain('Confirmation checklist');
    expect(review).toContain('Leg-to-beam bolt and gusset, each frame');
    expect(review).toContain('Expert check · Load-bearing design');
    expect(review).toContain('Load-bearing design');
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
    const edit = `#/projects/${projectFrom(noInputs).id}/edit`;
    expect(html).toContain(`<a href="${edit}?field=s-beamSpeciesGrade">Beam species and grade</a>`);
    expect(html).toContain(
      `<a href="${edit}?field=s-hangerRating">Swing hanger rated working load</a>`,
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
        />,
      ),
    );
    expect(none).not.toContain('Wood movement');
  });
});
