import { describe, expect, it } from 'vitest';
import { compareWithCurrent, createSnapshot, readSnapshot } from '../../snapshot/snapshot.ts';
import type { TemplateDefinition } from '../definition.ts';
import { swingSetAFrame } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };
import v3 from './snapshots/v3.json' with { type: 'json' };

// What each template version changed for the worked examples, as the owner sees it in the version
// report (decision 0008).

const template = swingSetAFrame as TemplateDefinition;

/** The value at a report path such as 'structuralReview.beam.bending.inputs[1]'. */
function at(value: unknown, path: string): unknown {
  return path
    .split(/\.|\[(\d+)\]/)
    .filter(Boolean)
    .reduce<unknown>((v, key) => (v as Record<string, unknown>)[key], value);
}

describe('swing-set template versions', () => {
  it('version 2 adds sources and bases to the structural working, and changes no number (#36)', () => {
    const cited = new Set<string>();
    for (const stored of v1) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(1);

      const report = compareWithCurrent(template, read.snapshot);
      if (report.status !== 'behind' || !report.regenerated.ok) throw new Error('expected behind');
      expect(report.regenerated.truncated).toBe(false);

      const now = createSnapshot(template, read.snapshot.params, read.snapshot.structuralInputs);
      if (!now.ok) throw new Error('worked example no longer generates');
      // Later versions' changes are checked in their own tests below.
      const fromVersion2 = report.regenerated.changes.filter((c) =>
        c.path.startsWith('structuralReview.'),
      );
      for (const change of fromVersion2) {
        // Every change is a new field on a quantity in the working, never a changed value.
        expect(change, change.path).not.toHaveProperty('before');
        expect(change.path).toMatch(/^structuralReview\..*\.(sources|basis)$/);
        const quantity = at(now.output.outputs, change.path.replace(/\.(sources|basis)$/, ''));
        if (change.path.endsWith('.sources')) cited.add((quantity as { symbol: string }).symbol);
      }
    }
    expect([...cited].sort()).toEqual(['3 − 2·cos θ', 'G', 'b', 'd']);
  });

  it('version 3 adds part placements, and changes nothing else (#49)', () => {
    for (const stored of v2) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(2);

      const report = compareWithCurrent(template, read.snapshot);
      if (report.status !== 'behind' || !report.regenerated.ok) throw new Error('expected behind');
      // One new field, the whole list of placements; nothing that was there before changes.
      // (Version 4's changes to parts and notes are checked in their own test.)
      const placements = report.regenerated.changes.filter((c) => c.path === 'design.placements');
      expect(placements).toHaveLength(1);
      expect(placements[0]).not.toHaveProperty('before');
      const others = report.regenerated.changes.filter((c) => c.path !== 'design.placements');
      expect(others.every((c) => /^(design\.parts|cutList)\[/.test(c.path))).toBe(true);
    }
  });

  it('version 4 adds hole, joint, and flush-cut data, and corrects the flush-cut note (#50)', () => {
    for (const stored of v3) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      const report = compareWithCurrent(template, read.snapshot);
      if (report.status !== 'behind' || !report.regenerated.ok) throw new Error('expected behind');

      for (const change of report.regenerated.changes) {
        if ('before' in change) {
          // The only changed values: the legs' flush-cut note, in the parts and the cut list.
          expect(change.path).toMatch(/^(design\.parts|cutList)\[\d\]\.notes\[0\]$/);
          expect(String(change.before)).toContain('below the top cut');
          expect(String(change.after)).toContain('down from the top corner');
        } else {
          // Everything else is a new field on a part or an end cut.
          expect(change.path).toMatch(
            /^design\.parts\[\d\]\.(referenceEdge|holes|boltAreas|tapers|ends\[\d\]\.measuredFrom)$/,
          );
        }
      }
    }
  });
});
