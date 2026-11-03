import type { HardwareItem, Part } from '../model/types.ts';

// What field-treating a plan's treated parts needs from the store (DOMAIN.md, Species and
// treatment). The operations come from the parts themselves (model/operations.ts); this is the
// preservative they use. AWPA M4-06 section 7.1 names copper naphthenate for wood treated with
// waterborne preservatives, and boron only for wood off the ground and kept out of liquid water.

/**
 * The preservative for field-treating cuts and bolt holes, in the template's store group, when
 * any part is treated; none otherwise.
 */
export function preservativeFor(parts: readonly Part[], group: string): HardwareItem[] {
  if (!parts.some((p) => p.treated)) return [];
  return [
    {
      id: 'preservative',
      name: 'Wood preservative for cut ends',
      quantity: 1,
      structural: false,
      notes: [
        'For every cut and bolt hole in treated lumber, which IRC 2021 R317.1.1 requires to be treated as AWPA M4 says. Choose one whose label says it is for treating cuts in treated wood.',
        'Copper naphthenate suits any treated lumber; boron is only for wood off the ground and out of the rain (AWPA M4-06, 7.1.1 and 7.1.2). M4-06 recommends at least 2.0% copper as metal, or 1.0% where that is not readily available. The label gives the copper as metal; the percentage of copper naphthenate is a different number.',
      ],
      group,
    },
  ];
}
