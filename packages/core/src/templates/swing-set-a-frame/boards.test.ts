import { describe, expect, it } from 'vitest';
import { boardDrawings } from '../../geometry/boards.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// Board cards (#59) for the spec's worked example (Build steps, the boards): 1/2" trim per end and
// 1/8" kerf per piece. The beam alone on a 12' 4x6, leaving 144 − (1 + 120.125) = 22.875; each leg
// on its own 12' 4x4; both crossbars on a 10' 2x6; both gussets on an 8' 2x8, leaving
// 96 − (1 + 2 · 19.627) = 55.746.

const example = EXAMPLES[0];
if (!example) throw new Error('no worked example');
const generated = swingSetAFrame.generate(example.params, example.structuralInputs);
if (!generated.ok) throw new Error('worked example does not generate');
const plan = swingSetAFrame.plan(generated.output);
const drawings = boardDrawings(plan.lumber, plan.cutList);

const pieces = (i: number) =>
  (drawings[i]?.primitives ?? []).flatMap((p) =>
    p.kind === 'polygon' && p.fill === 1 && p.part
      ? [
          {
            letter: p.part.letter,
            instance: p.part.instance,
            from: p.points[0]?.x,
            to: p.points[1]?.x,
          },
        ]
      : [],
  );
const texts = (i: number) =>
  (drawings[i]?.primitives ?? []).flatMap((p) => (p.kind === 'text' ? [p.text] : []));

describe('board drawings for the worked example', () => {
  it('draws one board per board in the plan, titled with its size and length', () => {
    expect(drawings.map((d) => d.title)).toEqual([
      `Board 1: 4x6, 12' 0"`,
      `Board 2: 4x4, 12' 0"`,
      `Board 3: 4x4, 12' 0"`,
      `Board 4: 4x4, 12' 0"`,
      `Board 5: 4x4, 12' 0"`,
      `Board 6: 2x6, 10' 0"`,
      `Board 7: 2x8, 8' 0"`,
    ]);
  });

  it('lays the beam after the trimmed end, and labels the offcut left after the saw cut', () => {
    // The beam runs from the 1/2" trim to 120.5; the saw cut takes 1/8", so the offcut runs from
    // 120.625 to the far trim at 143.5: 22.875 = 22-7/8".
    expect(pieces(0)).toEqual([{ letter: 'A', instance: 0, from: 0.5, to: 120.5 }]);
    expect(texts(0)).toEqual(['120"', 'Offcut 22-7/8"']);
  });

  it('puts both gussets on the 2x8, each with its own instance, a saw cut apart', () => {
    const [first, second] = pieces(6);
    expect(first?.letter).toBe('E');
    expect([first?.instance, second?.instance]).toEqual([0, 1]);
    expect(second?.from).toBeCloseTo((first?.to ?? 0) + 0.125, 9);
    expect(texts(6).at(-1)).toBe('Offcut 55-3/4"');
  });

  it('counts a part’s pieces through the boards, as the cutting steps do', () => {
    // The front legs are on boards 2 and 3: pieces 0 and 1.
    expect([pieces(1)[0]?.instance, pieces(2)[0]?.instance]).toEqual([0, 1]);
    expect(pieces(1)[0]?.letter).toBe(pieces(2)[0]?.letter);
  });

  it('describes each board in words for assistive technology', () => {
    expect(drawings[0]?.description).toBe(
      'A 4x6 board 12\' 0" long, cut into A 120", leaving an offcut of 22-7/8" after trimming 1/2" off each end.',
    );
  });
});
