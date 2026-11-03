import { describe, expect, it } from 'vitest';
import { placeStoreReadings, readingsBesideHardware } from '../../model/storeReadings.ts';
import { lumberLineKey } from '../../outputs/shoppingList.ts';
import { swingSetAFrame } from './definition.ts';
import { EXAMPLES } from './examples.ts';

// The values read at the store (#390): beside which lines each is asked, and what it says once
// entered. Every reading names a field the form has.

const [buried, empty, onPads] = EXAMPLES as unknown as [
  (typeof EXAMPLES)[number],
  (typeof EXAMPLES)[number],
  (typeof EXAMPLES)[number],
];

function placed(example: (typeof EXAMPLES)[number]) {
  const result = swingSetAFrame.generate(example.params, example.structuralInputs);
  if (!result.ok) throw new Error('example did not generate');
  const plan = swingSetAFrame.plan(result.output);
  return {
    plan,
    readings: placeStoreReadings(
      swingSetAFrame.storeReadings ?? [],
      swingSetAFrame.form,
      plan,
      example.params,
      example.structuralInputs,
    ),
  };
}

const paths = (list: readonly { reading: { path: string } }[]) => list.map((p) => p.reading.path);

describe('the swing set store readings', () => {
  it('each names a field in the form', () => {
    for (const reading of swingSetAFrame.storeReadings ?? []) {
      const fields = swingSetAFrame.form[reading.from].flatMap((s) => s.fields);
      expect(fields.map((f) => f.path)).toContain(reading.path);
    }
  });

  it('asks for the grade stamp and incising beside the beam boards, and nowhere else', () => {
    const { plan, readings } = placed(empty);
    const beamLines = new Set(
      plan.lumber.boards
        .filter((b) => b.pieces.some((p) => p.partId === 'beam'))
        .map(lumberLineKey),
    );
    expect(beamLines.size).toBeGreaterThan(0);
    expect([...readings.lumber.keys()].sort()).toEqual([...beamLines].sort());
    for (const key of beamLines) {
      expect(paths(readings.lumber.get(key) ?? [])).toEqual(['beamSpeciesGrade', 'beamIncised']);
    }
  });

  it('asks for the hanger rating and mounting beside the hangers; no rating is entered yet', () => {
    const { readings } = placed(empty);
    const hangers = readingsBesideHardware(readings, { description: 'Swing hangers' });
    expect(paths(hangers)).toEqual([
      'hangerRating',
      'hardware.hangerMounting.kind',
      'hardware.hangerMounting.diameter',
    ]);
    expect(hangers[0]?.entered).toBeNull();
    expect(hangers[0]?.label).toBe('Swing hanger rated working load');
    expect(hangers.slice(1).map((p) => p.entered)).toEqual([
      'One bolt down through the beam',
      '1/2"',
    ]);
    expect([...readings.lumber.values()].flat().every((p) => p.entered === null)).toBe(true);
  });

  it('says what was entered once it is', () => {
    const { readings } = placed(buried);
    const beam = [...readings.lumber.values()][0] ?? [];
    expect(beam.map((p) => p.entered)).toEqual(['Southern Pine No.2', 'No']);
    expect(readingsBesideHardware(readings, { description: 'Swing hangers' })[0]?.entered).toBe(
      '1200 lb',
    );
  });

  it('asks how many bolts and how high for a bracket bolted sideways', () => {
    const hangers = readingsBesideHardware(placed(onPads).readings, {
      description: 'Swing hangers',
    });
    expect(paths(hangers)).toEqual([
      'hangerRating',
      'hardware.hangerMounting.kind',
      'hardware.hangerMounting.diameter',
      'hardware.hangerMounting.perHanger',
      'hardware.hangerMounting.holeHeight',
    ]);
    expect(hangers.slice(3).map((p) => p.entered)).toEqual(['2', '1-1/2"']);
  });

  it("asks for anchors per leg foot and one anchor's rated pull-out only on pads, beside the anchors", () => {
    expect(placed(buried).readings.hardware.has('Ground anchors')).toBe(false);
    const anchors = readingsBesideHardware(placed(onPads).readings, {
      description: 'Ground anchors',
    });
    expect(paths(anchors)).toEqual(['hardware.anchorsPerFoot', 'hardware.anchorRating']);
    expect(anchors.map((a) => a.entered)).toEqual(['1', '500 lb']);
  });

  it('says how to find each value', () => {
    for (const reading of swingSetAFrame.storeReadings ?? []) {
      expect(reading.how.length).toBeGreaterThan(40);
    }
    expect(swingSetAFrame.storeReadings?.[0]?.illustration).toBe('grade-stamp');
  });

  // The species list has only what Kerf has design values for (#450).
  it('says what to do when the stamp names a species the list does not have', () => {
    expect(swingSetAFrame.storeReadings?.[0]?.how).toContain(
      'If the list does not have them, the checks have no design values for these boards: choose boards whose stamp the list has, or ask an experienced builder whether these will do.',
    );
  });
});
