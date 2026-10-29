import { describe, expect, it } from 'vitest';
import { compareWithCurrent, createSnapshot, readSnapshot } from '../../snapshot/snapshot.ts';
import type { TemplateDefinition } from '../definition.ts';
import { swingSetAFrame } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };
import v3 from './snapshots/v3.json' with { type: 'json' };
import v4 from './snapshots/v4.json' with { type: 'json' };
import v5 from './snapshots/v5.json' with { type: 'json' };

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

/**
 * Version 6's changes (#93): the crossbar and gusset (parts and cut-list rows 3 and 4), their
 * geometry and placements, the legs' holes, the lumber they need, the bolt layout, and its flags.
 * Earlier versions' tests set these aside, since they compare with the current version.
 */
const VERSION_6 = [
  /^(design\.parts|cutList)\[[34]\]/,
  /^design\.parts\[[12]\]\.(holes|boltAreas)/,
  /^design\.geometry\.(crossbar|gusset)\./,
  /^design\.placements\[\d+\]\.origin\.y$/,
  /^design\.(flags|boltLayout)/,
  /^lumber\./,
];
const notVersion6 = (c: { path: string }) => !VERSION_6.some((r) => r.test(c.path));

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
      const others = report.regenerated.changes
        .filter(notVersion6)
        .filter((c) => c.path !== 'design.placements');
      expect(others.every((c) => /^(design\.parts|cutList)\[/.test(c.path))).toBe(true);
    }
  });

  it('version 4 adds hole, joint, and flush-cut data, and corrects the flush-cut note (#50)', () => {
    for (const stored of v3) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      const report = compareWithCurrent(template, read.snapshot);
      if (report.status !== 'behind' || !report.regenerated.ok) throw new Error('expected behind');

      for (const change of report.regenerated.changes.filter(notVersion6)) {
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

  it('version 5 letters the parts (#66); a stored plan gets the same letters by upgrade', () => {
    for (const stored of v4) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(4);
      const report = compareWithCurrent(template, read.snapshot);
      if (report.status !== 'behind' || !report.regenerated.ok) throw new Error('expected behind');
      // The upgrade letters stored parts in their order, which is what regenerating does, and
      // version 5 changes nothing else.
      expect(report.regenerated.changes.filter(notVersion6)).toEqual([]);
      const outputs = read.snapshot.outputs as {
        design: { parts: { letter: string }[] };
        cutList: { letter: string }[];
      };
      expect(outputs.cutList.map((r) => r.letter)).toEqual(
        outputs.design.parts.map((p) => p.letter),
      );
    }
  });

  it('version 6 runs the crossbar and gusset past the legs and lays out their bolts (#93)', () => {
    for (const stored of v5) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(5);
      const report = compareWithCurrent(template, read.snapshot);
      if (report.status !== 'behind' || !report.regenerated.ok) throw new Error('expected behind');
      expect(report.regenerated.truncated).toBe(false);
      const { changes } = report.regenerated;
      // Nothing outside version 6's list changes: not the beam, the legs' lengths, the hardware,
      // or the structural review.
      expect(changes.filter(notVersion6)).toEqual([]);
      // The crossbar and gusset get longer, by twice the distance past each leg.
      for (const path of ['design.parts[3].length', 'design.parts[4].length']) {
        const change = changes.find((c) => c.path === path);
        expect(change, path).toBeDefined();
        expect(change?.after as number).toBeGreaterThan(change?.before as number);
      }
      // The bolt layout is new, and flags are only added.
      expect(changes.find((c) => c.path === 'design.boltLayout')).not.toHaveProperty('before');
      for (const c of changes.filter((c) => c.path.startsWith('design.flags'))) {
        expect(c).not.toHaveProperty('before');
      }
      // Bolt areas on the legs, crossbar, and gusset become holes.
      expect(changes.some((c) => c.path === 'design.parts[3].holes[0]')).toBe(true);
    }
  });
});
