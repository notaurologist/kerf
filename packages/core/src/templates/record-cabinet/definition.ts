import type { SnapshotUpgrade, TemplateDefinition } from '../../model/definition.ts';
import { cutList, withSettings } from '../../outputs/cutList.ts';
import { hardwareList } from '../../outputs/hardwareList.ts';
import { planLumber } from '../../outputs/shoppingList.ts';
import { cabinetExplode, cabinetScene, drawings, VIEW } from './drawings.ts';
import { EXAMPLES } from './examples.ts';
import { RECORD_CABINET_FORM } from './form.ts';
import { cabinetGeometry } from './geometry.ts';
import { RecordCabinetOutputs, StoredRecordCabinetOutputs } from './outputs.ts';
import { RecordCabinetParams } from './params.ts';
import { CABINET_QUESTIONS, SUGGESTED_DOOR } from './questions.ts';
import { stepOutline } from './steps.ts';
import { allowancesFor, RecordCabinetStructuralInputs, structuralReview } from './structural.ts';
import { generate, TEMPLATE_ID, TEMPLATE_VERSION } from './template.ts';

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

/** Shape 4 to 5: every board before template version 5 came from a store, in fixed widths. */
const addBoardSource: SnapshotUpgrade = (snapshot) => {
  const fromStore = (params: Stored) => ({
    ...params,
    board: { source: 'store', ...(params.board as Stored) },
  });
  const outputs = snapshot.outputs as { design: { params: Stored } };
  return {
    ...snapshot,
    params: fromStore(snapshot.params as Stored),
    outputs: {
      ...outputs,
      design: { ...outputs.design, params: fromStore(outputs.design.params) },
    },
  };
};

/**
 * Shape 6 to 7: the turntable and speaker become the largest item on the top and the weight on it
 * (#331). The turntable was the largest item in every stored plan's layout, the weight is what
 * stood on the top (the speaker's only when it was there), and the turntable's check is the top's.
 */
const toTopItem: SnapshotUpgrade = (snapshot) => {
  type Old = Stored & {
    turntable: { width: number; depth: number; lidHeight: number };
    speaker: { place: unknown };
  };
  const params = (old: Old) => {
    const { turntable, speaker: _, ...rest } = old;
    return {
      ...rest,
      topItem: { width: turntable.width, depth: turntable.depth, height: turntable.lidHeight },
    };
  };
  const old = snapshot.params as Old;
  const { turntableWeight, speakerWeight, ...inputs } = snapshot.structuralInputs as Stored & {
    turntableWeight?: number;
    speakerWeight?: number;
  };
  const onTop = old.speaker.place === 'top';
  const topLoad =
    turntableWeight === undefined || (onTop && speakerWeight === undefined)
      ? undefined
      : turntableWeight + (onTop ? (speakerWeight as number) : 0);
  const outputs = snapshot.outputs as {
    design: { params: Old };
    review: Stored & { topTurntable: unknown };
  };
  const { topTurntable, topSpeaker: _speaker, ...review } = outputs.review;
  return {
    ...snapshot,
    params: params(old),
    structuralInputs: { ...inputs, ...(topLoad === undefined ? {} : { topLoad }) },
    outputs: {
      ...outputs,
      design: { ...outputs.design, params: params(outputs.design.params) },
      review: { ...review, top: topTurntable },
    },
  };
};

/**
 * Shape 7 to 8: the leg base (#338). A stored plan keeps its parts, drawings, and numbers as they
 * were; its bay height carries over, and its base height and overall height are its shelf height
 * and height. The base's new parameters, which an older plan never had, take the values the
 * starting questions suggest, so the editor shows them if the owner regenerates. Its shelf's
 * check becomes the slot the aprons' check now fills.
 */
