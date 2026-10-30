// Element IDs that links between the plan's sections move focus to (#156).

/** The element ID of a part's cut detail, so a cutting step can open it (#58). */
export const cutDetailId = (partId: string) => `cut-detail-${partId}`;

/** The heading of a part's cut detail, which a link to the part in the drawings focuses (#156). */
export const cutDetailHeadingId = (partId: string) => `${cutDetailId(partId)}-heading`;

/** A part's name in the cut list, which a link to the part in the cut list focuses (#156). */
export const cutListPartId = (partId: string) => `cut-list-part-${partId}`;

/** The structural review's expert checks, which the summary's flags open (#156). */
export const EXPERT_CHECKS_ID = 'expert-checks';
