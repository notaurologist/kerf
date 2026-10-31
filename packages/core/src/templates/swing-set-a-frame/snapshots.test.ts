import { describe, expect, it } from 'vitest';
import { shapeOf } from '../../snapshot/shape.ts';
import { createSnapshot, readSnapshot } from '../../snapshot/snapshot.ts';
import type { TemplateDefinition } from '../definition.ts';
import { swingSetAFrame } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };
import v3 from './snapshots/v3.json' with { type: 'json' };
import v4 from './snapshots/v4.json' with { type: 'json' };
import v5 from './snapshots/v5.json' with { type: 'json' };
import v6 from './snapshots/v6.json' with { type: 'json' };
import v7 from './snapshots/v7.json' with { type: 'json' };
import v8 from './snapshots/v8.json' with { type: 'json' };
import v9 from './snapshots/v9.json' with { type: 'json' };
import v10 from './snapshots/v10.json' with { type: 'json' };
import v11 from './snapshots/v11.json' with { type: 'json' };
import v12 from './snapshots/v12.json' with { type: 'json' };
import v13 from './snapshots/v13.json' with { type: 'json' };

// Stored swing-set projects stay readable (decision 0014). Each fixture holds the worked examples
// as one template version stored them, keyed by that version. Fixtures are never rewritten.
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
  10: v10,
  11: v11,
  12: v12,
  13: v13,
};

const template = swingSetAFrame as TemplateDefinition;
const templates = [template];

describe('swing-set snapshot fixtures', () => {
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
        'swing-set-a-frame (decision 0014).',
    ).toEqual(FIXTURES[template.version]);
  });

  it.each(Object.entries(FIXTURES))(
    'reads every snapshot stored at template version %s',
    (_, fixture) => {
      for (const stored of fixture) {
        const read = readSnapshot(templates, stored);
        expect(read.ok, JSON.stringify(read)).toBe(true);
        if (!read.ok) continue;
        // An upgrade restructures only: the plan keeps its template version and parameters.
        const original = stored as { templateVersion: number; params: unknown };
        expect(read.snapshot.templateVersion).toBe(original.templateVersion);
        expect(read.snapshot.params).toEqual(original.params);
      }
    },
  );

  it('reads the current shape back exactly, dropping nothing', () => {
    const current = FIXTURES[template.version] ?? [];
    expect(current).not.toHaveLength(0);
    for (const stored of current) {
      const read = readSnapshot(templates, stored);
      expect(read.ok && JSON.parse(JSON.stringify(read.snapshot))).toEqual(stored);
    }
  });

  it('generates snapshots in the current shape', () => {
    // A failure here means the stored shape changed. Bump snapshotVersion, add an upgrade from
    // the previous shape, and write the new fixture: pnpm --filter @kerf/api
    // write-snapshot-fixture swing-set-a-frame (decision 0014).
    const generated = template.examples.map((e) => {
      const result = createSnapshot(template, e.params, e.structuralInputs);
      if (!result.ok) throw new Error(e.name);
      return result.output;
    });
    expect(shapeOf(generated)).toEqual(shapeOf(FIXTURES[template.version]));
  });
});