const toLegBase: SnapshotUpgrade = (snapshot) => {
  type Old = Stored & {
    height: number;
    shelfHeight: number;
    board: { source: string; thickness?: number; surfaced?: number };
  };
  const old = snapshot.params as Old;
  const outputs = snapshot.outputs as {
    design: { params: Old; geometry: Stored & { bayHeight: number; shelfLength: number } };
    review: Stored & { shelf: unknown };
  };
  const { shelfLength, ...geometry } = outputs.design.geometry;
  const params = (o: Old) => {
    const { height: _, shelfHeight: __, cutoutHeight: ___, footWidth: ____, ...rest } = o;
    const board = o.board.source === 'store' ? (o.board.thickness ?? 0) : (o.board.surfaced ?? 0);
    return {
      ...rest,
      bayHeight: geometry.bayHeight,
      legShowing: 5,
      apronHeight: 2.5,
      legStock: { size: 1.5, lengths: [3, 4] },
      footSize: 1,
      apronSetback: 0.125,
      tenonThickness: Math.floor((board / 3) * 16) / 16,
      tenonLength: 1,
    };
  };
  const { shelf, ...review } = outputs.review;
  return {
    ...snapshot,
    params: params(old),
    outputs: {
      ...outputs,
      design: {
        ...outputs.design,
        params: params(outputs.design.params),
        geometry: {
          ...geometry,
          baseHeight: old.shelfHeight,
          height: old.height,
          railLength: shelfLength,
        },
      },
      review: { ...review, apron: shelf },
    },
  };
};

/**
 * Shape 8 to 9: sliding doors (#339). A stored plan has no doors, and keeps its parts, drawings,
 * and numbers as they were. The doors' parameters, which an older plan never had, take the values
 * the starting questions suggest, so the editor shows them if the owner turns the doors on.
 */
const toDoors: SnapshotUpgrade = (snapshot) => {
  const params = (o: unknown) => ({ ...(o as Stored), doors: 'none', door: { ...SUGGESTED_DOOR } });
  const outputs = snapshot.outputs as { design: { params: Stored } };
  return {
    ...snapshot,
    params: params(snapshot.params),
    outputs: { ...outputs, design: { ...outputs.design, params: params(outputs.design.params) } },
  };
};

export const recordCabinet: TemplateDefinition<
  RecordCabinetParams,
  RecordCabinetStructuralInputs,
  StoredRecordCabinetOutputs,
  RecordCabinetOutputs
> = {
  id: TEMPLATE_ID,
  version: TEMPLATE_VERSION,
  name: 'Record cabinet',
  description:
    'A low cabinet of glued-up solid-wood panels, with bays for records and room on the top for a turntable.',
  ownWords: [
    'cabinet',
    'cabinets',
    'partition',
    'partitions',
    'bay',
    'bays',
    'door',
    'doors',
    'jacket',
    'jackets',
    'turntable',
    'turntables',
    'speaker',
    'speakers',
  ],
  params: RecordCabinetParams,
  structuralInputs: RecordCabinetStructuralInputs,
  outputs: RecordCabinetOutputs,
  storedOutputs: StoredRecordCabinetOutputs,
  form: RECORD_CABINET_FORM,
  snapshotVersion: 9,
  // Shape 3 to 4 adds assembly and finish operations, which older plans simply do not have.
  snapshotUpgrades: {
    1: addFlattening,
    2: addPanelBoards,
    3: (snapshot) => snapshot,
    4: addBoardSource,
    // Shape 5 to 6 adds the operation that lets the lumber settle, which older plans do not have.
    5: (snapshot) => snapshot,
    6: toTopItem,
    7: toLegBase,
    8: toDoors,
  },
  examples: EXAMPLES,
  questions: CABINET_QUESTIONS,
  steps: (outputs) => stepOutline(outputs.design),
  plan(outputs) {
    const { review, design } = outputs;
    return {
      cutList: withSettings(outputs.cutList, design.parts),
      lumber: outputs.lumber,
      hardware: outputs.hardware,
      hardwareNotes: design.hardwareNotes,
      flags: review.flags,
      checks: [review.apron.deflection, review.top.deflection],
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
    const design = generate(
      params,
      allowancesFor(params, cabinetGeometry(params), structuralInputs),
    );
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
