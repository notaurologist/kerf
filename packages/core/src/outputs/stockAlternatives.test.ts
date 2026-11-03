import { describe, expect, it } from 'vitest';
import type { FieldRef } from '../model/form.ts';
import type { CheckResult } from '../structural/types.ts';
import { describeLumberAlternative, type LumberPlan } from './shoppingList.ts';
import { type StockField, withStockAlternatives } from './stockAlternatives.ts';

// Another stock size is offered only when the checks that read it keep at least the margin the
// plan has now (#450). Checks and regenerated plans are made up here; the swing set's own are in
// its lists tests.

const quantity = { symbol: 'x', label: 'x', value: 1, unit: '' };
const computed = (title: string, margin: number): CheckResult => ({
  kind: 'beam-bending',
  title,
  subject: 'Beam',
  loadCase: 'Case',
  status: 'computed',
  inputs: [],
  formulas: [],
  steps: [],
  factors: [],
  assumptions: [],
  sources: [],
  computed: quantity,
  allowable: quantity,
  margin,
});
const needed = (title: string): CheckResult => ({
  kind: 'beam-bending',
  title,
  subject: 'Beam',
  loadCase: 'Case',
  status: 'input-needed',
  missing: [{ key: 'k', label: 'Species and grade' }],
});

const lumber: LumberPlan = {
  boards: [
    {
      nominal: '4x6',
      feet: 12,
      pieces: [{ partId: 'beam', name: 'Beam', length: 120 }],
      offcut: 1,
    },
    { nominal: '4x4', feet: 12, pieces: [{ partId: 'leg', name: 'Leg', length: 130 }], offcut: 1 },
  ],
  kerf: 0.125,
  trimPerEnd: 0.5,
  lines: [
    { nominal: '4x6', feet: 12, count: 1, notes: [], alternatives: [] },
    { nominal: '4x4', feet: 12, count: 1, notes: [], alternatives: [] },
  ],
  notes: [],
  issues: [],
  selection: [],
};

const beam: StockField = {
  path: 'beamStock',
  name: 'Beam',
  partIds: ['beam'],
  current: '4x6',
  options: ['4x4', '4x6', '4x8', '6x6'],
};
const legs: StockField = {
  path: 'legStock',
  name: 'Legs',
  partIds: ['leg'],
  current: '4x4',
  options: ['4x4', '4x6'],
};

// Bending reads the beam's size; the hanger check reads neither field.
const checkFields = (check: CheckResult): FieldRef[] =>
  check.title === 'Bending' ? [{ from: 'params', path: 'beamStock' }] : [];

describe('withStockAlternatives', () => {
  it('offers the sizes that keep the margin, highest first, on the lines of their parts', () => {
    const margins: Record<string, number | null> = { '4x4': 1.2, '4x8': 3.1, '6x6': 2.4 };
    const asked: string[] = [];
    const result = withStockAlternatives(
      lumber,
      [computed('Bending', 2.4), computed('Hanger', 1.5)],
      [beam, legs],
      checkFields,
      (path, nominal) => {
        asked.push(`${path} ${nominal}`);
        const margin = margins[nominal];
        return margin == null ? null : [computed('Bending', margin), computed('Hanger', 1.5)];
      },
    );
    // 4x4 lowers the margin and is left out; 6x6 equals it. No check reads the legs' size.
    expect(result.lines[0]?.alternatives).toEqual([
      {
        kind: 'stock',
        name: 'Beam',
        field: 'beamStock',
        nominal: '4x8',
        margin: 3.1,
        check: { title: 'Bending', subject: 'Beam' },
      },
      {
        kind: 'stock',
        name: 'Beam',
        field: 'beamStock',
        nominal: '6x6',
        margin: 2.4,
        check: { title: 'Bending', subject: 'Beam' },
      },
    ]);
    expect(result.lines[1]?.alternatives).toEqual([]);
    expect(asked).toEqual(['beamStock 4x4', 'beamStock 4x8', 'beamStock 6x6']);
  });

  it('leaves out a size the template cannot generate', () => {
    const result = withStockAlternatives(
      lumber,
      [computed('Bending', 2)],
      [beam],
      checkFields,
      (_, nominal) => (nominal === '4x8' ? [computed('Bending', 3)] : null),
    );
    expect(result.lines[0]?.alternatives.map((a) => 'nominal' in a && a.nominal)).toEqual(['4x8']);
  });

  it('says the margins need the structural inputs while a check that reads the size has none', () => {
    const result = withStockAlternatives(lumber, [needed('Bending')], [beam], checkFields, () => {
      throw new Error('nothing is generated without a margin to compare');
    });
    expect(result.lines[0]?.alternatives).toEqual([
      { kind: 'stock-needs-inputs', name: 'Beam', field: 'beamStock' },
    ]);
  });
});

describe('describeLumberAlternative', () => {
  const line = { nominal: '4x4' };
  it('names the boards to buy instead, a shorter one with the length it must measure', () => {
    expect(
      describeLumberAlternative(
        {
          kind: 'lengths',
          boards: [
            { feet: 10, count: 1 },
            { feet: 8, count: 2 },
          ],
        },
        line,
      ),
    ).toBe(`1 × 4x4, 10' 0" and 2 × 4x4, 8' 0".`);
    // A lower limit rounds up to the 1/16: 121.13 reads 121-3/16", never short.
    expect(
      describeLumberAlternative({ kind: 'measured', feet: 10, count: 2, atLeast: 121.13 }, line),
    ).toBe(`2 × 4x4, 10' 0", if each measures at least 121-3/16".`);
  });

  it('gives another size its margin, and says when the margin needs inputs', () => {
    expect(
      describeLumberAlternative(
        {
          kind: 'stock',
          name: 'Legs',
          field: 'legStock',
          nominal: '6x6',
          margin: 1.1234,
          check: { title: 'Bending', subject: 'Top beam' },
        },
        line,
      ),
    ).toBe(
      'Legs in 6x6, which changes the plan: margin 1.1x under these assumptions (bending, top beam).',
    );
    expect(
      describeLumberAlternative(
        { kind: 'stock-needs-inputs', name: 'Legs', field: 'legStock' },
        line,
      ),
    ).toBe(
      "Legs in another size changes the plan. Each size's margin is given once the structural inputs are entered.",
    );
  });
});
