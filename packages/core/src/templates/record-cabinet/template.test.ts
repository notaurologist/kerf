import { describe, expect, it } from 'vitest';
import { isPanel } from '../../lumber/panel.ts';
import type { Part } from '../../model/types.ts';
import { recordCabinet } from './definition.ts';
import { EDGE_EXAMPLE, EXAMPLES, WORKED_EXAMPLE } from './examples.ts';
import type { RecordCabinetOutputs } from './outputs.ts';

// docs/templates/record-cabinet.md: every number here is from the spec's hand-checked worked
// examples (Worked example, Edge of range, Structural model).

function made(index: number): RecordCabinetOutputs {
  const example = EXAMPLES[index];
  if (!example) throw new Error(`no example ${index}`);
  const result = recordCabinet.generate(example.params, example.structuralInputs);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.output;
}

const worked = made(0);
const edge = made(2);
const part = (o: RecordCabinetOutputs, id: string): Part => {
  const found = o.design.parts.find((p) => p.id === id);
  if (!found) throw new Error(`no part ${id}`);
  return found;
};

describe('the worked example (spec, Worked example)', () => {
  const g = worked.design.geometry;

  it('derives the case, bays, and heights', () => {
    expect(g.caseWidth).toBe(52.5);
    expect(g.clearWidth).toBe(51);
    expect(g.bayWidth).toBe(16.5);
    expect(g.panelX).toEqual([0.75, 18, 35.25, 52.5]);
    // Right side's left face: W − o_s − t.
    expect(g.panelX.at(-1)).toBe(54 - 0.75 - 0.75);
    expect(g.topDepth).toBe(15.75);
    expect(g.bayHeight).toBe(13.25);
    expect(g.panelLength).toBe(19.4375);
    expect(g.shelfLength).toBe(16.875);
    expect(g.partitionLeft).toBe(0.375);
  });

  it('lists the parts in cut-list order, with a left and a right side', () => {
    expect(worked.cutList.map((r) => [r.letter, r.name, r.quantity, r.length])).toEqual([
      ['A', 'Top', 1, '54"'],
      ['B', 'Left side', 1, '19-7/16"'],
      ['C', 'Right side', 1, '19-7/16"'],
      ['D', 'Partition', 2, '19-7/16"'],
      ['E', 'Bottom shelf', 3, '16-7/8"'],
      ['F', 'Back rail', 3, '16-7/8"'],
    ]);
    expect(worked.cutList.map((r) => r.stock)).toEqual([
      'Panel (3/4" x 15-3/4")',
      'Panel (3/4" x 15")',
      'Panel (3/4" x 15")',
      'Panel (3/4" x 15")',
      'Panel (3/4" x 15")',
      // One board, not flattened, keeps the 13/16" board's thickness.
      'Board (13/16" x 3")',
    ]);
  });

  it('glues each panel from the boards the spec works out', () => {
    // Spec, Panels: n = ⌈(width + 0.375) / 5.375⌉; the top is an exact fit of 3 boards.
    const panel = (id: string) => {
      const s = part(worked, id).stock;
      if (!isPanel(s)) throw new Error(`${id} is not a panel`);
      return [s.boards, s.gluedWidth, s.boardLength];
    };
    expect(panel('top')).toEqual([3, 16.25, 56]);
    expect(panel('side-left')).toEqual([3, 16.25, 21.4375]);
    expect(panel('partition')).toEqual([3, 16.25, 21.4375]);
    expect(panel('shelf')).toEqual([3, 16.25, 18.875]);
    expect(panel('rail')).toEqual([1, 5.5, 18.875]);
  });

  it('cuts the dadoes, notch, and foot cutout where the spec puts them', () => {
    const side = part(worked, 'side-left');
    // Shelf dado at h_f to h_f + t, rail pocket at H − t − h_r to H − t, as wide as the rail's
    // 13/16" board from the back: 15 − 0.8125 = 14.1875.
    expect(side.dadoes.map((d) => [d.face, d.u0, d.u1, d.v0, d.v1, d.depth])).toEqual([
      ['near', 5.25, 6, 0, 15, 0.1875],
      ['near', 16.25, 19.25, 14.1875, 15, 0.1875],
    ]);
    expect(part(worked, 'side-right').dadoes.every((d) => d.face === 'far')).toBe(true);
    expect(part(worked, 'partition').dadoes).toHaveLength(4);
    expect(side.notches).toEqual([{ end: 1, edge: 'reference', along: 0.1875, across: 0.5 }]);
    // Cutout width D_c − 2 f_w = 10.
    expect(side.cutouts).toEqual([{ end: 0, v0: 2.5, v1: 12.5, depth: 4 }]);
    // The top's stopped dadoes run from o_f + s_d = 1.25 to the back edge at D_t.
    const top = part(worked, 'top');
    expect(top.dadoes.map((d) => [d.u0, d.v0, d.v1])).toEqual([
      [0.75, 1.25, 15.75],
      [18, 1.25, 15.75],
      [35.25, 1.25, 15.75],
      [52.5, 1.25, 15.75],
    ]);
  });

  it('flags the 3/8" left between a partition’s dadoes', () => {
    expect(worked.review.flags[0]?.ask).toContain('3/8" of wood');
  });
});

