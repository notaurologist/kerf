import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { fillMissing } from '../../model/suggested.ts';
import type { CutListRow } from '../../outputs/cutList.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };
import v6 from './snapshots/v6.json' with { type: 'json' };

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
      // The turntable became the largest item on the top (#331), and the bay height is the
      // plan's own (#338). It has no doors (#339). The leg base's and the doors' sizes, which it
      // never had, stay missing.
      expect(read.snapshot.params).toEqual({
        ...kept,
        allowances: { ...params.allowances, flatten: 0 },
        board: { source: 'store', ...params.board },
        topItem: { width: turntable.width, depth: turntable.depth, height: turntable.lidHeight },
        bayHeight: height - params.panelThickness - (shelfHeight + params.panelThickness),
        doors: 'none',
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

  it('keeps the weight on the top only where the turntable stood there alone', () => {
    const stored = v6[0] as { params: { speaker: object }; structuralInputs: object };
    const alone = {
      ...stored,
      params: { ...stored.params, speaker: { ...stored.params.speaker, place: 2 } },
    };
    const read = (s: unknown) => {
      const r = readSnapshot(templates, s);
      if (!r.ok) throw new Error(r.message);
      return r.snapshot.structuralInputs as Record<string, unknown>;
    };
    // The speaker on the top: 20 lb and 13.89 lb were entered, and their sum never was.
    expect(stored.structuralInputs).toMatchObject({ turntableWeight: 20, speakerWeight: 13.89 });
    expect(read(stored)).not.toHaveProperty('topLoad');
    expect(read(alone)).toMatchObject({ topLoad: 20 });
    for (const inputs of [read(stored), read(alone)]) {
      expect(inputs).not.toHaveProperty('turntableWeight');
      expect(inputs).not.toHaveProperty('speakerWeight');
    }
  });

  it('suggests the leg base and door sizes a plan from before them lacks, with their basis', () => {
    const stored = v1[0] as { params: { board: { thickness: number } } };
    const read = readSnapshot(templates, stored);
    if (!read.ok) throw new Error(read.message);
    const filled = fillMissing(template, read.snapshot);
    // Version 1's boards are 3/4" thick: a tenon a third of that is 1/4".
    expect(stored.params.board.thickness).toBe(0.75);
    expect(filled.params).toEqual({
      ...(read.snapshot.params as object),
      legShowing: 5,
      apronHeight: 2.5,
      legStock: { size: 1.5, lengths: [3, 4] },
      footSize: 1,
      apronSetback: 0.125,
      tenonThickness: 0.25,
      tenonLength: 1,
      door: {
        clearance: 0.0625,
        land: 0.25,
        bottomDepth: 0.25,
        topDepth: 0.5625,
        overlap: 0.5,
        frameWidth: 2,
        grooveDepth: 0.375,
      },
    });
    expect(filled.structuralInputs).toEqual(read.snapshot.structuralInputs);
    expect(filled.filled.map((s) => s.path)).toContain('tenonThickness');
    for (const s of filled.filled) {
      expect(s.basis.kind).toBe('rule-of-thumb');
      expect(s.note).toMatch(/^Your plan was saved before Kerf asked for this/);
    }
    // A plan in the current shape holds them all, so nothing is filled.
    const current = recordCabinet.examples[0];
    if (!current) throw new Error('No worked example');
    expect(fillMissing(template, current).filled).toEqual([]);
  });
});
