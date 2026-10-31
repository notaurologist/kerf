import { BOARD_GUIDES } from '../knowledge/boardSelection.ts';
import { findTerms, GLOSSARY, type GlossaryEntry } from '../knowledge/glossary.ts';
import type { Plan } from '../outputs/plan.ts';
import type { BuildStep } from './build.ts';

// The glossary terms a plan uses, for the printed plan, where a term's popover cannot open
// (#180). Found in the same text the screens mark (docs/design/content.md, Definitions): flags,
// check names and load cases, the checklist, the cut list's end cuts, the shopping list's notes
// and board selection guides, and each chosen method's setup, technique, and common mistakes.

type PlanWithText = Pick<
  Plan,
  'flags' | 'checks' | 'checklist' | 'cutList' | 'lumber' | 'hardwareNotes'
>;

/** The plan's text that can use glossary terms. */
export function planText(plan: PlanWithText, steps: readonly BuildStep[]): string[] {
  const guides = new Set(plan.lumber.selection.flatMap((s) => s.guides));
  return [
    ...plan.flags.flatMap((f) => [f.ask, f.why]),
    ...plan.checks.flatMap((c) => [`${c.title}: ${c.subject}`, c.loadCase]),
    ...plan.checklist.flatMap((item) => [item.confirm, item.why]),
    ...plan.cutList.flatMap((row) => row.ends),
    ...plan.lumber.notes,
    ...BOARD_GUIDES.filter((g) => guides.has(g.id)).flatMap((g) =>
      g.checks.flatMap((c) => [c.look, c.why]),
    ),
    ...plan.hardwareNotes,
    ...steps.flatMap((step) => [
      ...step.flags.flatMap((f) => [f.ask, f.why]),
      ...step.operations.flatMap((op) =>
        op.method ? [...op.method.setup, ...op.method.technique, ...op.method.mistakes] : [],
      ),
    ]),
  ];
}

/**
 * Every glossary entry whose term appears in the plan's text, or in `more` (the screens' own
 * words, such as section intros), in the glossary's order.
 */
export function planTerms(
  plan: PlanWithText,
  steps: readonly BuildStep[],
  more: readonly string[] = [],
): GlossaryEntry[] {
  const text = [...planText(plan, steps), ...more];
  const used = new Set(text.flatMap((t) => findTerms(t).map((u) => u.id)));
  return GLOSSARY.filter((e) => used.has(e.id));
}
