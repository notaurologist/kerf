import {
  actionView,
  boardDrawings,
  type Corner,
  type Drawing,
  type Drawings,
  type Explode,
  explodedView,
  fromCorner,
  isometric,
  isometricView,
} from '../geometry/index.ts';
import { isPanel, isStripGlueUp } from '../lumber/partStock.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import { JOINING_OPERATION_TYPES } from '../model/operations.ts';
import type { Part, Placement } from '../model/types.ts';
import { stepContents } from './build.ts';

// Action drawings for Building mode (#118; design Stage 5, "Drawings in Building mode"): one for
// each assembly step, a step whose operations join parts (a dry fit draws them all fitted). Each draws only what the step adds,
// pulled away from where it goes with a motion arrow, on everything earlier assembly steps built.
// Cutting steps show their board and site work the site layout, so they get none here. A step
// that glues up panels draws each panel's boards side by side, pulled apart, with arrows to where
// they meet: the seams there are a layout to follow, since where they fall depends on the boards
// bought (owner's choice on #71). A step that glues up strips draws them standing on edge, face
// to face, pulled apart the same way. Made on read from stored outputs, like the other drawings.

export interface StepDrawing {
  stepId: string;
  drawing: Drawing;
}

type StepsTemplate<O> = Pick<
  TemplateDefinition<unknown, unknown, O>,
  'steps' | 'plan' | 'assembly'
>;

/** Every assembly step's action drawing, in step order. */
export function stepDrawings<O>(template: StepsTemplate<O>, outputs: O): StepDrawing[] {
  return actionSteps(template, outputs).map((s) => ({ stepId: s.stepId, drawing: s.draw() }));
}

/**
 * One step's action drawing, or null for a step that has none. Only that step is drawn: what
 * earlier steps built is worked out from their operations alone.
 */
export function stepDrawing<O>(
  template: StepsTemplate<O>,
  outputs: O,
  stepId: string,
): Drawing | null {
  return (
    actionSteps(template, outputs)
      .find((s) => s.stepId === stepId)
      ?.draw() ?? null
  );
}

/** Each assembly step with a drawing, and how to draw it, without drawing any. */
function actionSteps<O>(
  template: StepsTemplate<O>,
  outputs: O,
): { stepId: string; draw: () => Drawing }[] {
  const views = template.assembly(outputs);
  if (!views) return [];
  const { scene, view, explode } = views;
  const named = (ids: Iterable<string>) =>
    [...ids]
      .map((id) => scene.parts.find((p) => p.id === id))
      .flatMap((p) => (p ? [`${p.letter} ${p.name}`] : []))
      .join(', ');
  const built = new Set<string>();
  const drawings: { stepId: string; draw: () => Drawing }[] = [];
  for (const step of stepContents(template.steps(outputs), template.plan(outputs))) {
    if (step.board) continue;
    const glued = step.operations.flatMap((op) =>
      op.type === 'glue-up' || op.type === 'glue-up-strips'
        ? scene.parts.filter((p) => p.id === op.partId)
        : [],
    );
    if (glued.length > 0) {
      drawings.push({ stepId: step.id, draw: () => glueUpDrawing(glued, `Step: ${step.title}`) });
      continue;
    }
    const joins = step.operations.some(
      (op) => JOINING_OPERATION_TYPES.includes(op.type) && 'partIds' in op && op.partIds.length > 1,
    );
    if (!joins) continue;
    // A dry fit is taken apart again, so it shows every part fitted and builds nothing.
    const dry = step.operations.every((op) => op.type === 'dry-fit');
    const parts = [
      ...new Set(
        step.operations.flatMap((op) =>
          'partId' in op ? [op.partId] : 'partIds' in op ? op.partIds : [],
        ),
      ),
    ];
    // What the step adds; a step that only works on parts already built shows them all.
    const fresh = dry ? parts : parts.filter((id) => !built.has(id));
    const added = new Set(fresh.length > 0 ? fresh : parts);
    const before = new Set([...built].filter((id) => !added.has(id)));
    const description =
      `${dry ? 'Fits' : 'Adds'} ${named(added)}` +
      (dry ? ' together without glue' : '') +
      (before.size > 0 ? `, to ${named(before)} already built` : '') +
      '. A part drawn away from where it goes has an arrow back to it.';
    drawings.push({
      stepId: step.id,
      draw: () =>
        actionView(
          scene,
          view,
          { added, built: before, explode },
          description,
          `Step: ${step.title}`,
        ),
    });
    if (!dry) for (const id of added) built.add(id);
  }
  return drawings;
}

/** Space between boards or strips pulled apart, and between glue-ups, in board widths. */
const GAP = 0.6;

/** A board or strip of a glued-up part, drawn as the part with its size and square ends. */
function piece(part: Part, length: number, stock: Part['stock']): Part {
  return {
    ...part,
    length,
    stock,
    ends: [part.ends[0], part.ends[1]].map((e) => ({ ...e, setting: 0 })) as Part['ends'],
    tapers: [],
    holes: [],
    boltAreas: [],
    dadoes: [],
    notches: [],
    cutouts: [],
  };
}

/**
 * Each panel's boards lying flat, side by side across its width, and each strip glue-up's strips
 * standing on edge, face to face across the glue-up, every board or strip after the first pulled
 * away from the one before with an arrow back to where it meets it. A board or strip is drawn as
 * the part with its own size, one instance each, so the drawing links to the part in the cut list.
 */
