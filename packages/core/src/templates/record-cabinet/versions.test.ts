import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { type Change, diff } from '../../snapshot/diff.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { recordCabinet } from './definition.ts';
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
import v14 from './snapshots/v14.json' with { type: 'json' };
import v15 from './snapshots/v15.json' with { type: 'json' };
import v16 from './snapshots/v16.json' with { type: 'json' };
import v17 from './snapshots/v17.json' with { type: 'json' };
import v18 from './snapshots/v18.json' with { type: 'json' };
import v19 from './snapshots/v19.json' with { type: 'json' };
import v20 from './snapshots/v20.json' with { type: 'json' };
import v21 from './snapshots/v21.json' with { type: 'json' };

// What each template version changed in the worked examples (decision 0008). Each version's
// fixture and the one before it are read through the upgrades to the current shape, so their
// difference is only what that version changed, not what later versions or shapes added.

const template = recordCabinet as TemplateDefinition;

/** A fixture's snapshots in the current shape, without the version stamps. */
function current(fixture: readonly unknown[]): unknown[] {
  return fixture.map((stored) => {
    const read = readSnapshot([template], stored);
    if (!read.ok) throw new Error(JSON.stringify(read));
    const { params, structuralInputs, outputs } = read.snapshot;
    return JSON.parse(JSON.stringify({ params, structuralInputs, outputs }));
  });
}

/** Each worked example's changes from one fixture to the next. */
function changes(before: readonly unknown[], after: readonly unknown[]): Change[] {
  const a = current(before);
  const b = current(after);
  return a.flatMap((snapshot, i) => {
    const result = diff(snapshot, b[i], 5000);
    expect(result.truncated).toBe(false);
    return result.changes;
  });
}

/** The changed paths, with list positions taken out: 'outputs.cutList[].stock'. */
const kinds = (list: readonly Change[]) =>
  [...new Set(list.map((c) => c.path.replace(/\[\d+\]/g, '[]')))].sort();

/** Every list a stored part holds, by name, that is empty. */
const emptyPartLists = (fixture: readonly unknown[]) =>
  fixture.flatMap((stored) =>
    (stored as { outputs: { design: { parts: Record<string, unknown>[] } } }).outputs.design.parts
      .flatMap((part) => Object.entries(part))
      .filter(([, value]) => Array.isArray(value) && value.length === 0)
      .map(([key]) => key),
  );

