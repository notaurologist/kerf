import type { Inventory } from '../inventory/tools.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import type { Plan } from '../outputs/plan.ts';
import { type BuildSteps, planSteps, type StepOutline } from '../steps/build.ts';
import { projectDrawings } from '../steps/drawings.ts';

/**
 * A small shop's tools, for build steps that use tools. Illustrative values: they pin which method
 * each step chooses and its text, and do not stand for anyone's tools.
 */
const SMALL_SHOP: Inventory = {
  tools: [
    { toolTypeId: 'tape-measure', capabilities: {} },
    { toolTypeId: 'combination-square', capabilities: {} },
    { toolTypeId: 'level', capabilities: {} },
    { toolTypeId: 'miter-saw', capabilities: { crosscutWidth: 12, cutDepth: 3.5, maxMiter: 50 } },
    { toolTypeId: 'circular-saw', capabilities: { depthOfCut: 2.375 } },
    { toolTypeId: 'drill-driver', capabilities: {} },
    { toolTypeId: 'spade-bits', capabilities: { reach: 6 } },
    { toolTypeId: 'clamps', capabilities: { maxOpening: 24 } },
    { toolTypeId: 'chisel', capabilities: {} },
    { toolTypeId: 'sander', capabilities: {} },
  ],
};

/**
 * What reading a stored plan shows that is not stored: core derives it from the stored outputs
 * on every read. Each template's current fixture keeps a copy of it, so a change to how a plan
 * reads fails `pnpm check` the way a change to what it stores does (decision 0014).
 */
export type Shown = {
  plan: Plan;
  outline: StepOutline[];
  steps: { noTools: BuildSteps; smallShop: BuildSteps };
  /** The dimension text of each drawing that has any, by drawing title. */
  dimensions: { drawing: string; text: string[] }[];
};

export function shownOnRead<O>(
  template: Pick<
    TemplateDefinition<unknown, unknown, O>,
    'plan' | 'steps' | 'drawings' | 'assembly'
  >,
  outputs: O,
): Shown {
  const drawings = projectDrawings(template, outputs);
  const all = [
    drawings.isometric,
    drawings.exploded,
    ...drawings.cutDetails,
    drawings.siteLayout,
    ...(drawings.elevations ?? []),
    ...(drawings.boards ?? []),
    ...(drawings.steps ?? []).map((s) => s.drawing),
  ];
  return {
    plan: template.plan(outputs),
    outline: template.steps(outputs),
    steps: {
      noTools: planSteps(template, outputs, { tools: [] }),
      smallShop: planSteps(template, outputs, SMALL_SHOP),
    },
    dimensions: all.flatMap((d) => {
      const text = (d?.primitives ?? []).flatMap((p) =>
        p.kind === 'text' && p.role === 'dimension' ? [p.text] : [],
      );
      return d && text.length > 0 ? [{ drawing: d.title, text }] : [];
    }),
  };
}
