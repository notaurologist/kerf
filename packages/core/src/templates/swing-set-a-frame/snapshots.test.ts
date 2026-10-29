import { describe, expect, it } from 'vitest';
import { shapeOf } from '../../snapshot/shape.ts';
import { createSnapshot, readSnapshot } from '../../snapshot/snapshot.ts';
import type { TemplateDefinition } from '../definition.ts';
import { swingSetAFrame } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };
import v3 from './snapshots/v3.json' with { type: 'json' };

// Stored swing-set projects stay readable (decision 0014). Each fixture holds the worked examples
// as they were stored in one snapshot shape. Fixtures are never rewritten.
const FIXTURES: Record<number, readonly unknown[]> = { 1: v1, 2: v2, 3: v3 };

const template = swingSetAFrame as TemplateDefinition;
const templates = [template];

describe('swing-set snapshot fixtures', () => {
  it('has a fixture for every snapshot shape version, and an upgrade between each', () => {
    const versions = Array.from({ length: template.snapshotVersion }, (_, i) => i + 1);
    expect(Object.keys(FIXTURES).map(Number)).toEqual(versions);
    expect(Object.keys(template.snapshotUpgrades).map(Number)).toEqual(versions.slice(0, -1));
  });

  it.each(Object.entries(FIXTURES))('reads every snapshot stored in shape %s', (_, fixture) => {
    for (const stored of fixture) {
      const read = readSnapshot(templates, stored);
      expect(read.ok, JSON.stringify(read)).toBe(true);
      if (!read.ok) continue;
      // An upgrade restructures only: the plan keeps its template version and parameters.
      const original = stored as { templateVersion: number; params: unknown };
      expect(read.snapshot.templateVersion).toBe(original.templateVersion);
      expect(read.snapshot.params).toEqual(original.params);
    }
  });

  it('reads the current shape back exactly, dropping nothing', () => {
    const current = FIXTURES[template.snapshotVersion] ?? [];
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
    expect(shapeOf(generated)).toEqual(shapeOf(FIXTURES[template.snapshotVersion]));
  });
});
