import {
  actionView,
  boardDrawings,
  type Drawing,
  type Drawings,
  type Explode,
  isometric,
} from '../geometry/index.ts';
import { isPanel } from '../lumber/panel.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import type { Part, Placement } from '../model/types.ts';
import { stepContents } from './build.ts';

// Action drawings for Building mode (#118; design Stage 5, "Drawings in Building mode"): one for
// each assembly step, a step whose operations join parts. Each draws only what the step adds,
// pulled away from where it goes with a motion arrow, on everything earlier assembly steps built.
// Cutting steps show their board and site work the site layout, so they get none here. A step
// that glues up panels draws each panel's boards side by side, pulled apart, with arrows to where
// they meet: the seams there are a layout to follow, since where they fall depends on the boards
// bought (owner's choice on #71). Made on read from stored outputs, like the other drawings.

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
    if (step.board) continue;
    const glued = step.operations.flatMap((op) =>
      op.type === 'glue-up' ? scene.parts.filter((p) => p.id === op.partId) : [],
    );
    if (glued.length > 0) {
      drawings.push({ stepId: step.id, drawing: glueUpDrawing(glued, `Step: ${step.title}`) });
      continue;
    }
    const joins = step.operations.some((op) => 'partIds' in op && op.partIds.length > 1);
    if (!joins) continue;
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

/** Space between boards pulled apart, and between panels, in board widths. */
const GAP = 0.6;

/**
 * Each panel's boards lying flat, side by side across its width, every board after the first
 * pulled away from the one before with an arrow back to where it meets it. A board is drawn as
 * the panel part with one board's width, one instance per board, so the drawing links to the
 * panel in the cut list.
 */
function glueUpDrawing(panels: readonly Part[], title: string): Drawing {
  const parts: Part[] = [];
  const placements: Placement[] = [];
  const explode: Explode[] = [];
  let x = 0;
  for (const part of panels) {
    if (!isPanel(part.stock)) continue;
    const { board, boards, boardLength } = part.stock;
    parts.push({
      ...part,
      length: boardLength,
      stock: { ...part.stock, width: board.width, thickness: board.thickness, boards: 1 },
      ends: [part.ends[0], part.ends[1]].map((e) => ({ ...e, setting: 0 })) as Part['ends'],
      tapers: [],
      holes: [],
      boltAreas: [],
      dadoes: [],
      notches: [],
      cutouts: [],
    });
    for (let k = 0; k < boards; k++) {
      placements.push({
        partId: part.id,
        instance: k,
        origin: { x, y: k * board.width, z: 0 },
        along: { x: 1, y: 0, z: 0 },
        across: { x: 0, y: 1, z: 0 },
        through: { x: 0, y: 0, z: 1 },
      });
      if (k > 0)
        explode.push({
          partId: part.id,
          instance: k,
          offset: { x: 0, y: k * GAP * board.width, z: 0 },
        });
    }
    x += boardLength + GAP * board.width * boards;
  }
  const names = panels.map((p) =>
    isPanel(p.stock) ? `${p.stock.boards} boards for ${p.letter} ${p.name}` : '',
  );
  return actionView(
    { parts, placements },
    isometric(-1, -1),
    { added: new Set(parts.map((p) => p.id)), built: new Set(), explode },
    `Glue up ${names.filter(Boolean).join(', and ')}, edge to edge. Each board is drawn pulled away from the one before, with an arrow to where they meet. Where the seams fall is a layout to follow; lay out your own boards as you choose.`,
    title,
  );
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
