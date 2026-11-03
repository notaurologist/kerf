import { describe, expect, it } from 'vitest';
import { solid } from '../geometry/solid.ts';
import { describeBasis } from '../model/questions.ts';
import { ChecklistItem, Flag } from '../model/types.ts';
import { LumberPlan } from '../outputs/shoppingList.ts';
import { leaveOutDefaults } from '../snapshot/defaults.ts';
import { shapeOf } from '../snapshot/shape.ts';
import { shownOnRead } from '../snapshot/shown.ts';
import { createSnapshot, readSnapshot } from '../snapshot/snapshot.ts';
import { planSteps } from '../steps/build.ts';
import { BRAND_NAMES, VERDICT_WORDS, withoutBrandExceptions } from '../testing.ts';
import { TEMPLATES } from './index.ts';

// What every template promises generic code (model/definition.ts), checked on its worked examples.

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** What a template generates for a worked example, before a snapshot leaves out its defaults. */
function generated(t: (typeof TEMPLATES)[number], e: (typeof t.examples)[number]): unknown {
  const made = t.generate(t.params.parse(e.params), t.structuralInputs.parse(e.structuralInputs));
  if (!made.ok) throw new Error(JSON.stringify(made.issues));
  return made.output;
}

const examples = TEMPLATES.flatMap((t) => t.examples.map((e) => [t.id, e.name, t, e] as const));

/** Every string in a value, at any depth. */
const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : typeof value === 'object' && value !== null
      ? Object.values(value).flatMap(strings)
      : [];

/**
 * Every word a template gives the reader: its name and description, its form, its starting
 * questions and what they suggest, its store readings, and for each worked example the outputs,
 * plan, and build steps.
 */
function templateText(t: (typeof TEMPLATES)[number]): string[] {
  const suggestions = (t.questions?.examples ?? []).flatMap((a) => t.questions?.suggest(a) ?? []);
  const plans = t.examples.map((e) => {
    const made = createSnapshot(t, e.params, e.structuralInputs);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const outputs = t.storedOutputs.parse(asJson(made.output.outputs));
    return [outputs, t.plan(outputs), t.steps(outputs), planSteps(t, outputs, { tools: [] })];
  });
  return strings(
    asJson([
      t.name,
      t.description,
      t.form,
      t.questions?.form,
      suggestions,
      suggestions.map((s) => describeBasis(s.basis)),
      t.storeReadings,
      plans,
    ]),
  );
}

/**
 * Every committed snapshot fixture, by template ID and template version: the worked examples as
 * that version stored them (decision 0014). Fixtures are never rewritten.
 */
const FIXTURES = (() => {
  const files = import.meta.glob<readonly unknown[]>('./*/snapshots/v*.json', {
    eager: true,
    import: 'default',
  });
  const byTemplate: Record<string, Record<number, readonly unknown[]>> = {};
  for (const [path, fixture] of Object.entries(files)) {
    const [, id, version] = path.match(/^\.\/([^/]+)\/snapshots\/v(\d+)\.json$/) ?? [];
    if (!id || !version) throw new Error(`Unexpected fixture path ${path}`);
    byTemplate[id] = { ...byTemplate[id], [Number(version)]: fixture };
  }
  return byTemplate;
})();

const fixturesOf = (t: (typeof TEMPLATES)[number]) => FIXTURES[t.id] ?? {};

/**
 * What the current version's worked examples show when read, by template ID and template version:
 * the plan, build steps, and drawing dimensions core derives from stored outputs on every read.
 * Written with the fixture; the previous version's copy is removed then.
 */
const SHOWN = (() => {
  const files = import.meta.glob<readonly unknown[]>('./*/shown/v*.json', {
    eager: true,
    import: 'default',
  });
  const byTemplate: Record<string, Record<number, readonly unknown[]>> = {};
  for (const [path, shown] of Object.entries(files)) {
    const [, id, version] = path.match(/^\.\/([^/]+)\/shown\/v(\d+)\.json$/) ?? [];
    if (!id || !version) throw new Error(`Unexpected file ${path}`);
    byTemplate[id] = { ...byTemplate[id], [Number(version)]: shown };
  }
  return byTemplate;
})();

const storedFixtures = TEMPLATES.flatMap((t) =>
  Object.entries(fixturesOf(t)).map(([version, fixture]) => [t.id, version, t, fixture] as const),
);

describe('every template', () => {
  it.each(examples)('%s, %s: generates what its outputs schema requires', (_, __, t, e) => {
    const outputs = asJson(generated(t, e));
    expect(t.outputs.parse(outputs)).toEqual(outputs);
  });

  it.each(examples)('%s, %s: reads what it generates back unchanged', (_, __, t, e) => {
    // The snapshot leaves out what is still at its default; reading fills it back in.
    const outputs = asJson(generated(t, e));
    const made = createSnapshot(t, e.params, e.structuralInputs);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    expect(t.storedOutputs.parse(asJson(made.output.outputs))).toEqual(outputs);
    const read = readSnapshot(TEMPLATES, asJson(made.output));
    expect(read.ok && asJson(read.snapshot.outputs)).toEqual(outputs);
  });

  it.each(examples)('%s, %s: draws every face of every part facing a direction', (_, __, t, e) => {
    // A face with no direction cannot order the faces around it, and they went undrawn (#352).
    const made = createSnapshot(t, e.params, e.structuralInputs);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const scene = t.assembly(t.storedOutputs.parse(asJson(made.output.outputs)))?.scene;
    for (const pl of scene?.placements ?? []) {
      const part = scene?.parts.find((p) => p.id === pl.partId);
      if (!part) continue;
      for (const f of solid(part, pl).faces) {
        expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
      }
    }
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s gives no verdicts', (_, t) => {
    expect(templateText(t).filter((text) => VERDICT_WORDS.test(text))).toEqual([]);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s names no brands', (_, t) => {
    const named = templateText(t).filter((text) => BRAND_NAMES.test(withoutBrandExceptions(text)));
    expect(named).toEqual([]);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s names its own words', (_, t) => {
    expect(t.ownWords.length).toBeGreaterThan(0);
    expect(t.ownWords.every((w) => w === w.toLowerCase() && w.trim() === w)).toBe(true);
  });
});

