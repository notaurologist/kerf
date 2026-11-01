import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { shapeOf } from '../../snapshot/shape.ts';
import { createSnapshot, readSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };

// Stored record-cabinet projects stay readable (decision 0014). The fixture holds the worked
// examples as template version 1 stores them. Fixtures are never rewritten.

const FIXTURES: Record<number, readonly unknown[]> = { 1: v1 };
const template = recordCabinet as TemplateDefinition;

describe('record-cabinet snapshot fixtures', () => {
  it('has a fixture for every template version, one snapshot per worked example', () => {
    expect(Object.keys(FIXTURES).map(Number)).toEqual([template.version]);
    expect(FIXTURES[template.version]).toHaveLength(template.examples.length);
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

  it('reads the current shape back exactly, dropping nothing', () => {
    for (const stored of FIXTURES[template.version] ?? []) {
      const read = readSnapshot([template], stored);
      expect(read.ok && JSON.parse(JSON.stringify(read.snapshot))).toEqual(stored);
    }
  });
});
