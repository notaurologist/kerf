import type { BuildStep, FilledMethod } from './build.ts';

// The printed shop set prints each method in full the first time it is used for a kind of
// operation, and after that only the lines that differ, such as the count or the blade depth. A
// method's safety lines print on every step that uses it, so they are on the page at the saw, but
// once within the step. The whole plan and Building keep every method in full.

/** How one operation's method compares with what the shop set has already printed. */
export interface MethodRepeat {
  /**
   * The step, from 1, where this method first did this kind of operation and printed in full.
   * Left out at that first use.
   */
  firstStep?: number;
  /** For each line: whether the first use printed it word for word. All false at the first use. */
  setup: boolean[];
  technique: boolean[];
  mistakes: boolean[];
  /** For each safety line: whether an earlier operation in the same step printed it. */
  safety: boolean[];
}

/**
 * For each step's operations, in order, how its method repeats earlier text. An operation with no
 * method has none.
 */
export function methodRepeats(
  steps: readonly Pick<BuildStep, 'operations'>[],
): (MethodRepeat | undefined)[][] {
  const firstUses = new Map<string, { step: number; method: FilledMethod }>();
  return steps.map((step, i) => {
    const safetyInStep = new Set<string>();
    return step.operations.map((op) => {
      const { method } = op;
      if (!method) return undefined;
      const key = JSON.stringify([op.operation.type, method.id]);
      const first = firstUses.get(key);
      if (!first) firstUses.set(key, { step: i + 1, method });
      const printed = (lines: readonly string[], earlier: readonly string[] | undefined) =>
        lines.map((line) => earlier?.includes(line) ?? false);
      const safety = method.safety.map((s) => safetyInStep.has(s.text));
      for (const s of method.safety) safetyInStep.add(s.text);
      return {
        ...(first ? { firstStep: first.step } : {}),
        setup: printed(method.setup, first?.method.setup),
        technique: printed(method.technique, first?.method.technique),
        mistakes: printed(method.mistakes, first?.method.mistakes),
        safety,
      };
    });
  });
}
