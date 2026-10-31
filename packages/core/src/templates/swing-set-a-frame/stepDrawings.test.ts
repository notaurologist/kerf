import { describe, expect, it } from 'vitest';
import { boardDrawings } from '../../geometry/boards.ts';
import { project } from '../../geometry/projection.ts';
import { projectDrawings, stepDrawings } from '../../steps/drawings.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// Action drawings (#118) for the spec's worked example. Its assembly steps are "frames" (bolt the
// crossbars and gussets across the legs) and "beam" (bolt the legs to the beam); the cutting steps,
// easing edges, and site work get none.
//
// The view is true isometric from the front left, isometric(−1, −1): the page's right is
// (1, −1, 0)/√2 and its up (1, 1, 2)/√6. So the beam pulled 30 up moves 30 · 2/√6 = 24.495 up the
// page and not sideways, and crossbar 0 pulled 24 toward −x moves 24/√2 = 16.971 left and
// 24/√6 = 9.798 down.

const example = EXAMPLES[0];
if (!example) throw new Error('no worked example');
const generated = swingSetAFrame.generate(example.params, example.structuralInputs);
if (!generated.ok) throw new Error('worked example does not generate');
const drawings = stepDrawings(swingSetAFrame, generated.output);
const byStep = (id: string) => drawings.find((d) => d.stepId === id)?.drawing;

const parts = (id: string) => [
  ...new Set(
    (byStep(id)?.primitives ?? []).flatMap((p) =>
      p.kind === 'polygon' && p.part ? [p.part.partId] : [],
    ),
  ),
];
const arrows = (id: string) =>
  (byStep(id)?.primitives ?? []).flatMap((p) =>
    p.kind === 'line' && p.arrows === 'end' && p.part
      ? [{ part: `${p.part.partId}/${p.part.instance}`, from: p.points[0], to: p.points[1] }]
      : [],
  );

describe('action drawings for the worked example', () => {
  it('draws the assembly steps only, in order', () => {
    expect(drawings.map((d) => d.stepId)).toEqual(['frames', 'beam']);
  });

  it('frames: adds the legs, crossbars, and gussets, with nothing built before', () => {
    expect(byStep('frames')?.emphasis?.sort()).toEqual([
      'crossbar',
      'gusset',
      'leg-back',
      'leg-front',
    ]);
    expect(parts('frames').sort()).toEqual(['crossbar', 'gusset', 'leg-back', 'leg-front']);
    // The legs stay; each crossbar and gusset is pulled out along the beam, arrow back home.
    expect(arrows('frames').map((a) => a.part)).toEqual([
      'crossbar/0',
      'crossbar/1',
      'gusset/0',
      'gusset/1',
    ]);
    const crossbar = arrows('frames')[0];
    const dx = (crossbar?.from?.x ?? 0) - (crossbar?.to?.x ?? 0);
    const dy = (crossbar?.from?.y ?? 0) - (crossbar?.to?.y ?? 0);
    expect(dx).toBeCloseTo(-16.971, 3);
    expect(dy).toBeCloseTo(9.798, 3);
  });

  it('beam: adds the beam, pulled up 30 with an arrow down to where it goes, on the frames', () => {
    const beam = byStep('beam');
    expect(beam?.emphasis).toEqual(['beam']);
    expect(parts('beam').sort()).toEqual(['beam', 'crossbar', 'gusset', 'leg-back', 'leg-front']);
    const [arrow, ...more] = arrows('beam');
    expect(more).toEqual([]);
    expect(arrow?.part).toBe('beam/0');
    expect((arrow?.from?.x ?? 0) - (arrow?.to?.x ?? 0)).toBeCloseTo(0, 9);
    expect((arrow?.from?.y ?? 0) - (arrow?.to?.y ?? 0)).toBeCloseTo(-24.495, 3);
    expect(beam?.description).toBe(
      'Adds A Beam, to B Back leg (uphill), C Front leg (downhill), D Crossbar, E Gusset already built. A part drawn away from where it goes has an arrow back to it.',
    );
  });

  it('projects the arrow onto the page with the same view as the isometric drawing', () => {
    // The arrow's head is the beam's centroid in place: at its middle along x, on y = 0, and half
    // its 5.5 depth above its underside at H = 96 (spec, Parameters): z = 98.75.
    const head = arrows('beam')[0]?.to;
    const view = swingSetAFrame.assembly(generated.output)?.view;
    if (!view || !head) throw new Error('no view');
    const beam = generated.output.design.parts.find((p) => p.id === 'beam');
    const H = example.params.beamHeight;
    const depth = beam?.stock.width ?? 0;
    const at = project(view, { x: example.params.beamLength / 2, y: 0, z: H + depth / 2 });
    expect(head.x).toBeCloseTo(at.x, 6);
    expect(head.y).toBeCloseTo(at.y, 6);
  });

  it('leaves out the chains and seats, which hang from a beam not built until the last step', () => {
    for (const { drawing } of drawings) {
      expect(drawing.primitives.filter((p) => p.kind === 'line' && p.role === 'phantom')).toEqual(
        [],
      );
    }
  });

  it('draws nothing for a plan made before placements', () => {
    const old = { ...generated.output, design: { ...generated.output.design, placements: [] } };
    expect(stepDrawings(swingSetAFrame, old)).toEqual([]);
  });
});

describe('projectDrawings', () => {
  it("adds the board cards and action drawings to the template's own", () => {
    const all = projectDrawings(swingSetAFrame, generated.output);
    const plan = swingSetAFrame.plan(generated.output);
    expect(all).toEqual({
      ...swingSetAFrame.drawings(generated.output),
      boards: boardDrawings(plan.lumber, plan.cutList),
      steps: stepDrawings(swingSetAFrame, generated.output),
    });
    expect(all.boards).toHaveLength(plan.lumber.boards.length);
    expect(all.steps).not.toHaveLength(0);
  });
});
