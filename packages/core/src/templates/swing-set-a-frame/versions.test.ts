import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { diff } from '../../snapshot/diff.ts';
import { createSnapshot, type ProjectSnapshot, readSnapshot } from '../../snapshot/snapshot.ts';
import { swingSetAFrame } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };
import v3 from './snapshots/v3.json' with { type: 'json' };
import v4 from './snapshots/v4.json' with { type: 'json' };
import v5 from './snapshots/v5.json' with { type: 'json' };
import v6 from './snapshots/v6.json' with { type: 'json' };
import v8 from './snapshots/v8.json' with { type: 'json' };
import v9 from './snapshots/v9.json' with { type: 'json' };
import v10 from './snapshots/v10.json' with { type: 'json' };
import v11 from './snapshots/v11.json' with { type: 'json' };

// What each template version changed in the stored outputs of the worked examples (decision 0008).

const template = swingSetAFrame as TemplateDefinition;

/** What regenerating with the current version changes in the stored outputs, field by field. */
function regenerated(snapshot: ProjectSnapshot) {
  const current = createSnapshot(template, snapshot.params, snapshot.structuralInputs);
  if (!current.ok) throw new Error('worked example no longer generates');
  const json = (value: unknown) => JSON.parse(JSON.stringify(value));
  return diff(json(snapshot.outputs), json(current.output.outputs), 1000);
}

/** The value at an outputs path such as 'structuralReview.beam.bending.inputs[1]'. */
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
/**
 * Version 7's additions (#53): each part's board selection guides, and the lumber plan's copy.
 * Version 8 adds operations (#103). Both only add fields, so their test shares the list.
 */
const VERSION_7 = [
  /^design\.parts\[\d+\]\.selection/,
  /^lumber\.selection/,
  // Version 8 (#103), also only additions.
  /^design\.operations/,
];
/** Version 9's changes (#110): each bolt hole drilled 1/16" over its bolt. */
const VERSION_9 = [
  /^design\.parts\[\d+\]\.holes\[\d+\]\.diameter$/,
  /^design\.operations\[\d+\]\.holeDiameter$/,
];
/** Version 10's additions (#51): the parts and hardware each flag and checklist item concerns. */
const VERSION_10 = [
  /^design\.flags\[\d+\]\.(partIds|hardwareIds)$/,
  /^structuralReview\.checklist\[\d+\]\.(partIds|hardwareIds)$/,
];
/**
 * Version 12's changes (#59): each hardware item's and shopping line's store group, and each
 * bolt's note reworded as #68's audit asked.
 */
const VERSION_12 = [/^design\.hardware\[\d+\]\.(group|notes\[0\])$/, /^hardware\[\d+\]\.group$/];
const notVersion6 = (c: { path: string }) =>
  ![...VERSION_6, ...VERSION_7, ...VERSION_9, ...VERSION_10, ...VERSION_12].some((r) =>
    r.test(c.path),
  );
const notVersion7 = (c: { path: string }) =>
  ![...VERSION_7, ...VERSION_9, ...VERSION_10, ...VERSION_12].some((r) => r.test(c.path));
const notVersion9 = (c: { path: string }) =>
  ![...VERSION_9, ...VERSION_10, ...VERSION_12].some((r) => r.test(c.path));
const notVersion10 = (c: { path: string }) =>
  ![...VERSION_10, ...VERSION_12].some((r) => r.test(c.path));
const notVersion12 = (c: { path: string }) => !VERSION_12.some((r) => r.test(c.path));