function glueUpDrawing(glued: readonly Part[], title: string): Drawing {
  const parts: Part[] = [];
  const placements: Placement[] = [];
  const explode: Explode[] = [];
  const panels: string[] = [];
  const stripped: string[] = [];
  let x = 0;
  const lay = (part: Part, pieces: number, length: number, step: number, onEdge: boolean) => {
    for (let k = 0; k < pieces; k++) {
      placements.push({
        partId: part.id,
        instance: k,
        origin: { x, y: k * step, z: 0 },
        along: { x: 1, y: 0, z: 0 },
        across: onEdge ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 },
        through: onEdge ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 },
      });
      if (k > 0)
        explode.push({ partId: part.id, instance: k, offset: { x: 0, y: k * GAP * step, z: 0 } });
    }
    x += length + GAP * step * pieces;
  };
  for (const part of glued) {
    const { stock } = part;
    const name = `${part.letter} ${part.name}`;
    if (isPanel(stock)) {
      const { board, boards, boardLength } = stock;
      const one = { ...stock, width: board.width, thickness: board.thickness, boards: 1 };
      parts.push(piece(part, boardLength, one));
      lay(part, boards, boardLength, board.width, false);
      panels.push(`${boards} boards for ${name}`);
    } else if (isStripGlueUp(stock)) {
      const { board, strips, stripLength, stripWidth } = stock;
      parts.push(
        piece(part, stripLength, { ...stock, width: stripWidth, thickness: board.thickness }),
      );
      lay(part, strips, stripLength, board.thickness, true);
      stripped.push(`${strips} strips for ${name}`);
    }
  }
  const pieces = [panels.length > 0 && 'board', stripped.length > 0 && 'strip']
    .filter(Boolean)
    .join(' or ');
  const description = [
    ...(panels.length > 0 ? [`Glue up ${panels.join(', and ')}, edge to edge.`] : []),
    ...(stripped.length > 0 ? [`Glue up ${stripped.join(', and ')}, face to face.`] : []),
    `Each ${pieces} is drawn pulled away from the one before, with an arrow to where they meet.`,
    ...(panels.length > 0
      ? ['Where the seams fall is a layout to follow; lay out your own boards as you choose.']
      : []),
  ].join(' ');
  return actionView(
    { parts, placements },
    isometric(-1, -1),
    { added: new Set(parts.map((p) => p.id)), built: new Set(), explode },
    description,
    title,
  );
}

/**
 * A project's drawings: the template's own, drawn from stored outputs, then the board cards' from
 * the board plan (#59), which every template's data supports. The assembly steps' action drawings
 * come one at a time from `stepDrawing`, since together they are most of a large plan's drawings.
 * The outputs must already parse with the template's schema.
 */
export function projectDrawings<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'drawings' | 'plan'>,
  outputs: O,
): Drawings {
  const plan = template.plan(outputs);
  const setting = (partId: string, end: number) => {
    const op = plan.operations.find(
      (o) => o.type === 'miter' && o.partId === partId && o.end === end,
    );
    return op?.type === 'miter' ? op.setting : 0;
  };
  const settings = new Map(
    plan.cutList.map((r) => [r.partId, [setting(r.partId, 0), setting(r.partId, 1)] as const]),
  );
  return {
    ...template.drawings(outputs),
    boards: boardDrawings(plan.lumber, plan.cutList, settings),
  };
}

/**
 * The assembled view with no part letters, for choosing a template (#357), where the parts are not
 * yet named. Null for a template with no assembly to draw.
 */
export function unletteredView<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'drawings' | 'assembly'>,
  outputs: O,
): Drawing | null {
  const own = template.drawings(outputs).isometric;
  const assembly = template.assembly(outputs);
  if (!own || !assembly) return null;
  return isometricView(assembly.scene, assembly.view, own.description, own.title, {
    letters: false,
  });
}

const CORNER_WORDS: Record<Corner, string> = {
  'front-left': 'front left',
  'front-right': 'front right',
  'back-right': 'back right',
  'back-left': 'back left',
};

/**
 * The assembled and exploded views seen from one corner (#364): the template's own from the front
 * left, and from another corner the same scene and explode turned to it, each described as the
 * template describes its own, and where it is seen from.
 */
export function cornerViews<O>(
  template: Pick<TemplateDefinition<unknown, unknown, O>, 'drawings' | 'assembly'>,
  outputs: O,
  corner: Corner,
): Pick<Drawings, 'isometric' | 'exploded'> {
  const own = template.drawings(outputs);
  const assembly = template.assembly(outputs);
  if (corner === 'front-left' || !assembly) {
    return { isometric: own.isometric, exploded: own.exploded };
  }
  const view = fromCorner(assembly.view, corner);
  const seen = ` Seen from the ${CORNER_WORDS[corner]}, above.`;
  return {
    isometric:
      own.isometric &&
      isometricView(assembly.scene, view, own.isometric.description + seen, own.isometric.title),
    exploded:
      own.exploded &&
      explodedView(
        assembly.scene,
        view,
        assembly.explode,
        own.exploded.description + seen,
        own.exploded.title,
      ),
  };
}
