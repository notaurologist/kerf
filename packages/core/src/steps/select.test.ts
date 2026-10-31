import { describe, expect, it } from 'vitest';
import type { Inventory } from '../inventory/tools.ts';
import { findMethod } from '../knowledge/methods.ts';
import type { Operation } from '../model/operations.ts';
import { buildSteps, inventoryKey } from './build.ts';
import { describeChoice, fitMethod, meetingTool, selectMethod } from './select.ts';

// A square crosscut through a 3-1/2" by 3-1/2" post: what each method needs is set by those two
// numbers (knowledge/methods.ts).
const post: Operation = {
  id: 'post/end-0',
  type: 'crosscut',
  partId: 'post',
  count: 2,
  end: 0,
  width: 3.5,
  thickness: 3.5,
};

function inventory(...tools: [string, Record<string, number>?][]): Inventory {
  return {
    tools: tools.map(([id, caps]) => ({ toolTypeId: id, capabilities: caps ?? {} })),
    other: [],
  };
}

const marking: [string][] = [['tape-measure'], ['combination-square'], ['clamps']];

function method(id: string) {
  const found = findMethod(id);
  if (!found) throw new Error(`no method ${id}`);
  return found;
}

describe('several tools of one type', () => {
  const named = (id: string, name: string, caps: Record<string, number>) => ({
    toolTypeId: id,
    name,
    capabilities: caps,
  });

  it('chooses the first tool in the list that meets the method, and names it', () => {
    const shop: Inventory = {
      tools: [
        named('circular-saw', 'Small', { depthOfCut: 1.5 }),
        named('circular-saw', 'Big', { depthOfCut: 4 }),
        named('circular-saw', 'Also big', { depthOfCut: 4 }),
        ...inventory(...marking).tools,
      ],
      other: [],
    };
    const s = selectMethod(post, shop);
    expect(s.chosen?.id).toBe('crosscut-circular-saw');
    const saw = s.chosen?.tools[0];
    if (!saw) throw new Error('the method needs a saw');
    expect(meetingTool(saw, post, shop)?.name).toBe('Big');
  });

  it('reads a capability from the best tool of the type when none meets it', () => {
    const shop: Inventory = {
      tools: [
        named('circular-saw', 'Small', { depthOfCut: 1.5 }),
        named('circular-saw', 'Medium', { depthOfCut: 2.375 }),
      ],
      other: [],
    };
    const fit = fitMethod(method('crosscut-circular-saw'), post, shop);
    expect(fit.gaps[0]?.anyOf[0]?.short).toEqual([
      { capability: 'depthOfCut', atLeast: 3.5, entered: 2.375 },
    ]);
  });

  const holes: Operation = {
    id: 'bolts',
    type: 'bolt-holes',
    hardwareId: 'bolts',
    partIds: ['a', 'b'],
    count: 4,
    boltDiameter: 0.5,
    holeDiameter: 0.5625,
    depth: 8,
  };

  it('chooses the clamps that reach across the parts', () => {
    const holding = method('bolt-holes-auger-one-side').tools.find((r) =>
      r.use.startsWith('holding'),
    );
    if (!holding) throw new Error('the method holds the parts with clamps');
    const shop: Inventory = {
      tools: [
        named('clamps', 'Short', { maxOpening: 6 }),
        named('clamps', 'Long', { maxOpening: 12 }),
      ],
      other: [],
    };
    expect(meetingTool(holding, holes, shop)?.name).toBe('Long');
  });
});

