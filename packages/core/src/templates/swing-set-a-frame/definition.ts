import { NOMINAL_SIZES } from '../../lumber/stock.ts';
import type { SnapshotUpgrade, TemplateDefinition } from '../../model/definition.ts';
import { withLetters } from '../../model/letters.ts';
import type { GenerateResult } from '../../model/types.ts';
import { cutList, withSettings } from '../../outputs/cutList.ts';
import { hardwareList } from '../../outputs/hardwareList.ts';
import { DEFAULT_BOARD_OPTIONS, planLumber } from '../../outputs/shoppingList.ts';
import { withStockAlternatives } from '../../outputs/stockAlternatives.ts';
import { noSuggestions } from '../../snapshot/snapshot.ts';
import { withDeeperStock } from './deeperStock.ts';
import { assembly, drawings } from './drawings.ts';
import { EXAMPLES } from './examples.ts';
import { SWING_SET_FORM } from './form.ts';
import { StoredSwingSetOutputs, SwingSetOutputs, withConcerns } from './outputs.ts';
import { SwingSetParams } from './params.ts';
import { SWING_SET_QUESTIONS } from './questions.ts';
import { stepOutline } from './steps.ts';
import { STORE_READINGS } from './storeReadings.ts';
import {
  checkFields,
  SwingSetStructuralInputs,
  type SwingSetStructuralReview,
  structuralReview,
} from './structural.ts';
import { generate, TEMPLATE_ID, TEMPLATE_VERSION } from './template.ts';

/**
 * Shape 4 to 5: letters each stored part and its cut-list row by position. The cut list is made
 * from the parts in order, so row i is part i and gets the same letter a regeneration would give.
 */
const addPartLetters: SnapshotUpgrade = (snapshot) => {
  const outputs = snapshot.outputs as {
    design: { parts: object[] };
    cutList: object[];
  };
  return {
    ...snapshot,
    outputs: {
      ...outputs,
      design: { ...outputs.design, parts: withLetters(outputs.design.parts) },
      cutList: withLetters(outputs.cutList),
    },
  };
};

/**
 * Shape 10 to 11: stores the saw cut and end trim the boards were planned with. Every plan before
 * shape 11 was planned with the defaults (1/8" kerf, 1/2" trim per end), unchanged since M1.
 */
const addBoardAllowances: SnapshotUpgrade = (snapshot) => {
  const outputs = snapshot.outputs as { lumber: object };
  return {
    ...snapshot,
    outputs: {
      ...outputs,
      lumber: {
        ...outputs.lumber,
        kerf: DEFAULT_BOARD_OPTIONS.kerf,
        trimPerEnd: DEFAULT_BOARD_OPTIONS.trimPerEnd,
      },
    },
  };
};

/**
 * Shape 8 to 9: plans made before template version 9 drilled each bolt hole at the bolt's own
 * diameter, so each hole's bolt diameter is its diameter, and each bolt-hole operation's hole
 * diameter is its bolt diameter. Nothing is recomputed.
 */
const addHoleSizes: SnapshotUpgrade = (snapshot) => {
  type Stored = Record<string, unknown>;
  const outputs = snapshot.outputs as { design: { parts: Stored[]; operations?: Stored[] } };
  const { design } = outputs;
  return {
    ...snapshot,
    outputs: {
      ...outputs,
      design: {
        ...design,
        parts: design.parts.map((part) =>
          Array.isArray(part.holes)
            ? {
                ...part,
                holes: (part.holes as Stored[]).map((h) => ({ ...h, boltDiameter: h.diameter })),
              }
            : part,
        ),
        ...(design.operations
          ? {
              operations: design.operations.map((op) =>
                op.type === 'bolt-holes' ? { ...op, holeDiameter: op.boltDiameter } : op,
              ),
            }
          : {}),
      },
    },
  };
};

/** The beam's and hanger's checks, which the beam's other stock sizes are offered against. */
function beamChecks(review: Pick<SwingSetStructuralReview, 'beam' | 'hanger'>) {
  return [review.beam.bending, review.beam.shear, review.beam.deflection, review.hanger];
}

/** The plan's checks, in the order the structural review lists them. */
function reviewChecks(review: Pick<SwingSetStructuralReview, 'beam' | 'hanger' | 'legs'>) {
  return [...beamChecks(review), ...(review.legs ? [review.legs] : [])];
}

/** Everything but each line's other stock sizes, which take this to work out. */
function outputsFor(
  params: SwingSetParams,
  structuralInputs: SwingSetStructuralInputs,
): GenerateResult<SwingSetOutputs> {
  const design = generate(params);
  if (!design.ok) return design;
  const review = structuralReview(design.output, structuralInputs);
  if (!review.ok) return review;
  return {
    ok: true,
    output: {
      design: design.output,
      cutList: cutList(design.output.parts),
      lumber: planLumber(design.output.parts),
      hardware: hardwareList(design.output.hardware),
      structuralReview: review.review,
    },
  };
}

/**
 * The stock parameters whose other sizes the plan can give a margin for (#450): only the beam's.
 * The beam checks read the legs' and gussets' sizes too, through the span, but say nothing of
 * whether those parts are strong enough, so they get no other size. The legs' check reads the
 * beam's size through its weight and width but says nothing of the beam, so the beam's other sizes
 * are offered against the beam's and hanger's checks alone.
 */
function stockFields(params: SwingSetParams) {
  return [
    {
      path: 'beamStock',
      name: params.beamPlies > 1 ? 'Beam plies' : 'Beam',
      partIds: ['beam'],
      current: params.beamStock,
      options: NOMINAL_SIZES,
    },
  ];
}

