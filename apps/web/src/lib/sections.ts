// The plan's sections in order A (#40): the contents, the screens, and the printed order. There is
// no summary (#356): the project's header carries what it led with. The values used are in Edit
// and printed after the sections. Each section has its own address, `#/projects/<id>/<section>`
// (#147, #156), so no ID may be one a mode or the editor uses (`edit`, `shop`, `build`). `shop`
// marks the sections the printed shop set holds (#469); the whole plan prints every section.

export const PLAN_SECTIONS = [
  { id: 'diagrams', title: 'Diagrams', shop: false },
  { id: 'structural-review', title: 'Structural review', shop: false },
  { id: 'cut-list', title: 'Cut list', shop: true },
  { id: 'boards', title: 'Boards', shop: true },
  { id: 'shopping-list', title: 'Shopping list', shop: false },
  { id: 'build-steps', title: 'Build steps', shop: true },
] as const;

export type PlanSectionId = (typeof PLAN_SECTIONS)[number]['id'];

export function isPlanSection(slug: string | undefined | null): slug is PlanSectionId {
  return PLAN_SECTIONS.some((s) => s.id === slug);
}
