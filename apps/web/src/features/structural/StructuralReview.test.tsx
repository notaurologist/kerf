import { describe, expect, it } from 'vitest';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, sectionOf, textOf } from '../../test/render.tsx';
import { ProjectView } from '../project/ProjectScreen.tsx';

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
    expect(review).toContain('Enter structural inputs');
    expect(review).not.toContain('under these assumptions');
  });
});

describe('every stored worked example', () => {
  it.each([complete, noInputs, builtUp].map((s, i) => [i, s] as const))(
    'example %i has no verdict words and no unrounded numbers',
    (_i, snapshot) => {
      const review = text(snapshot);
      expect(review).not.toMatch(/\b(safe|unsafe|pass|passes|passed|fail|fails|failed)\b/i);
      expect(review.match(/\d+\.\d{4,}/g) ?? []).toEqual([]);
    },
  );
});
