import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { TemplateDefinition } from '../templates/definition.ts';
import { swingSetAFrame } from '../templates/swing-set-a-frame/definition.ts';
import type { SwingSetParams } from '../templates/swing-set-a-frame/params.ts';
import previousVersion from '../templates/swing-set-a-frame/snapshots/v11.json' with {
  type: 'json',
};
import type { SwingSetStructuralInputs } from '../templates/swing-set-a-frame/structural.ts';
import {
  compareSnapshots,
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

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** The value at a path such as 'cutList[0].length'. */
function valueAt(value: unknown, path: string): unknown {
  return path
    .split(/\.|\[(\d+)\]/)
    .filter(Boolean)
    .reduce<unknown>((v, key) => (v as Record<string, unknown> | undefined)?.[key], value);
}

// Versions relative to the template's current one, so these tests outlive real version bumps.
const CURRENT = swingSetAFrame.version;
const SHAPE = swingSetAFrame.snapshotVersion;

// A made-up next version that lengthens the first part in the cut list, to stand in for a real
// template change.
const nextVersion: TemplateDefinition = {
  ...(swingSetAFrame as TemplateDefinition),
  version: CURRENT + 1,
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
  const made = snapshot(swingSetAFrame, params, inputs);

  it('reports a snapshot from the current version as current', () => {
    expect(compareWithCurrent(swingSetAFrame as TemplateDefinition, made)).toEqual({
      status: 'current',
      version: CURRENT,
    });
  });

  it('lists what regenerating with a newer version would change', () => {
    expect(compareWithCurrent(nextVersion, made)).toEqual({
      status: 'behind',
      storedVersion: CURRENT,
      currentVersion: CURRENT + 1,
      regenerated: {
        ok: true,
        outputs: expect.objectContaining({ cutList: expect.any(Array) }),
        changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
        truncated: false,
      },
    });
  });

  it('reports changes in the plan every display reads, for a plan stored by an older version', () => {
    const template = swingSetAFrame as TemplateDefinition;
    const [stored] = previousVersion as unknown[];
    const read = readSnapshot([template], stored);
    if (!read.ok) throw new Error(read.message);
    const report = compareWithCurrent(template, read.snapshot);
    if (report.status !== 'behind' || !report.regenerated.ok) throw new Error('expected behind');
    const { changes, outputs } = report.regenerated;
    expect(changes.length).toBeGreaterThan(0);
    const before = asJson(template.plan(template.outputs.parse(read.snapshot.outputs)));
    const after = asJson(template.plan(template.outputs.parse(outputs)));
    for (const change of changes) {
      if ('before' in change)
        expect(valueAt(before, change.path), change.path).toEqual(change.before);
      if ('after' in change) expect(valueAt(after, change.path), change.path).toEqual(change.after);
    }
  });

  it('reports when the newer version rejects the stored parameters', () => {
    const stricter: TemplateDefinition = {
      ...nextVersion,
      params: z.object({ beamLength: z.number().max(100) }),
    };
    const report = compareWithCurrent(stricter, made);
    expect(report).toMatchObject({ status: 'behind', regenerated: { ok: false } });
  });

  it('reports a snapshot from a newer version than the code as ahead', () => {
    const ahead = { ...made, templateVersion: CURRENT + 2 };
    expect(compareWithCurrent(swingSetAFrame as TemplateDefinition, ahead)).toEqual({
      status: 'ahead',
      storedVersion: CURRENT + 2,
      currentVersion: CURRENT,
    });
  });
});

describe('compareSnapshots', () => {
  const saved = snapshot(swingSetAFrame, params, inputs);
  const t = swingSetAFrame as TemplateDefinition;

  it('finds nothing between a snapshot and itself', () => {
    expect(compareSnapshots(t, saved, saved)).toEqual({ changes: [], truncated: false });
  });

  // Hand check: the beam is alone on a 12' (144") 4x6. Offcut = 144 - 2 x 1/2" trim - length -
  // 1/8" kerf: 144 - 1 - 120 - 0.125 = 22.875 before, 144 - 1 - 132 - 0.125 = 10.875 after.
  // A 10' board no longer fits either way, so the note saying why it was listed as 12' goes.
  // Moving both swings by 6" keeps them 46" from each end, so no other part or board changes.
  it('lists what different parameters change, by the paths every display shares', () => {
    const preview = snapshot(
      swingSetAFrame,
      { ...params, beamLength: 132, swings: { ...params.swings, centers: [46, 86] } },
      inputs,
    );
    const { changes, truncated } = compareSnapshots(t, saved, preview);
    expect(truncated).toBe(false);
    expect(changes.filter((c) => !c.path.startsWith('checks'))).toEqual([
      { path: 'cutList[0].length', before: '120"', after: '132"' },
      { path: 'lumber.boards[0].pieces[0].length', before: 120, after: 132 },
      { path: 'lumber.boards[0].offcut', before: 22.875, after: 10.875 },
      { path: 'lumber.notes[1]', before: expect.stringContaining("Beam: listed as 12'") },
    ]);
    // A longer span between the same loads raises the bending moment, so the margin drops.
    const bending = changes.find((c) => c.path === 'checks[0].margin');
    expect(bending?.after).toBeLessThan(bending?.before as number);
  });
});

// A made-up next shape that renames outputs.cutList to outputs.cuts, with its upgrade.
const nextShape: TemplateDefinition = {
  ...(swingSetAFrame as TemplateDefinition),
  snapshotVersion: SHAPE + 1,
  outputs: z.looseObject({ cuts: z.array(z.unknown()) }),
  snapshotUpgrades: {
    ...swingSetAFrame.snapshotUpgrades,
    [SHAPE]: (s) => {
      const { cutList, ...outputs } = s.outputs as { cutList: unknown };
      return { ...s, outputs: { ...outputs, cuts: cutList } };
    },
  },
};

describe('reading a snapshot stored in an older shape', () => {
  const storedNow = stored(snapshot(swingSetAFrame, params, inputs)) as {
    outputs: { cutList: unknown };
  };

  it('upgrades it step by step, keeping its numbers', () => {
    const read = readSnapshot([nextShape], storedNow);
    expect(read).toMatchObject({
      ok: true,
      upgradedFrom: SHAPE,
      snapshot: { snapshotVersion: SHAPE + 1 },
    });
    if (!read.ok) return;
    expect((read.snapshot.outputs as { cuts: unknown }).cuts).toEqual(storedNow.outputs.cutList);
  });

  it('reports a missing upgrade instead of guessing', () => {
    const noUpgrade = { ...nextShape, snapshotUpgrades: {} };
    expect(readSnapshot([noUpgrade], storedNow)).toMatchObject({
      ok: false,
      reason: 'missing-upgrade',
    });
  });

  it('refuses a snapshot stored in a newer shape than the code reads', () => {
    const newer = { ...storedNow, snapshotVersion: SHAPE + 2 };
    expect(readSnapshot([nextShape], newer)).toMatchObject({ ok: false, reason: 'newer-snapshot' });
  });
});
