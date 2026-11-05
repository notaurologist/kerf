import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findTemplate } from '@kerf/core';
import { removeHiddenLines } from '../src/hidden.ts';
import { lineArtSvg } from '../src/lineArt.ts';

// Writes each template example's isometric and exploded views as line art with hidden lines
// removed, and prints how long each took:
//   pnpm --filter @kerf/fabrication write-line-art [template-id...]
// The files go to packages/fabrication/out/line-art/, which git ignores.

const ids = process.argv.slice(2);
const templates = (ids.length ? ids : ['swing-set-a-frame', 'record-cabinet', 'workbench']).map(
  (id) => {
    const t = findTemplate(id);
    if (!t) throw new Error(`No template ${id}`);
    return t;
  },
);
const dir = join(import.meta.dirname, '..', 'out', 'line-art');
mkdirSync(dir, { recursive: true });
console.log('| Template | Example | View | Edges in | Lines out | ms |');
console.log('|---|---|---|---|---|---|');
for (const template of templates) {
  template.examples.forEach((example, i) => {
    const result = template.generate(example.params, example.structuralInputs);
    if (!result.ok) throw new Error(`${template.id} example ${i} did not generate`);
    const drawings = template.drawings(result.output);
    for (const [view, drawing] of [
      ['isometric', drawings.isometric],
      ['exploded', drawings.exploded],
    ] as const) {
      if (!drawing) continue;
      const edges = drawing.primitives.filter((p) => p.kind === 'line' && p.role === 'visible');
      const start = performance.now();
      const art = removeHiddenLines(drawing);
      const ms = performance.now() - start;
      const lines = art.primitives.filter((p) => p.kind === 'line' && p.role === 'visible');
      console.log(
        `| ${template.id} | ${example.name} | ${view} | ${edges.length} | ${lines.length} | ${ms.toFixed(0)} |`,
      );
      if (i === 0) writeFileSync(join(dir, `${template.id}-${view}.svg`), lineArtSvg(art));
    }
  });
}
