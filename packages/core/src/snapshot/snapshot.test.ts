import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { TemplateDefinition } from '../templates/definition.ts';
import { swingSetAFrame } from '../templates/swing-set-a-frame/definition.ts';
import type { SwingSetParams } from '../templates/swing-set-a-frame/params.ts';
import type { SwingSetStructuralInputs } from '../templates/swing-set-a-frame/structural.ts';
import {
  compareWithCurrent,
  createSnapshot,
  type ProjectSnapshot,
  readSnapshot,
} from './snapshot.ts';

// The swing-set worked example (docs/templates/swing-set-a-frame.md).
const params: SwingSetParams = {
  beamLength: 120,
  beamHeight: 96,
  splay: { kind: 'angle', degrees: 20 },
  beamStock: '4x6',
  beamPlies: 1,
  legStock: '4x4',
  crossbarStock: '2x6',
  crossbarHeight: 40,
  gussetStock: '2x8',
  frameInset: 12,
  groundSlope: 1,
  burialDepth: 24,
  swings: { centers: [40, 80], hangerSpacing: 20, seatWidth: 20, seatHeight: 16 },
  hardware: {
    legBoltDiameter: 0.5,
    crossbarBolts: { diameter: 0.5, perJoint: 2 },
    gussetBolts: { diameter: 0.5, perJoint: 2 },
  },
};

const inputs = {
  beamSpeciesGrade: 'southern-pine-no2',
  beamIncised: false,
  beamMoistureContent: 30,
  riderWeights: [150, 150],
  maxSwingAngle: 60,
  dynamicFactor: 2,
  deflectionLimit: 240,
  hangerRating: 1200,
};

const templates = [swingSetAFrame] as readonly TemplateDefinition[];

