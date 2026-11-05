import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { diff } from '../../snapshot/diff.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { workbench } from './definition.ts';
import v1 from './snapshots/v1.json' with { type: 'json' };
import v2 from './snapshots/v2.json' with { type: 'json' };

// What each template version changed in the worked examples (decision 0008). Each version's
// fixture and the one before it are read through the upgrades to the current shape, so their
// difference is only what that version changed.

const template = workbench as TemplateDefinition;

/** A fixture's outputs in the current shape. */
function outputs(fixture: readonly unknown[]): unknown[] {
  return fixture.map((stored) => {
    const read = readSnapshot([template], stored);
    if (!read.ok) throw new Error(JSON.stringify(read));
    return JSON.parse(JSON.stringify(read.snapshot.outputs));
  });
}

describe('workbench template versions', () => {
  it('version 2 plans the fewest feet of each stock, and says whether it is proven (#686)', () => {
    const before = outputs(v1);
    const after = outputs(v2);
    for (const [i, now] of after.entries()) {
      const { changes, truncated } = diff(before[i], now, 5000);
      expect(truncated).toBe(false);
      expect(changes.every((c) => c.path.startsWith('lumber.'))).toBe(true);
    }
    // Hand-checked in lists.test.ts: the board stock goes from 386 ft to 376 ft.
    const feet = (o: unknown) =>
      (o as { lumber: { boards: { feet: number }[] } }).lumber.boards.reduce(
        (sum, b) => sum + b.feet,
        0,
      );
    expect(feet(before[0]) - feet(after[0])).toBe(10);
    for (const [i, o] of after.entries()) expect(feet(o)).toBeLessThanOrEqual(feet(before[i]));
  });
});
