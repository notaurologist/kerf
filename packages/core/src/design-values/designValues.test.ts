import { describe, expect, it } from 'vitest';
import { NOMINAL_SIZES } from '../lumber/stock.ts';
import {
  FACTOR_APPLICABILITY_SOURCES,
  INCISING,
  LOAD_DURATION,
  REPETITIVE_MEMBER,
  TEMPERATURE,
} from './adjustmentFactors.ts';
import {
  nominalDimensions,
  referenceRow,
  SPECIES_GRADES,
  SpeciesGrade,
  TABLE_4B_ADJUSTMENTS,
} from './sawnLumber.ts';
import { Citation, SOURCES, Source } from './sources.ts';

// Reference data checks (ARCHITECTURE.md, Testing): every entry parses, every reference resolves,
// every value has a source.

describe('sources', () => {
  it('parse', () => {
    for (const source of Object.values(SOURCES)) expect(() => Source.parse(source)).not.toThrow();
  });
});

describe('species and grades', () => {
  it('parse, with unique ids and at least one source each', () => {
    for (const entry of SPECIES_GRADES) expect(() => SpeciesGrade.parse(entry)).not.toThrow();
    const ids = SPECIES_GRADES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('have no overlapping size classes', () => {
    for (const entry of SPECIES_GRADES) {
      const rows = [...entry.rows].sort((a, b) => a.width.min - b.width.min);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]?.width.min).toBeGreaterThan(rows[i - 1]?.width.max ?? Infinity);
      }
    }
  });

  it('cover every dimension-lumber stock size, and not timbers', () => {
    for (const nominal of NOMINAL_SIZES) {
      const size = nominalDimensions(nominal);
      const isDimension = size !== null && size.thickness <= 4;
      for (const entry of SPECIES_GRADES) {
        expect(referenceRow(entry.id, nominal) !== null).toBe(isDimension);
      }
    }
  });

  // Spot checks of the rows a swing-set beam uses, against Table 4B as printed.
  it('pick the size class by nominal width', () => {
    expect(referenceRow('southern-pine-no2', '2x6')?.values).toMatchObject({
      Fb: 1000,
      Fv: 175,
      E: 1_400_000,
      Emin: 510_000,
    });
    expect(referenceRow('southern-pine-no2', '4x6')?.label).toBe('5" - 6" wide');
    expect(referenceRow('southern-pine-no1', '4x4')?.values.Fb).toBe(1500);
    expect(referenceRow('southern-pine-no1', '2x8')?.values.Fb).toBe(1250);
    expect(referenceRow('southern-pine-no2', '6x6')).toBeNull();
  });
});

describe('adjustment factors', () => {
  it('cite sources that exist', () => {
    const citations = [
      ...FACTOR_APPLICABILITY_SOURCES,
      ...LOAD_DURATION.sources,
      ...TEMPERATURE.sources,
      ...INCISING.sources,
      ...REPETITIVE_MEMBER.sources,
      ...TABLE_4B_ADJUSTMENTS.wetService.sources,
      ...TABLE_4B_ADJUSTMENTS.sizeFactor.sources,
      ...SPECIES_GRADES.flatMap((s) => s.sources),
    ];
    for (const citation of citations) {
      expect(() => Citation.parse(citation)).not.toThrow();
      expect(SOURCES[citation.source]).toBeDefined();
    }
  });
});
