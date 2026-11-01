import { describe, expect, it } from 'vitest';
import { isometric } from '../geometry/index.ts';
import { panelStock } from '../lumber/panel.ts';
import type { TemplateDefinition } from '../model/definition.ts';
import { boardCuts, cutAndDrillOperations } from '../model/operations.ts';
import type { Part } from '../model/types.ts';
import type { Plan } from '../outputs/plan.ts';
import { stepDrawings } from './drawings.ts';

// The glue-up step's drawing, on a made-up panel: 15" wide from 5-1/2" boards (3 boards, each
// 21-7/16" long; lumber/panel.test.ts works the numbers).

const made = panelStock({
  thickness: 0.75,
  width: 15,
  length: 19.4375,
  board: { nominal: '1x6 cherry', thickness: 0.75, width: 5.5, buyableFeet: [8] },
  allowances: { jointPerEdge: 1 / 16, rip: 0.5, trimPerEnd: 1, flatten: 0 },
});
if (!made.ok) throw new Error(made.issue.message);
const square = { setting: 0, description: 'Square', measuredFrom: 'reference-edge' as const };
const side: Part = {
  id: 'side',
  letter: 'A',
  name: 'Side',
  role: 'side',
  stock: made.stock,
  quantity: 1,
  length: 19.4375,
  markLengths: [],
  ends: [square, square],
  endsParallel: true,
  notes: [],
  selection: [],
  referenceEdge: 'back edge',
  holes: [],
  boltAreas: [],
  tapers: [],
  dadoes: [],
  notches: [],
  cutouts: [],
};
const operations = cutAndDrillOperations([side], []);
const cuts = new Set(boardCuts(operations).map((op) => op.id));
const template = {
  steps: () => [
    {
      id: 'glue',
      title: 'Glue up the side',
      operationIds: operations.filter((op) => !cuts.has(op.id)).map((op) => op.id),
      categories: [],
    },
  ],
  plan: () =>
    ({
      operations,
      lumber: {
        boards: [],
        kerf: 0.125,
        trimPerEnd: 0.5,
        lines: [],
        notes: [],
        issues: [],
        selection: [],
      },
    }) as unknown as Plan,
  assembly: () => ({
    scene: {
      parts: [side],
      placements: [
        {
          partId: 'side',
          instance: 0,
          origin: { x: 0, y: 0, z: 0 },
          along: { x: 0, y: 0, z: 1 },
          across: { x: 0, y: 1, z: 0 },
          through: { x: 1, y: 0, z: 0 },
        },
      ],
    },
    view: isometric(-1, -1),
    explode: [],
  }),
} as Pick<TemplateDefinition<unknown, unknown, null>, 'steps' | 'plan' | 'assembly'>;

describe('glue-up drawings', () => {
  const [step] = stepDrawings(template, null);
  const drawing = step?.drawing;

  it("draws the panel's boards for a step that glues it up", () => {
    expect(step?.stepId).toBe('glue');
    const instances = new Set(
      drawing?.primitives.flatMap((p) => (p.kind === 'polygon' ? [p.part?.instance] : [])),
    );
    expect([...instances].sort()).toEqual([0, 1, 2]);
    expect(drawing?.primitives.every((p) => !p.part || p.part.partId === 'side')).toBe(true);
  });

  it('pulls each board after the first away, with an arrow back to where it meets', () => {
    const arrows = drawing?.primitives.filter(
      (p) => p.kind === 'line' && p.role === 'guideline' && p.arrows === 'end',
    );
    expect(arrows).toHaveLength(2);
    expect(drawing?.description).toContain('Glue up 3 boards for A Side, edge to edge.');
    expect(drawing?.description).toContain('a layout to follow');
  });
});
