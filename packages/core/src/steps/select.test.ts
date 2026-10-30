import { describe, expect, it } from 'vitest';
import type { Inventory } from '../inventory/tools.ts';
import { findMethod } from '../knowledge/methods.ts';
import type { Operation } from '../templates/operations.ts';
import { buildSteps } from './build.ts';
import { describeChoice, fitMethod, selectMethod } from './select.ts';

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

  it('refuses an outline that leaves out, repeats, or invents an operation', () => {
    const none = inventory();
    expect(() => buildSteps([{ ...step, operationIds: [post.id] }], [post, other], none)).toThrow(
      'missing [site/level-pads]',
    );
    expect(() =>
      buildSteps([{ ...step, operationIds: [post.id, post.id, other.id] }], [post, other], none),
    ).toThrow('twice [post/end-0]');
    expect(() => buildSteps([{ ...step, operationIds: ['nope'] }], [], none)).toThrow(
      'unknown [nope]',
    );
  });

  it("fills the chosen method's text and lists the tools it uses", () => {
    const shop = inventory(['miter-saw', { cutDepth: 4, crosscutWidth: 6 }], ['tape-measure']);
    const [built] = buildSteps([{ ...step, operationIds: [post.id] }], [post], shop);
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
