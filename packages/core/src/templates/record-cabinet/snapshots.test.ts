import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import type { CutListRow } from '../../outputs/cutList.ts';
import { shapeOf } from '../../snapshot/shape.ts';
import { createSnapshot, readSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
import { SUGGESTED_DOOR } from './questions.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };
import v3 from './snapshots/v3.json' with { type: 'json' };
import v4 from './snapshots/v4.json' with { type: 'json' };
import v5 from './snapshots/v5.json' with { type: 'json' };
import v6 from './snapshots/v6.json' with { type: 'json' };
import v7 from './snapshots/v7.json' with { type: 'json' };
import v8 from './snapshots/v8.json' with { type: 'json' };
import v9 from './snapshots/v9.json' with { type: 'json' };

// Stored record-cabinet projects stay readable (decision 0014). Each fixture holds the worked
// examples as that template version stores them. Fixtures are never rewritten.

const FIXTURES: Record<number, readonly unknown[]> = {
  1: v1,
  2: v2,
  3: v3,
  4: v4,
  5: v5,
  6: v6,
  7: v7,
  8: v8,
  9: v9,
};
const template = recordCabinet as TemplateDefinition;

/** Cut list rows as shapes before 3 stored them, without each panel's board count. */
const withoutBoards = (rows: readonly CutListRow[]) =>
  JSON.parse(
    JSON.stringify(
      rows.map(({ panel, ...row }) => {
        if (!panel) return row;
        const { boards: _, ...rest } = panel;
        return { ...row, panel: rest };
      }),
    ),
  );
const templates = [template];

describe('record-cabinet snapshot fixtures', () => {
  it('has a fixture for every template version and every shape, and an upgrade between shapes', () => {
    const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    expect(Object.keys(FIXTURES).map(Number)).toEqual(upTo(template.version));
    const stored = Object.entries(FIXTURES).flatMap(([version, fixture]) =>
      (fixture as { templateVersion: number; snapshotVersion: number }[]).map((s) => {
        expect(s.templateVersion).toBe(Number(version));
        return s.snapshotVersion;
      }),
    );
    expect([...new Set(stored)].sort((a, b) => a - b)).toEqual(upTo(template.snapshotVersion));
    expect(Object.keys(template.snapshotUpgrades).map(Number)).toEqual(
      upTo(template.snapshotVersion - 1),
    );
  });

  it.each(Object.entries(FIXTURES))('has one snapshot per worked example in shape %s', (_, f) => {
    expect(f).toHaveLength(template.examples.length);
  });

  it('regenerates the fixture of the current template version exactly', () => {
    const generated = template.examples.map((e) => {
      const result = createSnapshot(template, e.params, e.structuralInputs);
      if (!result.ok) throw new Error(e.name);
      return JSON.parse(JSON.stringify(result.output));
    });
    expect(
      generated,
      'The worked examples generate different output at the same template version. Bump the ' +
        "template's version, and its snapshotVersion too if the stored shape changed (decision " +
        '0008), then write the new fixture: pnpm --filter @kerf/api write-snapshot-fixture ' +
        'record-cabinet (decision 0014).',
    ).toEqual(FIXTURES[template.version]);
    expect(shapeOf(generated)).toEqual(shapeOf(FIXTURES[template.version]));
  });

  it('reads a version 1 plan with no flattening, keeping its numbers', () => {
    for (const stored of v1) {
      const read = readSnapshot(templates, stored);
      if (!read.ok) throw new Error(read.message);
      const { params } = stored as {
        params: {
          allowances: object;
          board: { thickness: number };
          turntable: { width: number; depth: number; lidHeight: number };
          speaker: object;
          height: number;
          shelfHeight: number;
          cutoutHeight: number;
          footWidth: number;
          panelThickness: number;
        };
      };
      expect(read.snapshot.templateVersion).toBe(1);
      const {
        turntable,
        speaker: _,
        height,
        shelfHeight,
        cutoutHeight: __,
        footWidth: ___,
        ...kept
      } = params;
      // The turntable became the largest item on the top (#331), and the leg base's parameters
      // take the starting questions' suggestions, its bay height the plan's own (#338). It has
      // no doors, with the doors' suggested sizes ready if they are turned on (#339).
      expect(read.snapshot.params).toEqual({
        ...kept,
        allowances: { ...params.allowances, flatten: 0 },
        board: { source: 'store', ...params.board },
        topItem: { width: turntable.width, depth: turntable.depth, height: turntable.lidHeight },
        bayHeight: height - params.panelThickness - (shelfHeight + params.panelThickness),
        legShowing: 5,
        apronHeight: 2.5,
        legStock: { size: 1.5, lengths: [3, 4] },
        footSize: 1,
        apronSetback: 0.125,
        tenonThickness: Math.floor((params.board.thickness / 3) * 16) / 16,
        tenonLength: 1,
        doors: 'none',
        door: SUGGESTED_DOOR,
      });
      const outputs = recordCabinet.storedOutputs.parse(read.snapshot.outputs);
      const plan = recordCabinet.plan(outputs);
      // The saw settings are added on read (#360); the stored rows are kept as they were.
      const rows = plan.cutList.map(({ settings: _, ...row }) => row);
      expect(withoutBoards(rows)).toEqual(
        (stored as { outputs: { cutList: unknown } }).outputs.cutList,
      );
      for (const op of plan.operations.filter((o) => o.type === 'flatten')) {
        const part = outputs.design.parts.find((p) => p.id === op.partId);
        expect(op).toMatchObject({ thickness: part?.stock.thickness });
      }
      expect(recordCabinet.drawings(outputs).cutDetails).toHaveLength(plan.cutList.length);
    }
  });

  it('reads a version 2 plan with each panel row counting its boards from the part', () => {
    for (const stored of v2) {
      const read = readSnapshot(templates, stored);
      if (!read.ok) throw new Error(read.message);
      const outputs = recordCabinet.storedOutputs.parse(read.snapshot.outputs);
      const original = (stored as { outputs: { cutList: unknown } }).outputs.cutList;
      expect(withoutBoards(outputs.cutList)).toEqual(original);
      for (const row of outputs.cutList) {
        const part = outputs.design.parts.find((p) => p.id === row.partId);
        expect(row.panel?.boards).toBe(
          part && 'boards' in part.stock ? part.stock.boards : undefined,
        );
      }
    }
  });

  it('reads the current shape back exactly, dropping nothing', () => {
    for (const stored of FIXTURES[template.version] ?? []) {
      const read = readSnapshot(templates, stored);
      expect(read.ok && JSON.parse(JSON.stringify(read.snapshot))).toEqual(stored);
    }
  });
});