describe('every template stays readable (decision 0014)', () => {
  const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  /** The current version's snapshots of the worked examples, as stored. */
  const current = (t: (typeof TEMPLATES)[number]) =>
    t.examples.map((e) => {
      const made = createSnapshot(t, e.params, e.structuralInputs);
      if (!made.ok) throw new Error(e.name);
      return asJson(made.output);
    });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    '%s has a fixture for every template version and every shape, and an upgrade between shapes',
    (_, t) => {
      const fixtures = fixturesOf(t);
      expect(
        Object.keys(fixtures)
          .map(Number)
          .sort((a, b) => a - b),
      ).toEqual(upTo(t.version));
      const shapes = Object.entries(fixtures).flatMap(([version, fixture]) =>
        (fixture as { templateVersion: number; snapshotVersion: number }[]).map((s) => {
          expect(s.templateVersion).toBe(Number(version));
          return s.snapshotVersion;
        }),
      );
      expect([...new Set(shapes)].sort((a, b) => a - b)).toEqual(upTo(t.snapshotVersion));
      expect(Object.keys(t.snapshotUpgrades).map(Number)).toEqual(upTo(t.snapshotVersion - 1));
    },
  );

  it.each(storedFixtures)('%s v%s holds one snapshot per worked example', (_, __, t, fixture) => {
    expect(fixture).toHaveLength(t.examples.length);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    '%s regenerates the fixture of its current version exactly',
    (id, t) => {
      expect(
        current(t),
        'The worked examples generate different output at the same template version. Bump the ' +
          "template's version, and its snapshotVersion too if the stored shape changed (decision " +
          `0008), then write the new fixture: pnpm --filter @kerf/api write-snapshot-fixture ${id} ` +
          '(decision 0014).',
      ).toEqual(fixturesOf(t)[t.version]);
    },
  );

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    '%s shows its current fixture as it did when the fixture was written',
    (id, t) => {
      // Plans, build steps, and drawings are derived from stored outputs on every read, so a
      // change to generic code there changes every stored plan, with no new fixture to show it.
      expect(Object.keys(SHOWN[id] ?? {})).toEqual([String(t.version)]);
      const shown = (fixturesOf(t)[t.version] ?? []).map((stored) => {
        const read = readSnapshot([t], stored);
        if (!read.ok) throw new Error(read.message);
        return asJson(shownOnRead(t, t.storedOutputs.parse(read.snapshot.outputs)));
      });
      expect(
        shown,
        'A stored plan reads differently: its plan, build steps, or drawing dimensions changed. ' +
          'That changes every stored plan, older versions included. Bump the version of each ' +
          `template it changes and write the new fixture: pnpm --filter @kerf/api ` +
          `write-snapshot-fixture ${id} (decision 0014).`,
      ).toEqual(SHOWN[id]?.[t.version]);
    },
  );

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    '%s generates snapshots in the current shape',
    (id, t) => {
      expect(
        shapeOf(current(t)),
        'The stored shape changed. Bump snapshotVersion, add an upgrade from the previous shape, ' +
          `and write the new fixture: pnpm --filter @kerf/api write-snapshot-fixture ${id} ` +
          '(decision 0014).',
      ).toEqual(shapeOf(fixturesOf(t)[t.version]));
    },
  );

  it.each(storedFixtures)(
    '%s reads every snapshot stored at v%s, keeping its template version',
    (_, __, t, fixture) => {
      for (const stored of fixture) {
        const read = readSnapshot([t], stored);
        expect(read.ok, JSON.stringify(read)).toBe(true);
        if (!read.ok) continue;
        // An upgrade restructures only: the plan keeps the template version its numbers came from.
        expect(read.snapshot.templateVersion).toBe(
          (stored as { templateVersion: number }).templateVersion,
        );
      }
    },
  );

  it.each(storedFixtures)(
    '%s fills in what generic code reads for a plan stored at v%s',
    (_, __, t, fixture) => {
      for (const stored of fixture) {
        const read = readSnapshot([t], stored);
        if (!read.ok) throw new Error(read.message);
        const outputs = t.storedOutputs.parse(read.snapshot.outputs);
        const plan = t.plan(outputs);
        for (const flag of plan.flags) Flag.parse(flag);
        for (const item of plan.checklist) ChecklistItem.parse(item);
        LumberPlan.parse(plan.lumber);
        expect(t.drawings(outputs).cutDetails).toHaveLength(plan.cutList.length);
      }
    },
  );

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    '%s reads the current shape back exactly, dropping nothing',
    (_, t) => {
      const stored = fixturesOf(t)[t.version] ?? [];
      expect(stored).not.toHaveLength(0);
      for (const snapshot of stored) {
        // Reading fills in each list the snapshot left out as empty; storing leaves it out again.
        const read = readSnapshot([t], snapshot);
        if (!read.ok) throw new Error(read.message);
        const outputs = leaveOutDefaults(t.outputs, read.snapshot.outputs);
        expect(asJson({ ...read.snapshot, outputs })).toEqual(snapshot);
      }
    },
  );
});
