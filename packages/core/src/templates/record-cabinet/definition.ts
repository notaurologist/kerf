import type { TemplateDefinition } from '../../model/definition.ts';
import { cutList } from '../../outputs/cutList.ts';
import { hardwareList } from '../../outputs/hardwareList.ts';
import type { KeyResult } from '../../outputs/plan.ts';
import { planLumber } from '../../outputs/shoppingList.ts';
import { formatLength } from '../../units/length.ts';
import { cabinetExplode, cabinetScene, drawings, VIEW } from './drawings.ts';
import { EXAMPLES } from './examples.ts';
import { RECORD_CABINET_FORM } from './form.ts';
import { RecordCabinetOutputs } from './outputs.ts';
import { RecordCabinetParams } from './params.ts';
import { stepOutline } from './steps.ts';
import { RecordCabinetStructuralInputs, structuralReview } from './structural.ts';
import { generate, TEMPLATE_ID, TEMPLATE_VERSION } from './template.ts';

/** What says most about the cabinet at a glance: its size, and each bay's clear opening. */
function keyResults(outputs: RecordCabinetOutputs): KeyResult[] {
  const { params: p, geometry: g } = outputs.design;
  return [
    {
      label: 'Overall',
      value: `${formatLength(p.width)} wide, ${formatLength(p.height)} high, ${formatLength(g.topDepth)} deep`,
    },
    {
      label: `Each of ${p.bays} bays`,
      value: `${formatLength(g.bayWidth)} wide, ${formatLength(g.bayHeight)} high`,
    },
  ];
}

export const recordCabinet: TemplateDefinition<
  RecordCabinetParams,
  RecordCabinetStructuralInputs,
  RecordCabinetOutputs
> = {
  id: TEMPLATE_ID,
  version: TEMPLATE_VERSION,
  name: 'Record cabinet',
  ownWords: ['turntable', 'partition', 'partitions', 'jacket'],
  params: RecordCabinetParams,
  structuralInputs: RecordCabinetStructuralInputs,
  outputs: RecordCabinetOutputs,
  storedOutputs: RecordCabinetOutputs,
  form: RECORD_CABINET_FORM,
  snapshotVersion: 1,
  snapshotUpgrades: {},
  examples: EXAMPLES,
  steps: (outputs) => stepOutline(outputs.design),
  plan(outputs) {
    const { review, design } = outputs;
    return {
      keyResults: keyResults(outputs),
      cutList: outputs.cutList,
      lumber: outputs.lumber,
      hardware: outputs.hardware,
      hardwareNotes: design.hardwareNotes,
      flags: review.flags,
      checks: [
        review.shelf.deflection,
        review.topTurntable.deflection,
        ...(review.topSpeaker ? [review.topSpeaker.deflection] : []),
      ],
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
    scene: cabinetScene(outputs),
    view: VIEW,
    explode: cabinetExplode(outputs),
  }),
  generate(params, structuralInputs) {
    const design = generate(params);
    if (!design.ok) return design;
    const review = structuralReview(params, design.output.geometry, structuralInputs);
    return {
      ok: true,
      output: {
        design: design.output,
        cutList: cutList(design.output.parts),
        lumber: planLumber(design.output.parts),
        hardware: hardwareList(design.output.hardware),
        review,
      },
    };
  },
};