describe('selectMethod', () => {
  it('takes the first method in preference order that the tools support', () => {
    const shop = inventory(['miter-saw', { cutDepth: 4, crosscutWidth: 6 }], ...marking, [
      'hand-saw',
    ]);
    const s = selectMethod(post, shop);
    expect(s.chosen?.id).toBe('crosscut-miter-saw');
    expect(s.suggestions).toEqual([]);
    expect(s.inputNeeded).toEqual([]);
  });

  // 3.5 / 2 = 1.75, so a saw that cuts 2-3/8" reaches past halfway from each face but not
  // through in one pass.
  it('cuts from two faces when the saw reaches past halfway but not through', () => {
    const s = selectMethod(post, inventory(['circular-saw', { depthOfCut: 2.375 }], ...marking));
    expect(s.chosen?.id).toBe('crosscut-circular-saw-two-faces');
    expect(s.suggestions.map((x) => [x.methodId, x.better])).toEqual([
      ['crosscut-miter-saw', ['easier', 'more accurate']],
      ['crosscut-circular-saw', ['easier', 'more accurate']],
    ]);
    const onePass = s.suggestions[1]?.gaps[0]?.anyOf[0];
    if (!onePass) throw new Error('no gap for the one-pass saw');
    expect(describeChoice(onePass)).toBe(
      'Circular saw with depth of cut with the blade square at least 3-1/2" (you entered 2-3/8")',
    );
  });

  it('says which capability to enter when only that keeps a better method out', () => {
    const s = selectMethod(post, inventory(['circular-saw'], ...marking, ['hand-saw']));
    expect(s.chosen?.id).toBe('crosscut-hand-saw');
    expect(s.inputNeeded.map((f) => f.method.id)).toEqual([
      'crosscut-circular-saw',
      'crosscut-circular-saw-two-faces',
    ]);
    const gap = s.inputNeeded[0]?.gaps[0]?.anyOf[0];
    expect(gap && describeChoice(gap)).toBe(
      'Circular saw with depth of cut with the blade square at least 3-1/2" (not entered)',
    );
  });

  it('with no method supported, names the tools for the one closest to supported', () => {
    const s = selectMethod(post, inventory(['tape-measure'], ['combination-square']));
    expect(s.chosen).toBeUndefined();
    // The miter saw method lacks only the saw; the hand saw method lacks the saw and clamps.
    expect(s.needed?.method.id).toBe('crosscut-miter-saw');
    expect(s.needed?.gaps.map((g) => g.anyOf.map(describeChoice))).toEqual([
      [
        'Miter saw with thickest board it cuts through at least 3-1/2" and widest crosscut with the saw square at least 3-1/2"',
      ],
    ]);
  });

  it('meets a requirement with any one of its tool types', () => {
    const method = findMethod('crosscut-hand-saw');
    if (!method) throw new Error('no hand saw method');
    const withRafter = inventory(['hand-saw'], ['tape-measure'], ['rafter-square'], ['clamps']);
    expect(fitMethod(method, post, withRafter).gaps).toEqual([]);
  });
});

