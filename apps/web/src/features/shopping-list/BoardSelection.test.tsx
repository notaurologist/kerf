import { type LumberPlan, TEMPLATES } from '@kerf/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BoardSelection } from './BoardSelection.tsx';

function firstExampleLumber(): LumberPlan {
  const template = TEMPLATES[0];
  const example = template?.examples[0];
  if (!template || !example) throw new Error('no worked example');
  const result = template.generate(example.params, example.structuralInputs);
  if (!result.ok) throw new Error('worked example does not generate');
  return template.plan(result.output).lumber;
}

describe('BoardSelection', () => {
  it("shows each guide the plan's parts use, the parts it is for, and its sources", () => {
    const html = renderToString(<BoardSelection lumber={firstExampleLumber()} />);
    expect(html).toContain('<h3>Choosing boards</h3>');
    expect(html).toContain('Every board that carries load');
    expect(html).toContain('A board in or on the ground');
    expect(html).toContain('Why: ');
    expect(html).toContain('Source');
    expect(html).toContain('AWPA U1');
  });

  it('shows nothing for a plan made before board selection guides', () => {
    const { selection: _, ...older } = firstExampleLumber();
    expect(renderToString(<BoardSelection lumber={older} />)).toBe('');
  });
});
