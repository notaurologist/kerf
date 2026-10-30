import { findTerms, GLOSSARY, type GlossaryEntry } from '../knowledge/glossary.ts';
import type { Plan } from '../outputs/plan.ts';
import type { BuildStep } from './build.ts';

// The glossary terms a plan uses, for the printed plan, where a term's popover cannot open
// (#180). Found in the same text the screens mark: flags, the cut list's end cuts, and each
// chosen method's setup, technique, and common mistakes (docs/design/content.md, Definitions).

/** The plan's text that can use glossary terms. */
export function planText(
  plan: Pick<Plan, 'flags' | 'cutList'>,
  steps: readonly BuildStep[],
): string[] {
  return [
    ...plan.flags.flatMap((f) => [f.ask, f.why]),
    ...plan.cutList.flatMap((row) => row.ends),
    ...steps.flatMap((step) => [
      ...step.flags.flatMap((f) => [f.ask, f.why]),
      ...step.operations.flatMap((op) =>
        op.method ? [...op.method.setup, ...op.method.technique, ...op.method.mistakes] : [],
      ),
    ]),
  ];
}

/** Every glossary entry whose term appears in the plan's text, in the glossary's order. */
export function planTerms(
  plan: Pick<Plan, 'flags' | 'cutList'>,
  steps: readonly BuildStep[],
): GlossaryEntry[] {
  const used = new Set(planText(plan, steps).flatMap((t) => findTerms(t).map((u) => u.id)));
  return GLOSSARY.filter((e) => used.has(e.id));
}
