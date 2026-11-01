import type { SnapshotUpgrade, TemplateDefinition } from '../../model/definition.ts';
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
import { CABINET_QUESTIONS } from './questions.ts';
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

type Stored = Record<string, unknown>;

/**
 * Shape 1 to 2: plans made before template version 2 took nothing off a glued-up panel for
 * flattening, so their allowance is 0, and each flatten operation brings its panel to the
 * panel's own thickness. Nothing is recomputed.
 */
const addFlattening: SnapshotUpgrade = (snapshot) => {
  const flat = (allowances: unknown) => ({ ...(allowances as Stored), flatten: 0 });
  const withFlat = (params: Stored) => ({ ...params, allowances: flat(params.allowances) });
  const outputs = snapshot.outputs as {
    design: { params: Stored; parts: { id: string; stock: Stored }[]; operations: Stored[] };
  };
  const { design } = outputs;
  const thickness = new Map(design.parts.map((part) => [part.id, part.stock.thickness]));
  return {
    ...snapshot,
    params: withFlat(snapshot.params as Stored),
    outputs: {
      ...outputs,
      design: {
        ...design,
        params: withFlat(design.params),
        parts: design.parts.map((part) =>
          'allowances' in part.stock
            ? { ...part, stock: { ...part.stock, allowances: flat(part.stock.allowances) } }
            : part,
        ),
        operations: design.operations.map((op) =>
          op.type === 'flatten' ? { ...op, thickness: thickness.get(op.partId as string) } : op,
        ),
      },
    },
  };
};

/**
 * Shape 2 to 3: each cut list row's panel records how many boards it takes, which its part's
 * stock already holds. Nothing is recomputed.
 */
const addPanelBoards: SnapshotUpgrade = (snapshot) => {
  const outputs = snapshot.outputs as {
    design: { parts: { id: string; stock: Stored }[] };
    cutList: { partId: string; panel?: Stored }[];
  };
  const boards = new Map(outputs.design.parts.map((part) => [part.id, part.stock.boards]));
  return {
    ...snapshot,
    outputs: {
      ...outputs,
      cutList: outputs.cutList.map((row) =>
        row.panel ? { ...row, panel: { ...row.panel, boards: boards.get(row.partId) } } : row,
      ),
    },
  };
};

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
  snapshotVersion: 4,
  // Shape 3 to 4 adds assembly and finish operations, which older plans simply do not have.
  snapshotUpgrades: { 1: addFlattening, 2: addPanelBoards, 3: (snapshot) => snapshot },
  examples: EXAMPLES,
  questions: CABINET_QUESTIONS,
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