describe('record-cabinet template versions', () => {
  it('version 2 adds flattening, so the examples glue 3/4" panels from thicker boards (#319)', () => {
    const list = changes(v1, v2);
    expect(kinds(list)).toEqual(
      [
        'outputs.cutList[].panel.recipe',
        'outputs.design.operations[].thickness',
        'outputs.design.params.allowances.flatten',
        'outputs.design.params.board.thickness',
        'outputs.design.parts[].stock.allowances.flatten',
        'outputs.design.parts[].stock.board.nominal',
        'outputs.design.parts[].stock.board.thickness',
        'outputs.lumber.boards[].nominal',
        'outputs.lumber.lines[].nominal',
        'params.allowances.flatten',
        'params.board.thickness',
      ].sort(),
    );
    // 4/4 surfaced to 13/16" for 3/4" panels, and 5/4 to 1-1/16" for the 1" edge example; the
    // upgrade read version 1's flattening as 0, and version 2 takes 1/16".
    const pairs = (path: RegExp) =>
      [
        ...new Set(list.filter((c) => path.test(c.path)).map((c) => `${c.before}>${c.after}`)),
      ].sort();
    expect(pairs(/^params\.board\.thickness$/)).toEqual(['0.75>0.8125', '1>1.0625']);
    expect(pairs(/^params\.allowances\.flatten$/)).toEqual(['0>0.0625']);
  });

  it('version 3 keeps a one-board rail at its board’s thickness, and fits its dadoes to it (#320)', () => {
    const list = changes(v2, v3);
    expect(kinds(list)).toEqual(
      [
        'outputs.cutList[].stock',
        'outputs.design.operations[].length',
        'outputs.design.operations[].thickness',
        'outputs.design.parts[].dadoes[].v0',
        'outputs.design.parts[].stock.thickness',
      ].sort(),
    );
    // Only the rails' stock changes: a 3/4" panel became the 13/16" board, and 1" the 1-1/16".
    const stocks = list.filter((c) => c.path.endsWith('.stock'));
    expect(stocks.map((c) => [c.before, c.after])).toContainEqual([
      'Panel (3/4" x 3")',
      'Board (13/16" x 3")',
    ]);
    // Each rail dado starts the rail's thickness from the back: 15 − 13/16 = 14-3/16.
    const dadoes = list.filter((c) => c.path.endsWith('.v0'));
    expect(dadoes.length).toBeGreaterThan(0);
    for (const c of dadoes.filter((d) => d.before === 14.25)) expect(c.after).toBe(14.1875);
  });

  it('version 4 adds the dry fit, the glue-ups, and the finish, and changes no other step (#313)', () => {
    const ops = (fixture: readonly unknown[]) =>
      current(fixture).map(
        (s) =>
          new Map(
            (
              s as { outputs: { design: { operations: { id: string }[] } } }
            ).outputs.design.operations.map((op) => [op.id, op]),
          ),
      );
    const before = ops(v3);
    const after = ops(v4);
    before.forEach((old, i) => {
      const now = after[i] ?? new Map();
      const added = [...now.keys()].filter((id) => !old.has(id));
      expect(added).toEqual(['case/dry-fit', 'case/glue', 'top/glue', 'case/finish']);
      for (const [id, op] of old) expect(now.get(id), id).toEqual(op);
    });
  });

  it('version 5 adds dealer hardwood; the store-board examples regenerate unchanged (#296)', () => {
    expect(changes(v4, v5)).toEqual([]);
    const boards = current(v5).map(
      (s) => (s as { params: { board: { source: string } } }).params.board,
    );
    expect(boards.every((b) => b.source === 'store')).toBe(true);
  });

  it('version 6 lets the lumber settle before cutting, and changes nothing else (#332)', () => {
    const list = changes(v5, v6);
    const ids = (fixture: readonly unknown[]) =>
      current(fixture).map((s) =>
        (
          s as { outputs: { design: { operations: { id: string }[] } } }
        ).outputs.design.operations.map((op) => op.id),
      );
    ids(v6).forEach((now, i) => {
      expect(now[0]).toBe('lumber/acclimate');
      expect(now.slice(1)).toEqual(ids(v5)[i]);
    });
    // Inserting one operation at the front shifts every later one, and nothing outside them changes.
    expect(list.every((c) => c.path.startsWith('outputs.design.operations'))).toBe(true);
  });

  it('version 7 asks for the largest item and the weight on the top, not a turntable and speaker (#331)', () => {
    // The stored turntable became the largest item. Its 20 lb and the 13.89 lb speaker on the
    // top were entered apart, and no one entered their sum, so a stored plan has no weight on the
    // top until the owner enters one (#429); the examples now carry an illustrative 35 lb.
    const [stored] = current(v6) as { structuralInputs: { topLoad?: number } }[];
    expect(stored?.structuralInputs.topLoad).toBeUndefined();
    const list = changes(v6, v7);
    expect(
      list.every((c) =>
        /^(structuralInputs\.topLoad|outputs\.review\.(top\.|flags|checklist))/.test(c.path),
      ),
    ).toBe(true);
    const ask = list.find((c) => c.path.endsWith('.ask'));
    expect(ask?.after).toContain('the top under everything that stands on it');
  });

  it('version 8 sets the case on a leg base: legs, aprons, cleats, and a case bottom (#338)', () => {
    const ids = (fixture: readonly unknown[]) =>
      current(fixture).map((snapshot) =>
        (snapshot as { outputs: { design: { parts: { id: string }[] } } }).outputs.design.parts.map(
          (part) => part.id,
        ),
      );
    // The bottom shelves go; the case bottom, legs, aprons, and cleats come in.
    const [before, after] = [ids(v7)[0] ?? [], ids(v8)[0] ?? []];
    expect(before.filter((id) => !after.includes(id))).toEqual(['shelf']);
    expect(after.filter((id) => !before.includes(id))).toEqual([
      'bottom',
      'leg',
      'apron-long',
      'apron-short',
      'cleat',
    ]);
    // The top's height follows from the base now: 22-1/4" in place of the stored 20".
    const height = (fixture: readonly unknown[]) =>
      (current(fixture)[0] as { outputs: { design: { geometry: { height: number } } } }).outputs
        .design.geometry.height;
    expect([height(v7), height(v8)]).toEqual([20, 22.25]);
  });

  it('version 9 adds sliding doors on the end bays, in a case 17" deep (#339)', () => {
    const snapshots = (fixture: readonly unknown[]) =>
      current(fixture) as {
        params: { doors: string; caseDepth: number };
        outputs: { design: { parts: { id: string }[] } };
      }[];
    const [before, after] = [snapshots(v8), snapshots(v9)];
    // A stored version 8 plan reads back with no doors.
    expect(before.map((s) => s.params.doors)).toEqual(['none', 'none', 'none']);
    expect(after.map((s) => s.params.doors)).toEqual(['sliding', 'sliding', 'none']);
    expect([before[0]?.params.caseDepth, after[0]?.params.caseDepth]).toEqual([15, 17]);
    const ids = (s: (typeof after)[number] | undefined) =>
      s?.outputs.design.parts.map((part) => part.id) ?? [];
    expect(ids(after[0]).filter((id) => !ids(before[0]).includes(id))).toEqual([
      'door-stile-outer',
      'door-stile-inner',
      'door-rail',
      'door-panel',
    ]);
    // The edge of range has no doors and keeps its case: only the version stamps and the
    // doors' parameters differ.
    const edge = changes([v8[2]], [v9[2]]);
    expect(kinds(edge).filter((path) => !path.includes('.door'))).toEqual([]);
  });

  it('version 10 rewords a screw note and an assumption, and changes nothing else (#418)', () => {
    const list = changes(v9, v10);
    expect(kinds(list)).toEqual([
      'outputs.design.hardware[].notes[]',
      'outputs.review.apron.deflection.assumptions[]',
    ]);
    expect(list.map((c) => c.after).every((text) => !/\bpass(es)?\b/.test(String(text)))).toBe(
      true,
    );
  });

  it('version 11 rewrites the screws note to say how to find the size, and changes nothing else (#438)', () => {
    const list = changes(v10, v11);
    expect(kinds(list)).toEqual(['outputs.design.hardware[].notes[]']);
  });

  it('version 12 leaves out each empty part list, and reads the same as before (#430)', () => {
    expect(emptyPartLists(v11)).not.toEqual([]);
    expect(emptyPartLists(v12)).toEqual([]);
    expect(changes(v11, v12)).toEqual([]);
  });

  it('version 13 names the input behind each entered value, and changes nothing else (#417)', () => {
    const list = changes(v12, v13);
    expect(kinds(list)).toEqual([
      'outputs.review.apron.deflection.inputs[].input',
      'outputs.review.movement[].inputs[].input',
      'outputs.review.top.deflection.inputs[].input',
    ]);
    expect([...new Set(list.map((c) => c.after))].sort()).toEqual([
      'deflectionLimit',
      'moisture.high',
      'moisture.low',
    ]);
  });

  it('version 14 changes no stored output (#459)', () => {
    expect(changes(v13, v14)).toEqual([]);
  });

  it('version 15 changes no stored output (#457)', () => {
    expect(changes(v14, v15)).toEqual([]);
  });

  it('version 16 names the screw length and carries each item’s notes to its line (#449)', () => {
    const list = changes(v15, v16);
    expect(kinds(list)).toEqual([
      'outputs.design.hardware[].name',
      'outputs.design.hardware[].notes[]',
      'outputs.hardware[].description',
      'outputs.hardware[].notes[]',
    ]);
    const named = list.filter((c) => c.path.endsWith('.name') || c.path.endsWith('.description'));
    expect(named.map((c) => [c.before, c.after])).toContainEqual([
      'Wood screws',
      'Wood screws, 1-1/4" long',
    ]);
  });

  it('version 17 adds what else to buy on each lumber line, and changes nothing else (#450)', () => {
    const list = changes(v16, v17);
    expect(kinds(list)).toEqual(['outputs.lumber.lines[].alternatives[]']);
    for (const c of list) expect(c).not.toHaveProperty('before');
  });

  // Hand check in template.test.ts: the worked example's case bottom sags 1.5 × 0.0043156" in
  // each bay, the edge of range's 1.5 × 0.000792".
  it('version 18 checks the case bottom in each bay, and adds it to the flags and checklist (#464)', () => {
    const list = changes(v17, v18);
    expect(kinds(list)).toEqual([
      'outputs.review.bottom',
      'outputs.review.checklist[].confirm',
      'outputs.review.checklist[].partIds[]',
      'outputs.review.flags[].partIds[]',
      'outputs.review.flags[].why',
    ]);
    const added = list.filter((c) => c.path === 'outputs.review.bottom');
    expect(added.map((c) => c.before)).toEqual([undefined, undefined, undefined]);
    const sag = added.map(
      (c) =>
        (c.after as { deflection: { computed?: { value: number } } }).deflection.computed?.value,
    );
    expect(sag).toEqual([expect.closeTo(0.0064733, 6), undefined, expect.closeTo(0.0011882, 6)]);
  });

  // Hand check in template.test.ts: a one-board door panel 1" thick, against t = 3/4, is rabbeted
  // 3/8 deep on each face, to a 1/4 tongue. Every worked example's door panel is glued up.
  it('version 19 sizes a one-board door panel’s tongue from its stock, which no example has (#562)', () => {
    expect(changes(v18, v19)).toEqual([]);
  });

  it('version 20 flags the wood left above the top’s door tracks (#574)', () => {
    // Hand check in template.test.ts: 9/16 tracks in a 3/4 top leave 3/16 above them. Only the
    // flags change; examples without doors have no tracks and no new flag.
    expect(kinds(changes(v19, v20)).every((k) => k.startsWith('outputs.review.flags[]'))).toBe(
      true,
    );
    const asks = (fixture: readonly unknown[]) =>
      current(fixture).map((s) =>
        (s as { outputs: { review: { flags: { ask: string }[] } } }).outputs.review.flags.map(
          (f) => f.ask,
        ),
      );
    const before = asks(v19);
    const added = asks(v20).map((list, i) => list.filter((a) => !before[i]?.includes(a)));
    const doors = current(v20).map(
      (s) => (s as { params: { doors: string } }).params.doors === 'sliding',
    );
    expect(added).toEqual(
      doors.map((d) =>
        d
          ? [
              'Ask an experienced builder whether 3/16" of wood above the door tracks holds the top\'s front edge.',
            ]
          : [],
      ),
    );
    expect(doors).toContain(true);
  });

  it('version 21 planes parts thinner than their board, which no example has (#609)', () => {
    // Hand check in template.test.ts: a 1-1/4" board planed 1/2 to 3/4 parts. The examples'
    // boards are within the 1/16 flattening allowance of their panels, so nothing is planed.
    expect(changes(v20, v21)).toEqual([]);
  });
});
