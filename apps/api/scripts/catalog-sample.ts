import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSnapshot, TEMPLATES, type TemplateDefinition } from '@kerf/core';

/**
 * The design system catalog's sample values, as the API would send them: the first template's
 * worked examples as snapshots, the first again with no structural inputs, and the first one's
 * drawings. The web app generates nothing (AGENTS.md, hard rule 6), so the catalog reads these from
 * a committed file.
 */
export function catalogSample() {
  const template = TEMPLATES[0] as TemplateDefinition;
  const snapshot = (params: unknown, structuralInputs: unknown) => {
    const result = createSnapshot(template, params, structuralInputs);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    return result.output;
  };
  const first = template.examples[0];
  const last = template.examples[template.examples.length - 1];
  const firstSnapshot = snapshot(first?.params, first?.structuralInputs);
  return {
    first: firstSnapshot,
    last: snapshot(last?.params, last?.structuralInputs),
    unentered: snapshot(first?.params, {}),
    drawings: template.drawings(template.storedOutputs.parse(firstSnapshot.outputs)),
  };
}

export const catalogSampleFile = join(
  dirname(fileURLToPath(import.meta.url)),
  ...['..', '..', 'web', 'src', 'ui', 'catalog-sample.json'],
);
