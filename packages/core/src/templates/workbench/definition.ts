import type { TemplateDefinition } from '../../model/definition.ts';
import { cutList, withSettings } from '../../outputs/cutList.ts';
import { hardwareList } from '../../outputs/hardwareList.ts';
import { planLumber } from '../../outputs/shoppingList.ts';
import { benchExplode, benchScene, benchSubAssemblies, drawings, VIEW } from './drawings.ts';
import { EXAMPLES } from './examples.ts';
import { WORKBENCH_FORM } from './form.ts';
import { WorkbenchOutputs } from './outputs.ts';
import { WorkbenchParams } from './params.ts';
import { WORKBENCH_QUESTIONS } from './questions.ts';
import { stepOutline } from './steps.ts';
import { checkFields, WorkbenchStructuralInputs } from './structural.ts';
import { generate, TEMPLATE_ID, TEMPLATE_VERSION } from './template.ts';

export const workbench: TemplateDefinition<
  WorkbenchParams,
  WorkbenchStructuralInputs,
  WorkbenchOutputs,
  WorkbenchOutputs
> = {
  id: TEMPLATE_ID,
  version: TEMPLATE_VERSION,
  name: 'Workbench',
  description:
    'A hardwood bench with a face vise and an end vise, its legs tenoned through a thick top, and a case of drawers and doors between them.',
  ownWords: ['workbench', 'workbenches'],
  params: WorkbenchParams,
  storedParams: WorkbenchParams,
  structuralInputs: WorkbenchStructuralInputs,
  outputs: WorkbenchOutputs,
  storedOutputs: WorkbenchOutputs,
  form: WORKBENCH_FORM,
  checkFields,
  snapshotVersion: 1,
  snapshotUpgrades: {},
  examples: EXAMPLES,
  questions: WORKBENCH_QUESTIONS,
  steps: (outputs) => stepOutline(outputs.design),
  plan(outputs) {
    const { review, design } = outputs;
    return {
      cutList: withSettings(outputs.cutList, design.parts),
      lumber: outputs.lumber,
      hardware: outputs.hardware,
      hardwareNotes: design.hardwareNotes,
      flags: review.flags,
      checks: [review.top.deflection],
      movement: review.movement,
      checklist: review.checklist,
      boltLayout: [],
      operations: design.operations,
      cutEnds: design.parts.map((part) => ({
        partId: part.id,
        referenceEdge: part.referenceEdge,
        ends: part.ends.map(({ description, measuredFrom }) => ({ description, measuredFrom })),
      })),
    };
  },
  drawings,
  assembly: (outputs) => ({
    scene: benchScene(outputs),
    view: VIEW,
    explode: benchExplode(outputs),
    subAssemblies: benchSubAssemblies(outputs),
  }),
  generate(params, structuralInputs) {
    const made = generate(params, structuralInputs);
    if (!made.ok) return made;
    const { design, review } = made.output;
    return {
      ok: true,
      output: {
        design,
        cutList: cutList(design.parts),
        lumber: planLumber(design.parts),
        hardware: hardwareList(design.hardware),
        review,
      },
    };
  },
};
