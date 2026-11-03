import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import type { Operation } from '../../model/operations.ts';
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
import v12 from './snapshots/v12.json' with { type: 'json' };
import v13 from './snapshots/v13.json' with { type: 'json' };
import v14 from './snapshots/v14.json' with { type: 'json' };
import v15 from './snapshots/v15.json' with { type: 'json' };
import v16 from './snapshots/v16.json' with { type: 'json' };
import v17 from './snapshots/v17.json' with { type: 'json' };
import v18 from './snapshots/v18.json' with { type: 'json' };
import v19 from './snapshots/v19.json' with { type: 'json' };
import v20 from './snapshots/v20.json' with { type: 'json' };
import v21 from './snapshots/v21.json' with { type: 'json' };
import v22 from './snapshots/v22.json' with { type: 'json' };
import v23 from './snapshots/v23.json' with { type: 'json' };
import v24 from './snapshots/v24.json' with { type: 'json' };
import v25 from './snapshots/v25.json' with { type: 'json' };
import v26 from './snapshots/v26.json' with { type: 'json' };
import v27 from './snapshots/v27.json' with { type: 'json' };
import v28 from './snapshots/v28.json' with { type: 'json' };

// What each template version changed in the stored outputs of the worked examples (decision 0008).

const template = swingSetAFrame as TemplateDefinition;

/**
 * Version 18's changes (#417): the structural input behind each entered quantity, the parameters
 * behind each bolted joint, and "entered" taken out of the leg-to-beam checklist item. Set aside
 * in every comparison with the current version, as the earlier versions' lists are below.
 */
const isVersion18 = (c: { path: string; before?: unknown; after?: unknown }) =>
  /^structuralReview\..*\.input$/.test(c.path) ||
  /^design\.boltLayout\[\d+\]\.params(\[\d+\])?$/.test(c.path) ||
  (/^structuralReview\.checklist\[\d+\]\.confirm$/.test(c.path) &&
    String(c.before).replace(' entered, ', ', ') === c.after);

/**
 * Version 20's change (#455): each leg's flush-cut note, in its part and its cut-list row, calls the
 * cut a taper and gives one measurement for the mark on the top cut. Set aside like version 18's.
 */
const isVersion20 = (c: { path: string; before?: unknown; after?: unknown }) =>
  /^(design\.parts|cutList)\[\d+\]\.notes\[0\]$/.test(c.path) &&
  String(c.before).startsWith('Flush cut on the inside face at the top:') &&
  String(c.after).startsWith('Taper the inside face at the top,');
/**
 * Version 22's changes (#449): each bolt's length to buy and its notes, each shopping line's
 * description and notes, and the hardware notes. Set aside like version 18's.
 */
const isVersion22 = (c: { path: string }) =>
  /^design\.hardware\[\d+\]\.(bolt\.length|notes\[0\])$/.test(c.path) ||
  /^design\.hardwareNotes\[\d+\]$/.test(c.path) ||
  /^hardware\[\d+\]\.(description|notes(\[\d+\])?)$/.test(c.path);
/**
 * Version 23's change (#445): the beam supported at the middle of each gusset's top edge instead
 * of at the frame centerlines, which moves every beam check's numbers and its support assumptions.
 * Set aside like version 18's.
 */
const isVersion23 = (c: { path: string }) =>
  /^structuralReview\.beam\.(bending|shear|deflection)\.((inputs|steps|factors)\[\d+\]\.value|assumptions\[\d+\]|(computed|allowable|breakEven)\.value|margin)$/.test(
    c.path,
  );
/**
 * Version 24's changes (#514): the lengths that fit each bolt, and each bolt line's bolt. Set aside
 * like version 18's.
 */
const isVersion24 = (c: { path: string }) =>
  /^design\.hardware\[\d+\]\.bolt\.fits$/.test(c.path) || /^hardware\[\d+\]\.bolt$/.test(c.path);

/**
 * Version 25's changes (#450): each lumber line's notes and what else to buy, and the note about a
 * shorter board taken out of the list's notes, since it moved to its line. Set aside like 20's.
 */
