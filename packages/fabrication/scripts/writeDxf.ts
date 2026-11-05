import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { partDxf } from '../src/dxf.ts';
import { exampleParts } from '../src/parts.ts';

// Writes one DXF file per part from a template's first worked example, for a CAM program. With no
// letters, every part:
//   pnpm --filter @kerf/fabrication write-dxf swing-set-a-frame [E D ...]
// The files go to packages/fabrication/out/dxf/, which git ignores.

const [templateId, ...letters] = process.argv.slice(2);
if (!templateId) {
  console.error('Usage: write-dxf <template-id> [part letter...]');
  process.exit(1);
}
const parts = exampleParts(templateId);
const chosen =
  letters.length === 0
    ? parts
    : letters.map((letter) => {
        const part = parts.find((p) => p.letter === letter);
        if (!part) throw new Error(`${templateId} has no part ${letter}`);
        return part;
      });
const dir = join(import.meta.dirname, '..', 'out', 'dxf');
mkdirSync(dir, { recursive: true });
for (const part of chosen) {
  const file = join(dir, `${templateId}-${part.letter}.dxf`);
  writeFileSync(file, partDxf(part));
  console.log(`Wrote ${file}`);
}
