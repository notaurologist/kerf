import { DEFAULT_BOARD_OPTIONS, planLumber } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { firstFitDecreasing } from './baseline.ts';
import { planProblems } from './check.ts';
import { type Instance, instancesFromParts } from './instance.ts';
import { templatePlans } from './sources.ts';

describe('firstFitDecreasing', () => {
  // Pieces 70, 50, 40, 20" on 8' and 10' boards, kerf 1/8", trim 1/2" each end. Longest first
  // into 120": 70 opens a board (71.125"), 50 joins it (121.25" is over), so opens a second
  // (51.125"); 40 joins the first (111.25"); 20 joins the second (71.25" + ... = 1 + 50.125 +
  // 20.125 = 71.25"). Then each is shortened: 111.25" needs 10', 71.25" fits 8'.
  it('matches a hand-worked example', () => {
    const instance: Instance = {
      nominal: '2x4',
      lengths: [8, 10],
      pieces: [20, 70, 40, 50].map((length, i) => ({ partId: `${i}`, name: `${i}`, length })),
      kerf: 0.125,
      trimPerEnd: 0.5,
    };
    expect(firstFitDecreasing(instance)).toEqual({
      boards: [
        { feet: 10, pieces: [1, 2] },
        { feet: 8, pieces: [3, 0] },
      ],
      unfit: [],
    });
  });
});

/** The baseline's boards in `planLumber`'s shape, for comparing board for board. */
function asShoppingBoards(instances: Instance[]) {
  return instances.flatMap((instance) =>
    firstFitDecreasing(instance).boards.map((board) => ({
      nominal: instance.nominal,
      feet: board.feet,
      pieces: board.pieces.map((i) => instance.pieces[i]),
    })),
  );
}

describe("today's grouping, board for board", () => {
  const plans = templatePlans({ sweepCount: 60, seed: 544 });

  it('covers every template, from examples and sweeps', () => {
    for (const id of ['swing-set-a-frame', 'record-cabinet', 'workbench']) {
      expect(plans.some((p) => p.source.startsWith(`${id} / sweep`))).toBe(true);
      expect(plans.some((p) => p.source.startsWith(id) && !p.source.includes('sweep'))).toBe(true);
    }
  });

  it.each(plans.map((p) => [p.source, p.parts] as const))(
    'matches the shopping list for %s',
    (_, parts) => {
      const instances = instancesFromParts(parts, DEFAULT_BOARD_OPTIONS);
      for (const instance of instances) {
        expect(planProblems(instance, firstFitDecreasing(instance))).toEqual([]);
      }
      const core = planLumber(parts).boards.map(({ nominal, feet, pieces }) => ({
        nominal,
        feet,
        pieces,
      }));
      expect(asShoppingBoards(instances)).toEqual(core);
    },
  );
});
