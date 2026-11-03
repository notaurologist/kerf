import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import type { CutListRow } from '../../outputs/cutList.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
import { SUGGESTED_DOOR } from './questions.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };

// What upgrading a stored record-cabinet plan keeps (decision 0014). The guarantees every
// template's fixtures share are in contract.test.ts.

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
});