describe('buildSteps', () => {
  const other: Operation = { id: 'site/level-pads', type: 'level-pads', count: 4 };
  const step = { id: 's', title: 'Do it', categories: [] };
  // Two 40" posts on one 8' 4x4: 96 − (2 · 1/2 trim + 2 · (40 + 1/8 kerf)) = 14.75 left over.
  const piece = { partId: 'post', name: 'Post', length: 40 };
  const oneBoard = { nominal: '4x4' as const, feet: 8, pieces: [piece, piece], offcut: 14.75 };
  const lumber = (...boards: (typeof oneBoard)[]) => ({
    boards,
    kerf: 0.125,
    trimPerEnd: 0.5,
    lines: [],
    notes: [],
    issues: [],
    selection: [],
  });
  const plan = (operations: Operation[], boards = [oneBoard]) => ({
    operations,
    flags: [],
    lumber: lumber(...boards),
  });

  it('refuses an outline that leaves out, repeats, or invents an operation, or holds a cut', () => {
    const none = inventory();
    expect(() => buildSteps([], plan([post, other]), none)).toThrow('missing [site/level-pads]');
    expect(() =>
      buildSteps([{ ...step, operationIds: [other.id, other.id] }], plan([post, other]), none),
    ).toThrow('twice [site/level-pads]');
    expect(() => buildSteps([{ ...step, operationIds: ['nope'] }], plan([other]), none)).toThrow(
      'unknown or cutting [nope]',
    );
    // Cuts belong to the board steps.
    expect(() =>
      buildSteps([{ ...step, operationIds: [post.id, other.id] }], plan([post, other]), none),
    ).toThrow('unknown or cutting [post/end-0]');
  });

  it('cuts board by board, then follows the outline (#58)', () => {
    const built = buildSteps(
      [{ ...step, operationIds: [other.id] }],
      plan([post, other]),
      inventory(),
    );
    expect(built.map((s) => [s.id, s.title, s.operations.map((o) => o.operation.id)])).toEqual([
      // Named by what comes off it (#131): two posts.
      ['board-1', "Cut board 1, a 4x4 8' long: 2 × Post", ['post/end-0']],
      ['s', 'Do it', ['site/level-pads']],
    ]);
    expect(built[0]?.board).toEqual({
      id: '4x4/8/1',
      number: 1,
      nominal: '4x4',
      feet: 8,
      trimPerEnd: 0.5,
      kerf: 0.125,
      offcut: 14.75,
      pieces: [
        { partId: 'post', instance: 0, length: 40, operationIds: ['post/end-0'] },
        { partId: 'post', instance: 1, length: 40, operationIds: ['post/end-0'] },
      ],
    });
    expect(built[1]?.board).toBeUndefined();
  });

  it("counts a part's pieces through the boards, and repeats its cuts on each board", () => {
    const single = { ...oneBoard, pieces: [piece], offcut: 55.375 };
    const built = buildSteps([], plan([post], [single, single]), inventory());
    expect(built.map((s) => s.board?.pieces.map((p) => [p.partId, p.instance]))).toEqual([
      [['post', 0]],
      [['post', 1]],
    ]);
    expect(built[1]?.operations).toEqual(built[0]?.operations);
  });

  it('gives a cut whose part is on no board a step of its own, so it is not left out', () => {
    const built = buildSteps([], plan([post], []), inventory());
    expect(built.map((s) => [s.id, s.operations.map((o) => o.operation.id)])).toEqual([
      ['cut-unplanned', ['post/end-0']],
    ]);
  });

  it('makes no steps for a plan made before operations', () => {
    expect(buildSteps([], plan([]), inventory())).toEqual([]);
  });

  it("fills the chosen method's text and lists the tools it uses", () => {
    const shop = inventory(['miter-saw', { cutDepth: 4, crosscutWidth: 6 }], ['tape-measure']);
    const [built] = buildSteps([], plan([post]), shop);
    const op = built?.operations[0];
    expect(op?.method?.technique).toContain('Cut 2 this way.');
    expect(op?.method?.tools).toEqual([
      { use: 'cutting', toolTypeId: 'miter-saw' },
      { use: 'measuring', toolTypeId: 'tape-measure' },
    ]);
    expect(op?.skills).toEqual(['measure-and-mark', 'cut-to-a-line']);
    expect(built?.partIds).toEqual(['post']);
  });
});

describe('inventoryKey', () => {
  it('is the same for the same tools in any order, and differs when a capability changes', () => {
    const a = inventory(['hand-saw'], ['circular-saw', { depthOfCut: 2.375 }]);
    const b = inventory(['circular-saw', { depthOfCut: 2.375 }], ['hand-saw']);
    expect(inventoryKey(a)).toBe(inventoryKey(b));
    expect(inventoryKey(a)).toMatch(/^[0-9a-f]{8}$/);
    const deeper = inventory(['hand-saw'], ['circular-saw', { depthOfCut: 2.5 }]);
    expect(inventoryKey(deeper)).not.toBe(inventoryKey(a));
    expect(inventoryKey({ ...a, other: [{ name: 'Rasp', note: '' }] })).toBe(inventoryKey(a));
  });
});