export const swingSetAFrame: TemplateDefinition<
  SwingSetParams,
  SwingSetStructuralInputs,
  StoredSwingSetOutputs,
  SwingSetOutputs
> = {
  id: TEMPLATE_ID,
  version: TEMPLATE_VERSION,
  name: 'Two-swing A-frame swing set',
  description:
    'A backyard swing set for two swings: a beam on two A-frames of splayed legs, buried or on pads.',
  ownWords: ['swing', 'swings', 'crossbar', 'crossbars', 'hanger', 'hangers', 'a-frame', 'cpsc'],
  params: SwingSetParams,
  storedParams: SwingSetParams,
  structuralInputs: SwingSetStructuralInputs,
  outputs: SwingSetOutputs,
  storedOutputs: StoredSwingSetOutputs,
  form: SWING_SET_FORM,
  checkFields,
  // One fixture per stored shape, snapshots/v<n>.json (decision 0014). Shape 2 adds sources to
  // the hanger check's inputs (#36). Shape 3 adds part placements (#49). Shape 4 adds holes,
  // bolt areas, tapers, reference edges, and each end cut's reference (#50). Those fields are
  // optional, so plans stored before them read as they are and keep their numbers. Shape 5 adds
  // part letters (#66), derived from the stored order of the parts, which is the cut-list order.
  // Shape 6 adds the bolt layout and each board's distance past the legs (#93); both optional.
  // Shape 7 adds each part's board selection guides and the lumber plan's copy of them (#53);
  // both optional. Shape 8 adds operations (#103), optional. Shape 9 adds each hole's bolt diameter
  // and each bolt-hole operation's hole diameter (#110); reading an older plan sets both to the
  // size it drilled, its bolt's diameter. Shape 10 adds the parts and hardware each flag and
  // checklist item concerns (#51), optional: a plan stored before it keeps its flags on the plan.
  // Shape 11 adds the board plan's kerf and end trim (#58); reading an older plan sets the defaults
  // every plan was made with. Shape 12 adds each hardware item's and line's store group (#59),
  // optional: a plan stored before it shows its hardware as one group. Shape 13 adds each part's
  // dadoes, notches, and cutouts (#300), optional: a swing set has none, so an older part reads as
  // having none. Shape 14 adds the dynamic factor at which each strength check reaches margin 1.0
  // (#401), optional. Shape 15 lets a hardware item and line wait for their quantity (#406): an
  // optional quantity and the input it waits for. Every stored plan has its quantities. Shape 16
  // leaves out each part list that is empty (#430); reading fills it back in, so older shapes
  // read unchanged. Shape 17 adds the project's suggested values (#417); every older plan's
  // values were entered, so it reads with none. Shape 18 adds a check's results in the next deeper
  // stock (#466), optional. Shape 19 adds the legs' species, grade, and incising as structural
  // inputs and the legs' column check to the review (#468), both optional: a plan stored before it
  // has neither, and its review lists the checks it was made with.
  snapshotVersion: 19,
  snapshotUpgrades: {
    1: (snapshot) => snapshot,
    2: (snapshot) => snapshot,
    3: (snapshot) => snapshot,
    4: addPartLetters,
    5: (snapshot) => snapshot,
    6: (snapshot) => snapshot,
    7: (snapshot) => snapshot,
    8: addHoleSizes,
    9: (snapshot) => snapshot,
    10: addBoardAllowances,
    11: (snapshot) => snapshot,
    12: (snapshot) => snapshot,
    13: (snapshot) => snapshot,
    14: (snapshot) => snapshot,
    15: (snapshot) => snapshot,
    16: noSuggestions,
    17: (snapshot) => snapshot,
    18: (snapshot) => snapshot,
  },
  examples: EXAMPLES,
  questions: SWING_SET_QUESTIONS,
  storeReadings: STORE_READINGS,
  steps: (outputs) => stepOutline(outputs.design),
  plan(outputs) {
    const review = outputs.structuralReview;
    return {
      cutList: withSettings(outputs.cutList, outputs.design.parts),
      lumber: { ...outputs.lumber, selection: outputs.lumber.selection ?? [] },
      hardware: outputs.hardware,
      hardwareNotes: outputs.design.hardwareNotes,
      flags: outputs.design.flags.map(withConcerns),
      checks: reviewChecks(review),
      movement: [],
      checklist: review.checklist.map(withConcerns),
      boltLayout: outputs.design.boltLayout ?? [],
      operations: outputs.design.operations ?? [],
      cutEnds: outputs.design.parts.map((part) => ({
        partId: part.id,
        ...(part.referenceEdge ? { referenceEdge: part.referenceEdge } : {}),
        ends: part.ends.map(({ description, measuredFrom }) => ({
          description,
          ...(measuredFrom ? { measuredFrom } : {}),
        })),
      })),
    };
  },
  drawings,
  assembly,
  generate(params, structuralInputs) {
    const made = outputsFor(params, structuralInputs);
    if (!made.ok) return made;
    const lumber = withStockAlternatives(
      made.output.lumber,
      beamChecks(made.output.structuralReview),
      stockFields(params),
      checkFields,
      (path, nominal) => {
        const other = outputsFor({ ...params, [path]: nominal }, structuralInputs);
        return other.ok ? beamChecks(other.output.structuralReview) : null;
      },
    );
    const review = withDeeperStock(made.output.structuralReview, params, structuralInputs);
    return { ok: true, output: { ...made.output, lumber, structuralReview: review } };
  },
};
