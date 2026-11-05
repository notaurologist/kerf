import { describe, expect, it } from 'vitest';
import { readPath, writePath } from './form.ts';

describe('readPath and writePath', () => {
  it('read and write a value by its dotted path, making missing arrays and objects', () => {
    const object: Record<string, unknown> = {};
    writePath(object, 'legStock.lengths.0', 96);
    writePath(object, 'legStock.species', 'Southern pine');
    expect(object).toEqual({ legStock: { lengths: [96], species: 'Southern pine' } });
    expect(readPath(object, 'legStock.lengths.0')).toBe(96);
    expect(readPath(object, 'legStock.width')).toBeUndefined();
  });

  it('refuse a path that names an object prototype', () => {
    for (const path of ['__proto__.polluted', 'a.constructor.prototype.polluted', 'a.prototype']) {
      const object: Record<string, unknown> = { a: {} };
      expect(() => writePath(object, path, true)).toThrow(/names/);
      expect(() => readPath(object, path)).toThrow(/names/);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
