import { describe, expect, it } from 'vitest';
import { solid } from '../geometry/solid.ts';
import { createSnapshot, readSnapshot } from '../snapshot/snapshot.ts';
import { TEMPLATES } from './index.ts';

// What every template promises generic code (model/definition.ts), checked on its worked examples.

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const examples = TEMPLATES.flatMap((t) => t.examples.map((e) => [t.id, e.name, t, e] as const));

describe('every template', () => {
  it.each(examples)('%s, %s: generates what its outputs schema requires', (_, __, t, e) => {
    const made = createSnapshot(t, e.params, e.structuralInputs);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const outputs = asJson(made.output.outputs);
    expect(t.outputs.parse(outputs)).toEqual(outputs);
  });

  it.each(examples)('%s, %s: reads what it generates back unchanged', (_, __, t, e) => {
    const made = createSnapshot(t, e.params, e.structuralInputs);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const outputs = asJson(made.output.outputs);
    expect(t.storedOutputs.parse(outputs)).toEqual(outputs);
    const read = readSnapshot(TEMPLATES, asJson(made.output));
    expect(read.ok && asJson(read.snapshot.outputs)).toEqual(outputs);
  });

  it.each(examples)('%s, %s: draws every face of every part facing a direction', (_, __, t, e) => {
    // A face with no direction cannot order the faces around it, and they went undrawn (#352).
    const made = createSnapshot(t, e.params, e.structuralInputs);
    if (!made.ok) throw new Error(JSON.stringify(made.issues));
    const scene = t.assembly(t.storedOutputs.parse(asJson(made.output.outputs)))?.scene;
    for (const pl of scene?.placements ?? []) {
      const part = scene?.parts.find((p) => p.id === pl.partId);
      if (!part) continue;
      for (const f of solid(part, pl).faces) {
        expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
      }
    }
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s names its own words', (_, t) => {
    expect(t.ownWords.length).toBeGreaterThan(0);
    expect(t.ownWords.every((w) => w === w.toLowerCase() && w.trim() === w)).toBe(true);
  });
});
