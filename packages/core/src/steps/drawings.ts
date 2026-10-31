import { actionView, boardDrawings, type Drawing, type Drawings } from '../geometry/index.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import { stepContents } from './build.ts';

// Action drawings for Building mode (#118; design Stage 5, "Drawings in Building mode"): one for
// each assembly step, a step whose operations join parts. Each draws only what the step adds,
// pulled away from where it goes with a motion arrow, on everything earlier assembly steps built.
// Cutting steps show their board and site work the site layout, so they get none here. Made on
// read from stored outputs, like the other drawings.

export interface StepDrawing {
  stepId: string;
  drawing: Drawing;
}

export function stepDrawings<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'steps' | 'plan' | 'assembly'>,
  outputs: O,
): StepDrawing[] {
  const views = template.assembly(outputs);
  if (!views) return [];
  const { scene, view, explode } = views;
  const named = (ids: Iterable<string>) =>
    [...ids]
      .map((id) => scene.parts.find((p) => p.id === id))
      .flatMap((p) => (p ? [`${p.letter} ${p.name}`] : []))
      .join(', ');
  const built = new Set<string>();
  const drawings: StepDrawing[] = [];
  for (const step of stepContents(template.steps(outputs), template.plan(outputs))) {
    const joins = step.operations.some((op) => 'partIds' in op && op.partIds.length > 1);
    if (step.board || !joins) continue;
    const parts = [
      ...new Set(
        step.operations.flatMap((op) =>
          'partId' in op ? [op.partId] : 'partIds' in op ? op.partIds : [],
        ),
      ),
    ];
    // What the step adds; a step that only works on parts already built shows them all.
    const fresh = parts.filter((id) => !built.has(id));
    const added = new Set(fresh.length > 0 ? fresh : parts);
    const before = new Set([...built].filter((id) => !added.has(id)));
    const description =
      `Adds ${named(added)}` +
      (before.size > 0 ? `, to ${named(before)} already built` : '') +
      '. A part drawn away from where it goes has an arrow back to it.';
    drawings.push({
      stepId: step.id,
      drawing: actionView(
        scene,
        view,
        { added, built: before, explode },
        description,
        `Step: ${step.title}`,
      ),
    });
    for (const id of added) built.add(id);
  }
  return drawings;
}

/**
 * Every drawing a project shows: the template's own, drawn from stored outputs, then the two that
 * every template's data supports, the board cards' from the board plan (#59) and the assembly
 * steps' action drawings (#118). The outputs must already parse with the template's schema.
 */
export function projectDrawings<O>(
  template: Pick<
    TemplateDefinition<unknown, unknown, O>,
    'drawings' | 'steps' | 'plan' | 'assembly'
  >,
  outputs: O,
): Drawings {
  const plan = template.plan(outputs);
  return {
    ...template.drawings(outputs),
    boards: boardDrawings(plan.lumber, plan.cutList),
    steps: stepDrawings(template, outputs),
  };
}
