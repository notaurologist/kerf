// The plan's sections in order A (#40): the contents, the screens, and the printed order. Each
// section but the summary has its own address, `#/projects/<id>/<section>` (#147, #156), so no ID
// may be one a mode or the editor uses (`edit`, `shop`, `build`).

export const PLAN_SECTIONS = [
  { id: 'summary', title: 'Summary' },
  { id: 'diagrams', title: 'Diagrams' },
  { id: 'structural-review', title: 'Structural review' },
  { id: 'cut-list', title: 'Cut list' },
  { id: 'boards', title: 'Boards' },
  { id: 'shopping-list', title: 'Shopping list' },
  { id: 'build-steps', title: 'Build steps' },
  { id: 'parameters', title: 'Parameters and inputs' },
] as const;

export type PlanSectionId = (typeof PLAN_SECTIONS)[number]['id'];

export function isPlanSection(slug: string | undefined | null): slug is PlanSectionId {
  return PLAN_SECTIONS.some((s) => s.id === slug);
}
