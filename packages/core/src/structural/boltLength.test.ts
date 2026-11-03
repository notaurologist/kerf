import { describe, expect, it } from 'vitest';
import { boltLength } from './boltLength.ts';

describe('boltLength', () => {
  it('takes the shortest half inch from the grip with its fittings to one diameter past', () => {
    // 5/8" bolt, grip 8-15/16: 8.9375 + 2 × 0.160 + 0.765 = 10.0225, up to 10.0225 + 0.625 =
    // 10.6475. 10" is short; 10-1/2" is inside.
    const b = boltLength(0.625, 8.9375, 2, 'locking', 0.625);
    expect(b?.min).toBeCloseTo(10.0225, 9);
    expect(b?.max).toBeCloseTo(10.6475, 9);
    expect(b?.length).toBe(10.5);
  });

  it('works for each diameter Kerf has fittings for', () => {
    // 3/8": 5 + 2 × 0.104 + 0.468 = 5.676, to 6.051: 6".
    expect(boltLength(0.375, 5, 2, 'locking', 0.375)?.length).toBe(6);
    // 1/2": 3.5 + 2 × 0.132 + 0.609 = 4.373, to 4.873: 4-1/2".
    expect(boltLength(0.5, 3.5, 2, 'locking', 0.5)?.length).toBe(4.5);
    // 3/4": 8 + 2 × 0.177 + 0.890 = 9.244, to 9.994: 9-1/2".
    expect(boltLength(0.75, 8, 2, 'locking', 0.75)?.length).toBe(9.5);
  });

  it('takes a quarter inch when no half inch is in the range', () => {
    // 3/8": 4.85 + 0.208 + 0.468 = 5.526, to 5.901. 6" is past it; 5-3/4" is inside.
    const b = boltLength(0.375, 4.85, 2, 'locking', 0.375);
    expect(b?.length).toBe(5.75);
    expect(b && b.length !== undefined && b.length >= b.min && b.length <= b.max).toBe(true);
  });

  it('takes a length exactly on a half inch', () => {
    // 1/2": 3.627 + 0.264 + 0.609 = 4.5.
    expect(boltLength(0.5, 3.627, 2, 'locking', 0.5)?.length).toBe(4.5);
  });

  it('stands no farther past the nut than allowed', () => {
    // 1/2", grip 3.5, at most 1/4" past: 4.373 to 4.623. 4-1/2" is inside.
    expect(boltLength(0.5, 3.5, 2, 'locking', 0.25)?.max).toBeCloseTo(4.623, 9);
    // At most 1/8" past: 4.373 to 4.498. 4-1/2" is past it and 4-1/4" short, so no length.
    const b = boltLength(0.5, 3.5, 2, 'locking', 0.125);
    expect(b?.max).toBeCloseTo(4.498, 9);
    expect(b).not.toHaveProperty('length');
  });

  it('has no length for a diameter or nut whose sizes Kerf does not have', () => {
    expect(boltLength(0.875, 8, 2, 'locking', 0.875)).toBeUndefined();
    expect(boltLength(0.5, 8, 2, 'standard', 0.5)).toBeUndefined();
  });
});