function snapshot(template: TemplateDefinition, p: unknown, i: unknown): ProjectSnapshot {
  const result = createSnapshot(template, p, i);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

/** What a snapshot looks like after a trip through JSON, as Postgres stores it. */
const stored = (s: ProjectSnapshot): unknown => JSON.parse(JSON.stringify(s));

describe('createSnapshot', () => {
  it('records the template, version, parameters, inputs, and every output', () => {
    const s = snapshot(swingSetAFrame, params, inputs);
    expect(s.templateId).toBe('swing-set-a-frame');
    expect(s.templateVersion).toBe(swingSetAFrame.version);
    expect(s.snapshotVersion).toBe(swingSetAFrame.snapshotVersion);
    expect(s.params).toEqual(params);
    expect(s.structuralInputs).toEqual(inputs);
    expect(Object.keys(s.outputs as object)).toEqual([
      'design',
      'cutList',
      'lumber',
      'hardware',
      'structuralReview',
    ]);
  });

  it('reports invalid parameters and inputs by name, with no snapshot', () => {
    const result = createSnapshot(
      swingSetAFrame,
      { ...params, beamLength: 10 },
      { ...inputs, dynamicFactor: 0 },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.params)).toEqual([['beamLength'], ['dynamicFactor']]);
  });

  it('reports contradictory parameters from the template', () => {
    const result = createSnapshot(
      swingSetAFrame,
      { ...params, beamPlies: 2, beamStock: '2x6' },
      inputs,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain('ply-bolts-missing');
  });
});

describe('readSnapshot', () => {
  it('reads back exactly what was stored, through JSON', () => {
    const s = snapshot(swingSetAFrame, params, inputs);
    const read = readSnapshot(templates, stored(s));
    expect(read).toEqual({ ok: true, snapshot: stored(s) });
  });

  it('reads back a snapshot whose checks are waiting on inputs', () => {
    const s = snapshot(swingSetAFrame, params, { riderWeights: [150, 150] });
    const read = readSnapshot(templates, stored(s));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const outputs = read.snapshot.outputs as { structuralReview: { hanger: { status: string } } };
    expect(outputs.structuralReview.hanger.status).toBe('input-needed');
  });

  it('rejects a snapshot whose outputs do not match the schema', () => {
    const s = stored(snapshot(swingSetAFrame, params, inputs)) as { outputs: { cutList: unknown } };
    s.outputs.cutList = 'not a list';
    expect(readSnapshot(templates, s)).toMatchObject({ ok: false, reason: 'malformed' });
  });

  it('rejects values that are not snapshots, and unknown templates', () => {
    expect(readSnapshot(templates, { hello: 1 })).toMatchObject({ ok: false, reason: 'malformed' });
    const s = { ...(stored(snapshot(swingSetAFrame, params, inputs)) as object), templateId: 'x' };
    expect(readSnapshot(templates, s)).toMatchObject({ ok: false, reason: 'unknown-template' });
  });
});

// A made-up version 2 that lengthens the first part in the cut list, to stand in for a real template change.
const version2: TemplateDefinition = {
  ...(swingSetAFrame as TemplateDefinition),
  version: 2,
  generate(p, i) {
    const result = swingSetAFrame.generate(p as SwingSetParams, i as SwingSetStructuralInputs);
    if (!result.ok) return result;
    const [first, ...rest] = result.output.cutList;
    return {
      ok: true,
      output: {
        ...result.output,
        cutList: first ? [{ ...first, length: '121"' }, ...rest] : rest,
      },
    };
  },
};

describe('compareWithCurrent', () => {
  const v1 = snapshot(swingSetAFrame, params, inputs);

  it('reports a snapshot from the current version as current', () => {
    expect(compareWithCurrent(swingSetAFrame as TemplateDefinition, v1)).toEqual({
      status: 'current',
      version: 1,
    });
  });

  it('lists what regenerating with a newer version would change', () => {
    expect(compareWithCurrent(version2, v1)).toEqual({
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: {
        ok: true,
        changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
        truncated: false,
      },
    });
  });

  it('reports when the newer version rejects the stored parameters', () => {
    const stricter: TemplateDefinition = {
      ...version2,
      params: z.object({ beamLength: z.number().max(100) }),
    };
    const report = compareWithCurrent(stricter, v1);
    expect(report).toMatchObject({ status: 'behind', regenerated: { ok: false } });
  });

  it('reports a snapshot from a newer version than the code as ahead', () => {
    const ahead = { ...v1, templateVersion: 3 };
    expect(compareWithCurrent(swingSetAFrame as TemplateDefinition, ahead)).toEqual({
      status: 'ahead',
      storedVersion: 3,
      currentVersion: 1,
    });
  });
});

// A made-up shape 2 that renames outputs.cutList to outputs.cuts, with its upgrade.
const shape2: TemplateDefinition = {
  ...(swingSetAFrame as TemplateDefinition),
  snapshotVersion: 2,
  outputs: z.looseObject({ cuts: z.array(z.unknown()) }),
  snapshotUpgrades: {
    1: (s) => {
      const { cutList, ...outputs } = s.outputs as { cutList: unknown };
      return { ...s, outputs: { ...outputs, cuts: cutList } };
    },
  },
};

describe('reading a snapshot stored in an older shape', () => {
  const stored1 = stored(snapshot(swingSetAFrame, params, inputs)) as {
    outputs: { cutList: unknown };
  };

  it('upgrades it step by step, keeping its numbers', () => {
    const read = readSnapshot([shape2], stored1);
    expect(read).toMatchObject({ ok: true, upgradedFrom: 1, snapshot: { snapshotVersion: 2 } });
    if (!read.ok) return;
    expect((read.snapshot.outputs as { cuts: unknown }).cuts).toEqual(stored1.outputs.cutList);
  });

  it('reports a missing upgrade instead of guessing', () => {
    const noUpgrade = { ...shape2, snapshotUpgrades: {} };
    expect(readSnapshot([noUpgrade], stored1)).toMatchObject({
      ok: false,
      reason: 'missing-upgrade',
    });
  });

  it('refuses a snapshot stored in a newer shape than the code reads', () => {
    const newer = { ...stored1, snapshotVersion: 3 };
    expect(readSnapshot([shape2], newer)).toMatchObject({ ok: false, reason: 'newer-snapshot' });
  });
});
