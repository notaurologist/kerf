import { describe, expect, it } from 'vitest';
import { lowestMargin } from './lowest.ts';
import type { CheckResult } from './types.ts';

// The lowest margin is given only when every check has a margin: a check without one could be
// the lowest (#119).

type Kind = CheckResult['kind'];
const header = (kind: Kind) => ({ kind, title: kind, subject: 'Member', loadCase: 'Case' });
const quantity = { symbol: 'x', label: 'x', value: 1, unit: '' };
const computed = (kind: Kind, margin: number): CheckResult => ({
  ...header(kind),
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
const needed = (kind: Kind): CheckResult => ({
  ...header(kind),
  status: 'input-needed',
  missing: [{ key: 'k', label: 'Species and grade' }],
});
const notComputed = (kind: Kind): CheckResult => ({
  ...header(kind),
  status: 'not-computed',
  reason: 'No design value.',
  sources: [],
});

describe('lowestMargin', () => {
  it('picks the check with the lowest margin when every check has one', () => {
    const result = lowestMargin([
      computed('beam-bending', 3.5),
      computed('beam-shear', 1.08),
      computed('beam-deflection', 3.13),
    ]);
    expect(result.status).toBe('computed');
    expect(result.status === 'computed' && result.check.kind).toBe('beam-shear');
  });

  it('takes the first of equal margins, in plan order', () => {
    const result = lowestMargin([computed('beam-bending', 2), computed('beam-shear', 2)]);
    expect(result.status === 'computed' && result.check.kind).toBe('beam-bending');
  });

  it('gives no margin while any check needs input, and says how many', () => {
    expect(
      lowestMargin([
        computed('beam-bending', 0.5),
        needed('beam-shear'),
        needed('beam-deflection'),
      ]),
    ).toEqual({
      status: 'input-needed',
      count: 2,
      of: 3,
    });
  });

  it('puts input needed before not computed, since input is something to enter', () => {
    expect(lowestMargin([notComputed('beam-bending'), needed('beam-shear')]).status).toBe(
      'input-needed',
    );
    expect(lowestMargin([computed('beam-bending', 4), notComputed('beam-shear')])).toEqual({
      status: 'not-computed',
      count: 1,
      of: 2,
    });
  });

  it('says so when there are no checks', () => {
    expect(lowestMargin([])).toEqual({ status: 'no-checks' });
  });
});