describe('fit (spec, Placements)', () => {
  const { placements, params: p, geometry: g } = worked.design;
  const at = (id: string, instance = 0) => {
    const pl = placements.find((x) => x.partId === id && x.instance === instance);
    if (!pl) throw new Error(`${id}/${instance} is not placed`);
    return pl;
  };

  it('stands every side and partition on the floor, its top end in the top’s dado', () => {
    for (const pl of placements.filter(
      (x) => x.partId.startsWith('side') || x.partId === 'partition',
    )) {
      expect(pl.origin.z).toBe(0);
      // Its top end at H_p = H − t + j: j above the top's underside, at the dado's bottom.
      expect(pl.origin.z + g.panelLength).toBe(p.height - p.panelThickness + p.dadoDepth);
    }
  });

  it('puts the right side’s right face at W − o_s', () => {
    // Through runs −x from the origin, so the origin is the right face.
    expect(at('side-right').origin.x).toBe(54 - 0.75);
  });

  it('runs each shelf and rail from one dado’s bottom to the other’s', () => {
    for (let k = 0; k < p.bays; k++) {
      const left = at('shelf', k).origin.x;
      expect(left).toBe((g.panelX[k] as number) + p.panelThickness - p.dadoDepth);
      expect(left + g.shelfLength).toBe((g.panelX[k + 1] as number) + p.dadoDepth);
      expect(at('rail', k).origin.x).toBe(left);
    }
  });
});

describe('the edge of the range (spec, Edge of range)', () => {
  const g = edge.design.geometry;

  it('derives a two-bay case with 1" panels', () => {
    expect([g.caseWidth, g.clearWidth, g.bayWidth]).toEqual([28, 26, 12.5]);
    expect(g.panelX[1]).toBe(14.5);
    expect([g.topDepth, g.bayHeight, g.panelLength, g.shelfLength]).toEqual([14, 18, 29.25, 13]);
    expect(g.partitionLeft).toBe(0.5);
    const cut = part(edge, 'side-left').cutouts[0];
    expect(cut && cut.v1 - cut.v0).toBe(7);
  });

  it('refuses the speaker in bay 1, 12-1/2" wide', () => {
    const result = recordCabinet.generate(
      { ...EDGE_EXAMPLE, speaker: { ...EDGE_EXAMPLE.speaker, place: 1 } },
      {},
    );
    expect(result).toMatchObject({ ok: false, issues: [{ code: 'speaker-too-big-for-bay' }] });
  });
});

