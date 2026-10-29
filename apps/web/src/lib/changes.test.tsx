import { describe, expect, it } from 'vitest';
import { indexChanges } from './changes.tsx';

describe('indexChanges', () => {
  const changes = indexChanges([
    { path: 'cutList[0].length', before: '120"', after: '132"' },
    { path: 'cutList[1].ends[0]', before: 'Square', after: 'Level' },
    { path: 'cutList[4]', before: { name: 'Gusset' } },
    { path: 'hardware[2]', after: { description: 'Lag screw' } },
  ]);

  it('finds a change by its exact path', () => {
    expect(changes.at('cutList[0].length')).toEqual({
      path: 'cutList[0].length',
      before: '120"',
      after: '132"',
    });
    expect(changes.at('cutList[0]')).toBeUndefined();
  });

  it('says whether anything under a path changed, without matching a longer index', () => {
    expect(changes.under('cutList[0]')).toBe(true);
    expect(changes.under('cutList[1]')).toBe(true);
    expect(changes.under('cutList[2]')).toBe(false);
    expect(changes.under('cutList[4]')).toBe(true);
    expect(
      indexChanges([{ path: 'cutList[10].length', before: 1, after: 2 }]).under('cutList[1]'),
    ).toBe(false);
  });

  it('lists saved items an array no longer has, and not new ones', () => {
    expect(changes.removed('cutList')).toEqual([{ name: 'Gusset' }]);
    expect(changes.removed('hardware')).toEqual([]);
  });
});
