import { describe, expect, it } from 'vitest';
import type { Instance } from './instance.ts';
import { BASELINE, formatReport, runMethods } from './report.ts';

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

  it('refuses a plan the checker finds a problem with', () => {
    const dropsAPiece = { name: 'drops a piece', plan: () => ({ boards: [], unfit: [0] }) };
    expect(() => runMethods([{ source: 'test', instance: INSTANCE }], [dropsAPiece])).toThrow(
      'drops a piece on test:',
    );
  });
});
