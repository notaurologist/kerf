import type { LumberPlan } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { renderText } from '../../test/render.tsx';
import { ShoppingList } from './ShoppingList.tsx';

const plan = (lines: LumberPlan['lines']): LumberPlan => ({
  boards: [],
  kerf: 0.125,
  trimPerEnd: 0.5,
  lines,
  notes: [],
  issues: [],
  selection: [],
});
const shown = (lines: LumberPlan['lines']) =>
  renderText(<ShoppingList lumber={plan(lines)} hardware={[]} hardwareNotes={[]} />);

describe('ShoppingList', () => {
  it('adds board feet, rounded up to a tenth, for hardwood sold by the board foot', () => {
    const text = shown([{ nominal: '4/4 hardwood', feet: 6, count: 2, boardFeet: 7.2000001 }]);
    expect(text).toContain('Board feet');
    expect(text).toContain('7.3');
  });

  it('leaves the column out when nothing is sold by the board foot', () => {
    expect(shown([{ nominal: '2x4', feet: 8, count: 1 }])).not.toContain('Board feet');
  });
});