const isVersion25 = (c: { path: string; before?: unknown }) =>
  /^lumber\.lines\[\d+\]\.(notes|alternatives)\[\d+\]$/.test(c.path) ||
  (/^lumber\.notes\[\d+\]$/.test(c.path) &&
    String(c.before).includes(' to leave room for trimming'));

/**
 * Version 26's changes (#464): the buried-legs flag and checklist item ask about UC4B and what each
 * leg stands on, and the beam's C_D reason cites Table 2.3.2, footnote 2. Set aside like version 18's.
 */
const isVersion26 = (c: { path: string; after?: unknown }) =>
  (/^(design\.flags\[\d+\]\.(ask|why)|structuralReview\.checklist\[\d+\]\.confirm)$/.test(c.path) &&
    String(c.after).includes('UC4B')) ||
  (/^structuralReview\.beam\.(bending|shear)\.factors\[\d+\]\.reason$/.test(c.path) &&
    String(c.after).includes('Table 2.3.2, footnote 2'));

/**
 * Version 27's changes (#447): every part marked treated, an operation to treat each part's cuts and
 * each bolt's holes, and the preservative in the hardware and its shopping line. Each is new, with
 * nothing before it. Set aside like version 18's.
 */
const isVersion27 = (c: { path: string; before?: unknown; after?: unknown }) => {
  if (c.before !== undefined) return false;
  const after = c.after as { id?: string; type?: string } | undefined;
  return (
    (/^design\.parts\[\d+\]\.treated$/.test(c.path) && c.after === true) ||
    (/^design\.operations\[\d+\]$/.test(c.path) &&
      (after?.type === 'treat-cuts' || after?.type === 'treat-holes')) ||
    (/^design\.hardware\[\d+\]$/.test(c.path) && after?.id === 'preservative') ||
    (/^hardware\[\d+\]$/.test(c.path) &&
      (c.after as { description?: string }).description === 'Wood preservative for cut ends')
  );
};

/**
 * Version 28's changes (#446): bending at the hangers' holes, which a plan made before it has not
 * entered, so its bending says the mounting is needed; the hanger checklist item's wording; and
 * the beam's other sizes, which wait for bending's margin. Set aside like 18's.
 */
