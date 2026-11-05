import { describe, expect, it } from 'vitest';
import type { Instance } from './instance.ts';
import { BASELINE, BOUNDS, formatReport, runMethods } from './report.ts';

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
});
