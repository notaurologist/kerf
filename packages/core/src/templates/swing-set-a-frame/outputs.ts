import { z } from 'zod';
import { ChecklistItem, EndCut, Flag, HardwareItem, Part } from '../../model/types.ts';
import { CutListRow } from '../../outputs/cutList.ts';
import { HardwareLine } from '../../outputs/hardwareList.ts';
import { LumberPlan } from '../../outputs/shoppingList.ts';
import { SwingSetStructuralReview } from './structural.ts';
import { SwingSetOutput } from './template.ts';

/** Everything a swing-set project snapshot holds besides its parameters and inputs. */
export const SwingSetOutputs = z.object({
  design: SwingSetOutput,
  cutList: z.array(CutListRow),
  lumber: LumberPlan,
  hardware: z.array(HardwareLine),
  structuralReview: SwingSetStructuralReview,
});
export type SwingSetOutputs = z.infer<typeof SwingSetOutputs>;

// What a stored swing-set snapshot holds once upgraded to the current shape (decision 0014). The
// generic fields below came after the first shape, and the upgrades leave them out rather than
// guess: each end cut's reference and each part's reference edge, holes, bolt areas, and tapers
// (shape 4); each part's board selection guides and the lumber plan's copy of them (shape 7); the
// parts and hardware each flag and checklist item concerns (shape 10); each hardware item's store
// group (shape 12). `plan`, `drawings`, and `assembly` fill in what generic code needs.

const StoredEndCut = EndCut.partial({ measuredFrom: true });
const StoredPart = Part.extend({ ends: z.tuple([StoredEndCut, StoredEndCut]) }).partial({
  selection: true,
  referenceEdge: true,
  holes: true,
  boltAreas: true,
  tapers: true,
});
export type StoredPart = z.infer<typeof StoredPart>;
const StoredFlag = Flag.partial({ partIds: true, hardwareIds: true });
const StoredChecklistItem = ChecklistItem.partial({ partIds: true, hardwareIds: true });

export const StoredSwingSetOutputs = SwingSetOutputs.extend({
  design: SwingSetOutput.extend({
    parts: z.array(StoredPart),
    hardware: z.array(HardwareItem.partial({ group: true })),
    flags: z.array(StoredFlag),
  }),
  lumber: LumberPlan.partial({ selection: true }),
  structuralReview: SwingSetStructuralReview.extend({
    checklist: z.array(StoredChecklistItem),
  }),
});
export type StoredSwingSetOutputs = z.infer<typeof StoredSwingSetOutputs>;

/**
 * A stored part as the generic drawings take it. A plan stored before shape 4 recorded no holes,
 * bolt areas, or tapers, so it draws none; it did not name the reference edge, so the drawing
 * says "the reference edge"; and every end cut the swing set has made is a miter, drawn on the
 * face and measured from the reference edge.
 */
export function drawnPart(part: StoredPart): Part {
  const end = (cut: z.infer<typeof StoredEndCut>): EndCut => ({
    ...cut,
    measuredFrom: cut.measuredFrom ?? 'reference-edge',
  });
  return {
    ...part,
    ends: [end(part.ends[0]), end(part.ends[1])],
    selection: part.selection ?? [],
    referenceEdge: part.referenceEdge ?? 'reference edge',
    holes: part.holes ?? [],
    boltAreas: part.boltAreas ?? [],
    tapers: part.tapers ?? [],
  };
}

/** A stored flag or checklist item, concerning the whole design when the plan did not say. */
export function withConcerns<T extends { partIds?: string[]; hardwareIds?: string[] }>(
  item: T,
): T & { partIds: string[]; hardwareIds: string[] } {
  return { ...item, partIds: item.partIds ?? [], hardwareIds: item.hardwareIds ?? [] };
}