describe('swing-set template versions', () => {
  it('version 2 adds sources and bases to the structural working, and changes no number (#36)', () => {
    const cited = new Set<string>();
    for (const stored of v1) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(1);

      const result = regenerated(read.snapshot);
      expect(result.truncated).toBe(false);

      const now = createSnapshot(template, read.snapshot.params, read.snapshot.structuralInputs);
      if (!now.ok) throw new Error('worked example no longer generates');
      // Later versions' changes are checked in their own tests below.
      const fromVersion2 = result.changes
        .filter(notVersion10)
        .filter((c) => c.path.startsWith('structuralReview.'));
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

      const result = regenerated(read.snapshot);
      // One new field, the whole list of placements; nothing that was there before changes.
      // (Version 4's changes to parts and notes are checked in their own test.)
      const placements = result.changes.filter((c) => c.path === 'design.placements');
      expect(placements).toHaveLength(1);
      expect(placements[0]).not.toHaveProperty('before');
      const others = result.changes
        .filter(notVersion6)
        .filter((c) => c.path !== 'design.placements');
      expect(others.every((c) => /^(design\.parts|cutList)\[/.test(c.path))).toBe(true);
    }
  });

  it('version 4 adds hole, joint, and flush-cut data, and corrects the flush-cut note (#50)', () => {
    for (const stored of v3) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      const result = regenerated(read.snapshot);

      for (const change of result.changes.filter(notVersion6)) {
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
      const result = regenerated(read.snapshot);
      // The upgrade letters stored parts in their order, which is what regenerating does, and
      // version 5 changes nothing else.
      expect(result.changes.filter(notVersion6)).toEqual([]);
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
      const result = regenerated(read.snapshot);
      expect(result.truncated).toBe(false);
      const { changes } = result;
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

  it('versions 7 and 8 add board selection guides and operations, and change nothing else (#53, #103)', () => {
    for (const stored of v6) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(6);
      const result = regenerated(read.snapshot);
      const { changes } = result;
      expect(changes.filter(notVersion7)).toEqual([]);
      // Every change is a new field: no number or word that was there before changes.
      expect(changes.length).toBeGreaterThan(0);
      for (const change of changes.filter(notVersion9)) {
        expect(change, change.path).not.toHaveProperty('before');
      }
    }
  });

  // NDS 2024 12.1.3.2: holes 1/32" to 1/16" over the bolt. Version 9 drills 1/16" over: a 1/2"
  // bolt gets a 9/16" hole (0.5 + 0.0625 = 0.5625). Reading a version 8 plan keeps its 1/2"
  // holes and records the bolt each was for.
  it('version 9 drills every bolt hole 1/16" over its bolt, and changes nothing else (#110)', () => {
    for (const stored of v8) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      const design = (read.snapshot.outputs as { design: Record<string, unknown> }).design as {
        parts: { holes?: { diameter: number; boltDiameter: number }[] }[];
        operations: { type: string; boltDiameter?: number; holeDiameter?: number }[];
      };
      for (const hole of design.parts.flatMap((p) => p.holes ?? [])) {
        expect(hole.boltDiameter).toBe(hole.diameter);
      }
      for (const op of design.operations.filter((o) => o.type === 'bolt-holes')) {
        expect(op.holeDiameter).toBe(op.boltDiameter);
      }
      const result = regenerated(read.snapshot);
      const { changes } = result;
      expect(changes.filter(notVersion9)).toEqual([]);
      expect(changes.length).toBeGreaterThan(0);
      for (const change of changes.filter(notVersion10)) {
        const { before, after } = change as { before: number; after: number };
        expect(after - before, change.path).toBeCloseTo(1 / 16, 12);
      }
    }
  });

  // A plan read from shape 9 keeps its flags and checklist as they were; regenerating adds the
  // parts and hardware each concerns, and nothing else changes.
  it('version 10 names the parts and hardware each flag and checklist item concerns (#51)', () => {
    for (const stored of v9) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(9);
      const result = regenerated(read.snapshot);
      const { changes } = result;
      expect(changes.filter(notVersion10)).toEqual([]);
      expect(changes.length).toBeGreaterThan(0);
      for (const change of changes.filter(notVersion12)) {
        expect(change, change.path).not.toHaveProperty('before');
      }
    }
  });

  // Every board plan so far used a 1/8" kerf and 1/2" of trim per end; reading a shape 10 plan sets
  // those, which is what regenerating stores, so nothing differs.
  it('version 11 stores the board plan kerf and trim, and changes nothing else (#58)', () => {
    for (const stored of v10) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(10);
      const lumber = (read.snapshot.outputs as { lumber: { kerf: number; trimPerEnd: number } })
        .lumber;
      expect([lumber.kerf, lumber.trimPerEnd]).toEqual([0.125, 0.5]);
      const result = regenerated(read.snapshot);
      expect(result.changes.filter(notVersion12)).toEqual([]);
    }
  });

  // A plan read from shape 11 shows its hardware as one list; regenerating puts each item and line
  // in its store group and rewords each bolt's note. No number changes.
  it('version 12 groups the hardware for the store and rewords the bolt notes (#59)', () => {
    for (const stored of v11) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(11);
      const result = regenerated(read.snapshot);
      const { changes } = result;
      expect(changes.filter(notVersion12)).toEqual([]);
      const groups = changes.filter((c) => c.path.endsWith('.group'));
      expect(groups.length).toBeGreaterThan(0);
      for (const change of groups) expect(change, change.path).not.toHaveProperty('before');
      const notes = changes.filter((c) => c.path.endsWith('.notes[0]'));
      expect(notes.length).toBeGreaterThan(0);
      // The worked example's leg-to-beam bolt (spec, Hardware: grip 8.947).
      if (stored === v11[0]) {
        expect(notes[0]?.after).toBe(
          '1/2" through-bolt. Length: at least 8-15/16" plus two washers and a locking nut, and no more than 1/2" past the nut.',
        );
      }
      // Only the wording moves: the same numbers, in the same order.
      for (const c of notes) {
        const numbers = (text: unknown) => String(text).match(/[\d/-]+"/g);
        expect(numbers(c.after), c.path).toEqual(numbers(c.before));
      }
    }
  });
});
