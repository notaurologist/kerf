import { describe, expect, it } from 'vitest';
import { BOARD_GUIDES } from '../knowledge/boardSelection.ts';
import type { CutListRow } from '../outputs/cutList.ts';
import type { LumberPlan } from '../outputs/shoppingList.ts';
import type { CheckResult } from '../structural/types.ts';
import type { ChecklistItem, Flag } from '../templates/types.ts';
import type { BuildStep, FilledMethod } from './build.ts';
import { planTerms, planText } from './terms.ts';

const flag = (ask: string, why: string) => ({ category: 'load-bearing', ask, why }) as Flag;
const row = (ends: string[]) => ({ ends }) as CutListRow;
const plan = (p: {
  flags?: Flag[];
  checks?: Pick<CheckResult, 'title' | 'subject' | 'loadCase'>[];
  checklist?: Pick<ChecklistItem, 'confirm' | 'why'>[];
  cutList?: CutListRow[];
  lumber?: Pick<LumberPlan, 'notes' | 'selection'>;
  hardwareNotes?: string[];
}) => ({
  flags: p.flags ?? [],
  checks: (p.checks ?? []) as CheckResult[],
  checklist: (p.checklist ?? []) as ChecklistItem[],
  cutList: p.cutList ?? [],
  lumber: (p.lumber ?? { notes: [] }) as LumberPlan,
  hardwareNotes: p.hardwareNotes ?? [],
});
const method = (m: Partial<FilledMethod>): FilledMethod => ({
  id: 'm',
  name: 'M',
  tools: [],
  setup: [],
  technique: [],
  mistakes: [],
  safety: [],
  ...m,
});
const step = (flags: Flag[], methods: FilledMethod[]) =>
  ({
    flags: flags.map((f) => ({ ...f, sources: [] })),
    operations: methods.map((m) => ({ method: m })),
  }) as unknown as BuildStep;

describe('planTerms', () => {
  it('finds terms in flags, end cuts, and method setup, technique, and mistakes', () => {
    const p = plan({
      flags: [flag('Confirm the gusset.', 'It holds.')],
      cutList: [row(['Square'])],
    });
    const steps = [
      step(
        [flag('Ask about the margins.', 'Why.')],
        [
          method({
            setup: ['Set no bevel.'],
            technique: ['Mark the long point.'],
            mistakes: ['Cutting on the waste side loses the kerf.'],
            safety: [{ text: 'Mind the offcut.', sources: [] }],
          }),
        ],
      ),
    ];
    expect(planTerms(p, steps).map((e) => e.id)).toEqual([
      'bevel',
      'gusset',
      'kerf',
      'long-point',
      'margin',
      'waste-side',
    ]);
  });

  it('lists each term once, in the glossary’s alphabetical order', () => {
    const p = plan({
      flags: [flag('The stock and the stock.', 'A miter.')],
      cutList: [row(['Top: miter', 'Foot: bevel'])],
    });
    expect(planTerms(p, []).map((e) => e.term)).toEqual(['Bevel', 'Miter', 'Stock']);
  });

  it('leaves out tool names and steps with no method', () => {
    const steps = [step([], []), step([], [method({ technique: ['Set the miter saw.'] })])];
    expect(planText(plan({}), steps)).toEqual(['Set the miter saw.']);
    expect(planTerms(plan({}), steps)).toEqual([]);
  });

  it('finds terms in check names, load cases, the checklist, and the shopping list’s notes', () => {
    const p = plan({
      checks: [{ title: 'Bending', subject: 'Gusset', loadCase: 'Both riders' }],
      checklist: [{ confirm: 'Confirm the plumb leg.', why: 'Why.' }],
      lumber: { notes: ['Buy extra stock.'] },
      hardwareNotes: ['Allow for the counterbore.'],
    });
    expect(planTerms(p, []).map((e) => e.id)).toEqual([
      'bending-stress',
      'counterbore',
      'gusset',
      'plumb',
      'stock',
    ]);
  });

  it('includes the board selection guides the plan’s parts use, and no others', () => {
    const [used, unused] = BOARD_GUIDES;
    if (!used || !unused) throw new Error('Expected two board selection guides.');
    const text = planText(
      plan({ lumber: { notes: [], selection: [{ partId: 'leg', guides: [used.id] }] } }),
      [],
    );
    expect(text).toEqual(used.checks.flatMap((c) => [c.look, c.why]));
  });

  it('adds the terms in the screens’ own words', () => {
    expect(
      planTerms(plan({}), [], ['Lengths are long point to long point.']).map((e) => e.id),
    ).toEqual(['long-point']);
  });
});