const isVersion28 = (c: { path: string }) =>
  /^structuralReview\.beam\.bending(\.|\[|$)/.test(c.path) ||
  /^structuralReview\.checklist\[\d+\]\.confirm$/.test(c.path) ||
  /^lumber\.lines\[\d+\]\.alternatives(\[|$)/.test(c.path);

/**
 * What regenerating with the current version changes in the stored outputs, field by field; or,
 * given `later`, a later version's fixture of the same example, what that version changed.
 */
function regenerated(
  snapshot: ProjectSnapshot,
  keepVersion18 = false,
  keepVersion22 = false,
  keepVersion23 = false,
  keepVersion24 = false,
  keepVersion25 = false,
  keepVersion26 = false,
  keepVersion27 = false,
  keepVersion28 = false,
  later?: unknown,
) {
  const json = (value: unknown) => JSON.parse(JSON.stringify(value));
  const outputs = later === undefined ? fresh(snapshot) : read(later).outputs;
  const found = diff(json(snapshot.outputs), json(outputs), 1000);
  const result = {
    ...found,
    changes: found.changes.filter(
      (c) =>
        !isVersion20(c) &&
        (keepVersion22 || !isVersion22(c)) &&
        (keepVersion23 || !isVersion23(c)) &&
        (keepVersion24 || !isVersion24(c)) &&
        (keepVersion25 || !isVersion25(c)) &&
        (keepVersion26 || !isVersion26(c)) &&
        (keepVersion27 || !isVersion27(c)) &&
        (keepVersion28 || later !== undefined || !isVersion28(c)),
    ),
  };
  return keepVersion18
    ? result
    : { ...result, changes: result.changes.filter((c) => !isVersion18(c)) };
}

function fresh(snapshot: ProjectSnapshot) {
  const current = createSnapshot(template, snapshot.params, snapshot.structuralInputs);
  if (!current.ok) throw new Error('worked example no longer generates');
  return template.storedOutputs.parse(current.output.outputs);
}

function read(stored: unknown): ProjectSnapshot {
  const result = readSnapshot([template], stored);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.snapshot;
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
/** Version 13's change: the bending check's moment position as its own step, in inches. */
const VERSION_13 = [/^structuralReview\.\w+\.bending\.steps\[\d+\](\.label)?$/];
/** Version 14's additions (#300): each part's dadoes, notches, and cutouts, all empty. */
const VERSION_14 = [/^design\.parts\[\d+\]\.(dadoes|notches|cutouts)$/];
/**
 * Version 15's changes (#401): each strength check's break-even dynamic factor, the factor moved
 * after the loads it multiplies in the working, a formula saying what it multiplies, and the
 * missing inputs listed in the order the checks now ask for them.
 */
const VERSION_15 = [
  /^structuralReview\.(beam\.(bending|shear)|hanger)\.(inputs|formulas|missing|breakEven)\b/,
];
const notVersion6 = (c: { path: string }) =>
  ![
    ...VERSION_6,
    ...VERSION_7,
    ...VERSION_9,
    ...VERSION_10,
    ...VERSION_12,
    ...VERSION_13,
    ...VERSION_14,
    ...VERSION_15,
  ].some((r) => r.test(c.path));
const notVersion7 = (c: { path: string }) =>
  ![
    ...VERSION_7,
    ...VERSION_9,
    ...VERSION_10,
    ...VERSION_12,
    ...VERSION_13,
    ...VERSION_14,
    ...VERSION_15,
  ].some((r) => r.test(c.path));
const notVersion9 = (c: { path: string }) =>
  ![...VERSION_9, ...VERSION_10, ...VERSION_12, ...VERSION_13, ...VERSION_14, ...VERSION_15].some(
    (r) => r.test(c.path),
  );
const notVersion10 = (c: { path: string }) =>
  ![...VERSION_10, ...VERSION_12, ...VERSION_13, ...VERSION_14, ...VERSION_15].some((r) =>
    r.test(c.path),
  );
const notVersion12 = (c: { path: string }) =>
  ![...VERSION_12, ...VERSION_13, ...VERSION_14, ...VERSION_15].some((r) => r.test(c.path));
const notVersion13 = (c: { path: string }) =>
  ![...VERSION_13, ...VERSION_14, ...VERSION_15].some((r) => r.test(c.path));
const notVersion14 = (c: { path: string }) =>
  ![...VERSION_14, ...VERSION_15].some((r) => r.test(c.path));
const notVersion15 = (c: { path: string }) => !VERSION_15.some((r) => r.test(c.path));

/** Every list a stored part holds, by name, that is empty. */
const emptyPartLists = (fixture: readonly unknown[]) =>
  fixture.flatMap((stored) =>
    (stored as { outputs: { design: { parts: Record<string, unknown>[] } } }).outputs.design.parts
      .flatMap((part) => Object.entries(part))
      .filter(([, value]) => Array.isArray(value) && value.length === 0)
      .map(([key]) => key),
  );

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
          // Everything else is a new field on a part or an end cut, or a feature in a list that
          // reads as empty when a plan left it out.
          expect(change.path).toMatch(
            /^design\.parts\[\d\]\.(referenceEdge|(holes|boltAreas|tapers)\[\d+\]|ends\[\d\]\.measuredFrom)$/,
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
    type Stored = { outputs: { design: { hardware: { notes: string[] }[] } } };
    const notesOf = (stored: unknown) =>
      (stored as Stored).outputs.design.hardware.map((h) => h.notes[0]);
    v11.forEach((stored, i) => {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(11);
      const result = regenerated(read.snapshot);
      const { changes } = result;
      expect(changes.filter(notVersion12)).toEqual([]);
      const groups = changes.filter((c) => c.path.endsWith('.group'));
      expect(groups.length).toBeGreaterThan(0);
      for (const change of groups) expect(change, change.path).not.toHaveProperty('before');
      // Version 20 rewrote the bolt notes again, so version 12's wording is read from its fixture.
      const before = notesOf(stored);
      const after = notesOf(v12[i]);
      // The worked example's leg-to-beam bolt (spec, Hardware: grip 8.947).
      if (i === 0) {
        expect(after[0]).toBe(
          '1/2" through-bolt. Length: at least 8-15/16" plus two washers and a locking nut, and no more than 1/2" past the nut.',
        );
      }
      // Only the wording moves: the same numbers, in the same order.
      const numbers = (text: unknown) => String(text).match(/[\d/-]+"/g);
      expect(after.map(numbers)).toEqual(before.map(numbers));
      expect(after).not.toEqual(before);
    });
  });

  it("version 13 gives the largest moment's position its own step, in inches", () => {
    let checked = 0;
    for (const [i, stored] of v12.entries()) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(12);
      // Against version 25's plan, from before version 28 took bending at the hanger holes.
      const changes = regenerated(
        read.snapshot,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        v25[i],
      ).changes.filter(notVersion14);
      expect(changes.filter(notVersion13)).toEqual([]);
      for (const label of changes.filter((c) => c.path.endsWith('.label'))) {
        // The label loses its three-decimal position and nothing else.
        expect(String(label.before)).toMatch(/^Largest moment( per ply)?, at \d+\.\d{3} in$/);
        expect(label.after).toBe(String(label.before).replace(/, at .*$/, ''));
        const added = changes.find((c) => !c.path.endsWith('.label'));
        const position = added?.after as { label: string; value: number; unit: string };
        expect(position.label).toBe(`Position of largest moment${String(label.after).slice(14)}`);
        expect(position.unit).toBe('in');
        expect(position.value.toFixed(3)).toBe(String(label.before).match(/at (\S+) in/)?.[1]);
        checked += 1;
      }
    }
    // The two worked examples with a bending check: a solid beam and a built-up one.
    expect(checked).toBe(2);
  });

  it('version 14 adds empty dadoes, notches, and cutouts to every part, and changes nothing else (#300)', () => {
    // Stored as version 14 made them; read, a list a plan left out is already empty.
    const lists = (fixture: readonly unknown[]) =>
      fixture.flatMap((stored) =>
        (
          stored as { outputs: { design: { parts: Record<string, unknown>[] } } }
        ).outputs.design.parts.flatMap((part) => [part.dadoes, part.notches, part.cutouts]),
      );
    expect(lists(v13).every((list) => list === undefined)).toBe(true);
    expect(lists(v14).every((list) => Array.isArray(list) && list.length === 0)).toBe(true);
    for (const stored of v13) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(13);
      expect(regenerated(read.snapshot).changes.filter(notVersion15)).toEqual([]);
    }
  });

  it('version 15 adds the break-even dynamic factor, and changes no margin or computed value (#401)', () => {
    type Check = {
      status: string;
      margin?: number;
      computed?: unknown;
      allowable?: unknown;
      inputs?: { symbol: string; value: number }[];
      missing?: { key: string }[];
      breakEven?: { key: string; value: number };
    };
    type Review = { beam: { bending: Check; shear: Check }; hanger: Check };
    let withBreakEven = 0;
    for (const [i, stored] of v14.entries()) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(14);
      const { changes } = regenerated(read.snapshot);
      expect(changes.filter(notVersion15)).toEqual([]);

      // Against version 22's plan of the same example, the last before version 23 moved the
      // beam's supports (#445).
      const later = readSnapshot([template], v22[i]);
      if (!later.ok) throw new Error(JSON.stringify(later));
      const before = (read.snapshot.outputs as { structuralReview: Review }).structuralReview;
      const after = (later.snapshot.outputs as { structuralReview: Review }).structuralReview;
      const pairs: [Check, Check][] = [
        [before.beam.bending, after.beam.bending],
        [before.beam.shear, after.beam.shear],
        [before.hanger, after.hanger],
      ];
      for (const [old, current] of pairs) {
        expect(current.status).toBe(old.status);
        expect(current.margin).toBe(old.margin);
        expect(current.computed).toEqual(old.computed);
        expect(current.allowable).toEqual(old.allowable);
        // The same inputs are missing, in a new order.
        const keys = (c: Check) => (c.missing ?? []).map((m) => m.key).sort();
        expect(keys(current)).toEqual(keys(old));
        if (current.breakEven) {
          expect(current.breakEven.key).toBe('dynamicFactor');
          withBreakEven += 1;
        }
      }
      // The beam checks list the same quantities, the factor now after the loads.
      for (const kind of ['bending', 'shear'] as const) {
        const listed = (c: Check) => (c.inputs ?? []).map((q) => `${q.symbol} ${q.value}`).sort();
        expect(listed(after.beam[kind])).toEqual(listed(before.beam[kind]));
      }
    }
    expect(withBreakEven).toBeGreaterThan(0);
  });

  // Every worked example generated before, so none changes; version 16 only lets a plan on pads
  // be made without its anchor count (#406), which no stored plan can be.
  it('version 16 changes nothing for parameters that generated before (#406)', () => {
    for (const stored of v15) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(15);
      expect(regenerated(read.snapshot).changes).toEqual([]);
    }
  });

  // Version 17 stores the same plans, leaving out each part list that is empty (#430).
  it('version 17 leaves out each empty part list, and changes nothing a plan reads (#430)', () => {
    expect(emptyPartLists(v16)).not.toEqual([]);
    expect(emptyPartLists(v17)).toEqual([]);
    for (const stored of v16) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(regenerated(read.snapshot).changes).toEqual([]);
    }
  });

  it('version 18 names the input behind each entered value, and changes no number (#417)', () => {
    let named = 0;
    for (const stored of v17) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.suggested).toEqual([]);
      const { changes } = regenerated(read.snapshot, true);
      expect(changes.every(isVersion18)).toBe(true);
      named += changes.filter((c) => c.path.endsWith('.input')).length;
    }
    expect(named).toBeGreaterThan(0);
    // The leg-to-beam bolt is no longer called entered: it may be Kerf's suggestion.
    const first = readSnapshot([template], v18[0]);
    if (!first.ok) throw new Error(JSON.stringify(first));
    expect(JSON.stringify(first.snapshot.outputs)).not.toMatch(/" entered,/);
  });

  it("version 20 rewords only the legs' flush-cut note, with one measurement a mark (#455)", () => {
    for (const stored of v19) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      const current = createSnapshot(
        template,
        read.snapshot.params,
        read.snapshot.structuralInputs,
      );
      if (!current.ok) throw new Error('worked example no longer generates');
      const json = (value: unknown) => JSON.parse(JSON.stringify(value));
      const outputs = template.storedOutputs.parse(current.output.outputs);
      const changes = diff(json(read.snapshot.outputs), json(outputs), 1000).changes.filter(
        (c) =>
          !isVersion22(c) &&
          !isVersion23(c) &&
          !isVersion24(c) &&
          !isVersion25(c) &&
          !isVersion26(c) &&
          !isVersion27(c) &&
          !isVersion28(c),
      );
      expect(changes.every(isVersion20)).toBe(true);
      // Two legs, each in its part and its cut-list row.
      expect(changes).toHaveLength(4);
      for (const c of changes) expect(String(c.after)).not.toContain('square to it');
    }
  });

  // Hand check in lists.test.ts: the worked example's 1/2" leg-to-beam bolt, grip 8.947, fits from
  // 9.820 to 10.320, so 10"; the crossbar and gusset bolts, grip 5, fit from 5.873 to 6.373, so 6".
  it('version 21 changes no stored output (#457)', () => {
    for (const stored of v20) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(regenerated(read.snapshot).changes).toEqual([]);
    }
  });

  it('version 22 names each bolt by the length to buy, and changes nothing else (#449)', () => {
    for (const stored of v21) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(21);
      const { changes } = regenerated(read.snapshot, false, true);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.filter((c) => !isVersion22(c))).toEqual([]);
    }
    const first = readSnapshot([template], v21[0]);
    if (!first.ok) throw new Error(JSON.stringify(first));
    const descriptions = regenerated(first.snapshot, false, true)
      .changes.filter((c) => c.path.endsWith('.description'))
      .map((c) => [c.before, c.after]);
    expect(descriptions).toEqual([
      ['1/2" through-bolt, grip 8-15/16"', '1/2" × 10" through-bolt'],
      ['1/2" through-bolt, grip 5"', '1/2" × 6" through-bolt'],
    ]);
  });
  // Hand check in structural.test.ts: the worked example's span grows from 92.5 (frame
  // centerlines at 13.75 and 106.25) to 97.5 (gusset middles at 11.25 and 108.75), and example 1's
  // bending margin falls from 1.08 to 0.98.
  it('version 23 supports the beam on the gussets, and changes only the beam checks (#445)', () => {
    for (const stored of v22) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(22);
      const { changes } = regenerated(read.snapshot, false, false, true);
      expect(changes.filter((c) => !isVersion23(c))).toEqual([]);
    }
    const first = readSnapshot([template], v22[0]);
    if (!first.ok) throw new Error(JSON.stringify(first));
    const { changes } = regenerated(
      first.snapshot,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      v25[0],
    );
    expect(changes.length).toBeGreaterThan(0);
    const span = changes.find((c) => c.path === 'structuralReview.beam.bending.inputs[0].value');
    expect(span).toMatchObject({ before: 92.5, after: 97.5 });
    expect(String(changes.find((c) => c.path.endsWith('assumptions[0]'))?.after)).toMatch(
      /^Supported at the middle of each gusset's top edge under the beam, 11-1\/4" and 108-3\/4"/,
    );
  });

  // Hand check in resets.test.ts: the worked example's leg-to-beam bolts fit from 9.820 to 10.320.
  it("version 24 keeps the lengths that fit each bolt and each line's bolt, and changes nothing else (#514)", () => {
    for (const stored of v23) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(23);
      const { changes } = regenerated(read.snapshot, false, false, false, true);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.filter((c) => !isVersion24(c))).toEqual([]);
    }
    const first = readSnapshot([template], v23[0]);
    if (!first.ok) throw new Error(JSON.stringify(first));
    const legBolts = regenerated(first.snapshot, false, false, false, true).changes.find(
      (c) => c.path === 'hardware[0].bolt',
    );
    expect(legBolts?.after).toEqual({
      diameter: 0.5,
      grip: expect.closeTo(8.947, 3),
      length: 10,
      fits: { min: expect.closeTo(9.82, 3), max: expect.closeTo(10.32, 3) },
      items: ['leg-beam-bolts'],
    });
  });

  // Hand check in lists.test.ts: the worked example's beam fits a 10' board that measures
  // 121-1/8", or a 14', or a 4x8 beam; its legs a 14'; its crossbars two 8's or a 12'; its
  // gussets a 10'.
  it('version 25 moves the shorter-board note to its line and adds what else to buy (#450)', () => {
    for (const [i, stored] of v24.entries()) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(24);
      const { changes } = regenerated(
        read.snapshot,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        false,
        v25[i],
      );
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.filter((c) => !isVersion25(c))).toEqual([]);
      // The note moves whole: the same text, now on its line.
      const removed = changes.filter((c) => c.path.startsWith('lumber.notes'));
      const added = changes.filter((c) => /^lumber\.lines\[\d+\]\.notes/.test(c.path));
      expect(added.map((c) => c.after)).toEqual(removed.map((c) => c.before));
    }
    const first = readSnapshot([template], v24[0]);
    if (!first.ok) throw new Error(JSON.stringify(first));
    const beam = regenerated(
      first.snapshot,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      v25[0],
    ).changes.filter((c) => c.path.startsWith('lumber.lines[0].alternatives'));
    expect(beam.map((c) => c.after)).toEqual([
      { kind: 'measured', feet: 10, count: 1, atLeast: 121.125 },
      { kind: 'lengths', boards: [{ feet: 14, count: 1 }] },
      expect.objectContaining({ kind: 'stock', name: 'Beam', field: 'beamStock', nominal: '4x8' }),
    ]);
  });

  it('version 26 asks about UC4B and what each buried leg stands on, and changes no number (#464)', () => {
    for (const [i, stored] of v25.entries()) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(25);
      const { changes } = regenerated(
        read.snapshot,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
        v26[i],
      );
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.filter((c) => !isVersion26(c))).toEqual([]);
    }
    const first = readSnapshot([template], v25[0]);
    if (!first.ok) throw new Error(JSON.stringify(first));
    const { changes } = regenerated(
      first.snapshot,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      v26[0],
    );
    expect(changes.map((c) => c.path).sort()).toEqual([
      'design.flags[2].ask',
      'design.flags[2].why',
      'structuralReview.beam.bending.factors[0].reason',
      'structuralReview.beam.shear.factors[0].reason',
      'structuralReview.checklist[3].confirm',
    ]);
    const confirm = changes.find((c) => c.path.endsWith('.confirm'));
    expect(String(confirm?.after)).toContain(
      "what each leg's end stands on (gravel or tamped soil)",
    );
    expect(String(confirm?.after)).not.toMatch(/\d+"? (of )?gravel/);
  });

  // Hand check in operations.test.ts: each leg has 3 cuts (top, foot, flush cut), every other part
  // 2; each bolt's holes are treated where they pass through treated parts, which is every one.
  it('version 27 treats every cut and bolt hole, and adds the preservative (#447)', () => {
    for (const stored of v26) {
      const read = readSnapshot([template], stored);
      if (!read.ok) throw new Error(JSON.stringify(read));
      expect(read.snapshot.templateVersion).toBe(26);
      const { changes } = regenerated(
        read.snapshot,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
      );
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.filter((c) => !isVersion27(c))).toEqual([]);
    }
    const first = readSnapshot([template], v26[0]);
    if (!first.ok) throw new Error(JSON.stringify(first));
    const { changes } = regenerated(first.snapshot, false, false, false, false, false, false, true);
    const added = changes
      .filter((c) => c.path.startsWith('design.operations'))
      .map((c) => c.after as Operation);
    expect(added.map((op) => op.id)).toEqual([
      'beam/treat-cuts',
      'leg-back/treat-cuts',
      'leg-front/treat-cuts',
      'crossbar/treat-cuts',
      'gusset/treat-cuts',
      'leg-beam-bolts/treat-holes',
      'crossbar-bolts/treat-holes',
      'gusset-bolts/treat-holes',
    ]);
  });

  // Hand check in the spec, Structural model, example 1: a 1/2" hanger bolt down through the 4x6
  // in a 9/16" hole leaves S_net = 2.9375·5.5²/6 = 14.8099, and M at the inner hangers 17,743.78
  // gives f_b = 1198.10, margin 991.59 / 1198.10 = 0.8276, against 0.9849 on the gross section.
  it('version 28 takes bending at the hanger holes, which a plan without a mounting waits for (#446)', () => {
    for (const stored of v27) {
      const snapshot = read(stored);
      expect(snapshot.templateVersion).toBe(27);
      const { changes } = regenerated(snapshot, false, false, false, false, false, false, false, true);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.filter((c) => !isVersion28(c))).toEqual([]);
      const bending = (fresh(snapshot) as { structuralReview: { beam: { bending: unknown } } })
        .structuralReview.beam.bending;
      expect(bending).toMatchObject({
        status: 'input-needed',
        missing: expect.arrayContaining([
          { key: 'hardware.hangerMounting', label: 'Swing hanger mounting' },
        ]),
      });
    }
    type Bending = { status: string; margin: number; computed: { label: string } };
    const margin = (stored: unknown) =>
      (read(stored).outputs as { structuralReview: { beam: { bending: Bending } } })
        .structuralReview.beam.bending;
    expect(margin(v27[0]).margin).toBeCloseTo(0.98491, 4);
    expect(margin(v28[0]).margin).toBeCloseTo(0.82763, 4);
    expect(margin(v28[0]).computed.label).toBe(
      'Bending stress at left swing, right hanger hole, net section',
    );
  });
});
