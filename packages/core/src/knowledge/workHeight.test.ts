import { describe, expect, it } from 'vitest';
import { SOURCES } from '../design-values/sources.ts';
import { describeBasis } from '../model/questions.ts';
import {
  standingHeightField,
  WORK_HEIGHT_CITATIONS,
  WRIST_HEIGHT_PER_STATURE,
  wristWorkHeight,
} from './workHeight.ts';

describe('wristWorkHeight', () => {
  // Hand-checked: 0.485 × height, to the nearest sixteenth.
  it.each([
    // 64 × 0.485 = 31.04 = 496.64 sixteenths, so 497/16
    [64, 31 + 1 / 16],
    // 70 × 0.485 = 33.95 = 543.2 sixteenths, so 543/16
    [70, 33 + 15 / 16],
    // 70.5 × 0.485 = 34.1925 = 547.08 sixteenths, so 547/16
    [70.5, 34 + 3 / 16],
    // 75 × 0.485 = 36.375, exactly 36-3/8
    [75, 36 + 3 / 8],
  ])('suggests %s" tall as %s"', (stature, expected) => {
    expect(wristWorkHeight(stature).value).toBe(expected);
  });

  it('takes the share from the survey medians it cites', () => {
    const men = 84.7 / 175.5;
    const women = 79.4 / 162.6;
    expect(men).toBeCloseTo(0.483, 3);
    expect(women).toBeCloseTo(0.488, 3);
    expect(WRIST_HEIGHT_PER_STATURE).toBeGreaterThan(men);
    expect(WRIST_HEIGHT_PER_STATURE).toBeLessThan(women);
  });

  it('labels the suggestion a rule of thumb, with its sources and how to measure', () => {
    const s = wristWorkHeight(70);
    expect(s.basis.kind).toBe('rule-of-thumb');
    expect(describeBasis(s.basis)).toMatch(/wrist height/);
    expect(s.note).toMatch(/measure from the floor to the crease of your wrist/);
  });

  it('refuses a height that is not more than zero', () => {
    expect(() => wristWorkHeight(0)).toThrow();
    expect(() => wristWorkHeight(Number.NaN)).toThrow();
  });

  it('cites registered sources', () => {
    for (const c of WORK_HEIGHT_CITATIONS) expect(SOURCES[c.source]).toBeDefined();
  });
});

describe('standingHeightField', () => {
  it('asks for a length at the given path, saying how to enter it', () => {
    const field = standingHeightField('owner.height');
    expect(field).toMatchObject({ path: 'owner.height', kind: 'length' });
    expect(field.help).toMatch(/without shoes/);
    expect(field.confirmed).toBeUndefined();
  });
});
