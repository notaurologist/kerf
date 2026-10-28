import { describe, expect, it } from 'vitest';
import { angleToEdge, formatAngle, settingFromEdgeAngle } from './angle.ts';

describe('angleToEdge', () => {
  it('is the complement of the saw setting', () => {
    expect(angleToEdge(0)).toBe(90);
    expect(angleToEdge(15)).toBe(75);
    expect(angleToEdge(45)).toBe(45);
    expect(angleToEdge(22.5)).toBe(67.5);
  });

  it('rejects settings outside 0° to under 90°', () => {
    expect(() => angleToEdge(-1)).toThrow(RangeError);
    expect(() => angleToEdge(90)).toThrow(RangeError);
    expect(() => angleToEdge(Number.NaN)).toThrow(RangeError);
  });
});

describe('settingFromEdgeAngle', () => {
  it('converts an angle to the edge into a saw setting', () => {
    expect(settingFromEdgeAngle(90)).toBe(0);
    expect(settingFromEdgeAngle(75)).toBe(15);
  });

  it('round-trips with angleToEdge', () => {
    for (const setting of [0, 7.5, 14.036, 30, 44.9]) {
      expect(settingFromEdgeAngle(angleToEdge(setting))).toBeCloseTo(setting, 12);
    }
  });

  it('rejects angles outside more than 0° to 90°', () => {
    expect(() => settingFromEdgeAngle(0)).toThrow(RangeError);
    expect(() => settingFromEdgeAngle(91)).toThrow(RangeError);
  });
});

describe('formatAngle', () => {
  it.each([
    [0, '0.0°'],
    [22.5, '22.5°'],
    [14.036243, '14.0°'],
    [14.05, '14.1°'],
    [89.96, '90.0°'],
    [-0.01, '0.0°'],
  ])('%s shows as %s', (degrees, text) => {
    expect(formatAngle(degrees)).toBe(text);
  });
});