describe('refusals (spec, Validation)', () => {
  const refused = (over: Partial<typeof WORKED_EXAMPLE>) => {
    const result = recordCabinet.generate({ ...WORKED_EXAMPLE, ...over }, {});
    return result.ok ? [] : result.issues.map((i) => i.code);
  };

  it('refuses a bay lower than a record, dadoes that meet, and feet that meet', () => {
    expect(refused({ jacket: 13.5 })).toEqual(['bay-too-low']);
    expect(refused({ dadoDepth: 0.375 })).toEqual(['dadoes-meet']);
    expect(refused({ footWidth: 7.5 })).toEqual(['feet-meet']);
    expect(refused({ cutoutHeight: 5.25 })).toEqual(['cutout-too-tall']);
  });

  it('refuses a top too short for the turntable and speaker side by side', () => {
    expect(refused({ turntable: { width: 40, depth: 13.5, lidHeight: 15 } })).toEqual([
      'top-too-short',
    ]);
  });
});

describe('structural (spec, Structural model, Worked examples)', () => {
  const computed = (o: RecordCabinetOutputs) => {
    const d = o.review.shelf.deflection;
    if (d.status !== 'computed') throw new Error(d.status);
    return d.computed.value;
  };

  it('works out the cherry shelf’s long-term sag: 1.5 × 0.004891"', () => {
    expect(computed(worked)).toBeCloseTo(0.007336, 6);
  });

  it('works out the walnut edge-of-range shelf: 1.5 × 0.000792"', () => {
    expect(computed(edge)).toBeCloseTo(0.001188, 6);
  });

  it('says what is needed when no structural inputs are entered', () => {
    const none = made(1);
    expect(none.review.shelf.deflection.status).toBe('input-needed');
    expect(none.review.movement.every((m) => m.status === 'input-needed')).toBe(true);
  });

  it('checks the top under the speaker only when the speaker is on it', () => {
    expect(worked.review.topSpeaker?.deflection.status).toBe('computed');
    const inBay = recordCabinet.generate(
      { ...WORKED_EXAMPLE, speaker: { ...WORKED_EXAMPLE.speaker, place: 2 } },
      {},
    );
    expect(inBay.ok && inBay.output.review.topSpeaker).toBeUndefined();
  });
});

describe('wood movement', () => {
  it('estimates each part across its grain: width × 0.00248 × (10 − 6) for flatsawn cherry', () => {
    const change = worked.review.movement.map((m) => [
      m.subject,
      m.status === 'computed' ? m.change.value : null,
    ]);
    expect(change).toEqual([
      ['Top', expect.closeTo(15.75 * 0.00248 * 4, 12)],
      ['Left and right sides', expect.closeTo(15 * 0.00248 * 4, 12)],
      ['Partition', expect.closeTo(15 * 0.00248 * 4, 12)],
      ['Bottom shelf', expect.closeTo(15 * 0.00248 * 4, 12)],
      ['Back rail', expect.closeTo(3 * 0.00248 * 4, 12)],
    ]);
  });
});

describe('plan and drawings', () => {
  const plan = recordCabinet.plan(worked);
  const drawings = recordCabinet.drawings(worked);

  it('shows the shelf and top checks and the movement estimates', () => {
    expect(plan.checks.map((c) => `${c.subject}: ${c.loadCase}`)).toEqual([
      'Bottom shelf: Records along the shelf, for years',
      'Top: Turntable at the middle of a span, for years',
      'Top: Speaker at the middle of a span, for years',
    ]);
    expect(plan.movement).toHaveLength(5);
  });

  it('draws a cut detail per part, front and end elevations, and a section through a bay', () => {
    expect(drawings.cutDetails).toHaveLength(6);
    expect(drawings.elevations?.map((d) => d.title)).toEqual([
      'Front elevation',
      'End elevation',
      'Section through the first bay',
    ]);
    const section = drawings.elevations?.[2];
    const lined = section?.primitives.filter((p) => p.kind === 'polygon' && p.fill === 'section');
    // The plane cuts the first bay's shelf, its back rail, and the top.
    expect(new Set(lined?.map((p) => p.part?.partId))).toEqual(new Set(['shelf', 'rail', 'top']));
  });

  it('dimensions each bay’s clear width on the front elevation', () => {
    const front = drawings.elevations?.[0];
    const texts = front?.primitives.flatMap((p) =>
      p.kind === 'text' && p.role === 'dimension' ? [p.text] : [],
    );
    expect(texts?.filter((t) => t === '16-1/2"')).toHaveLength(3);
  });
});
