import { describe, expect, it } from 'vitest';
import type { Instance } from './instance.ts';
import { BASELINE, BOUNDS, exact, formatReport, formatWorkLimits, runMethods } from './report.ts';

const INSTANCE: Instance = {
  nominal: '2x4',
  lengths: [8, 10],
  pieces: [
    { partId: 'a', name: 'A', length: 60 },
    { partId: 'b', name: 'B', length: 30 },
  ],
  kerf: 0.125,
  trimPerEnd: 0.5,
};

describe('runMethods', () => {
  it('measures each method on each instance', () => {
    const rows = runMethods([{ source: 'test', instance: INSTANCE }], [BASELINE]);
    expect(rows).toMatchObject([
      { source: 'test', pieces: 2, results: [{ method: BASELINE.name, feet: 8, boards: 1 }] },
    ]);
    expect(formatReport(rows, [BASELINE])).toContain('| test | 2 | 8 / 1 |');
  });

  it('reports each bound and how far each method is over the best', () => {
    // 60" and 30" with their kerf and trim use 91.25" of an 8' board's 96", so both bounds are 8.
    const rows = runMethods([{ source: 'test', instance: INSTANCE }], [BASELINE], BOUNDS);
    expect(rows[0]?.bounds).toEqual([
      { name: 'material', feet: 8 },
      { name: 'linear relaxation', feet: 8 },
    ]);
    const report = formatReport(rows, [BASELINE]);
    expect(report).toContain('| test | 2 | 8 | 8 | 8 / 1 |');
    expect(report).toContain('## Open instances (0)');
  });

  it('refuses a plan the checker finds a problem with', () => {
    const dropsAPiece = { name: 'drops a piece', plan: () => ({ boards: [], unfit: [0] }) };
    expect(() => runMethods([{ source: 'test', instance: INSTANCE }], [dropsAPiece])).toThrow(
      'drops a piece on test:',
    );
  });

  // 60, 60, 36 and 36 on 8' and 10' boards: first-fit decreasing buys 18 ft, the exact method 16
  // ft once it has the work to find it, so it saves 2 ft at the higher limit and none at zero.
  it('reports the feet saved at each work limit, by template', () => {
    const instance: Instance = {
      nominal: 'x',
      lengths: [8, 10],
      pieces: [60, 60, 36, 36].map((length, i) => ({ partId: `${i}`, name: `${i}`, length })),
      kerf: 0,
      trimPerEnd: 0,
    };
    const limits = [0, 1e6].map((limit) => ({ limit, method: exact(limit) }));
    const rows = runMethods(
      [{ source: 'shelf / example', instance }],
      [BASELINE, ...limits.map((l) => l.method)],
    );
    const report = formatWorkLimits(rows, BASELINE, limits);
    expect(report).toContain('| 0M | 0 | 0 | 0% | 0 of 1 | 0 |');
    expect(report).toContain('| 1M | 2 | 2 | 100% | 1 of 1 | 2 |');
  });
});
