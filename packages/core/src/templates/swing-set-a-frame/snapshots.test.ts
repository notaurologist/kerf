import { describe, expect, it } from 'vitest';
import type { TemplateDefinition } from '../../model/definition.ts';
import { Part } from '../../model/types.ts';
import { readSnapshot } from '../../snapshot/snapshot.ts';
import { swingSetAFrame } from './definition.ts';
import { drawnPart } from './outputs.ts';

// What upgrading a stored swing-set plan keeps (decision 0014). The guarantees every template's
// fixtures share are in contract.test.ts.

const FIXTURES = Object.entries(
  import.meta.glob<readonly unknown[]>('./snapshots/v*.json', { eager: true, import: 'default' }),
);

const templates = [swingSetAFrame as TemplateDefinition];

describe('swing-set snapshot fixtures', () => {
  it.each(FIXTURES)('reads %s with its parameters unchanged and every part drawable', (_, f) => {
    for (const stored of f) {
      const read = readSnapshot(templates, stored);
      if (!read.ok) throw new Error(read.message);
      // The swing set's upgrades have never touched its parameters.
      expect(read.snapshot.params).toEqual((stored as { params: unknown }).params);
      const outputs = swingSetAFrame.storedOutputs.parse(read.snapshot.outputs);
      for (const part of outputs.design.parts) Part.parse(drawnPart(part));
    }
  });
});
