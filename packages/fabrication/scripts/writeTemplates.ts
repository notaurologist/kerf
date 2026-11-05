import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { partTemplates } from '../src/ends.ts';
import { exampleParts } from '../src/parts.ts';
import { printDocument, printSheet } from '../src/print.ts';

// Writes full-size templates of parts from a template's first worked example, as an HTML file to
// open in a browser and print at actual size. With no letters, every part with a shaped end:
//   pnpm --filter @kerf/fabrication write-templates swing-set-a-frame [E D ...]
// The file goes to packages/fabrication/out/, which git ignores.

const [templateId, ...letters] = process.argv.slice(2);
if (!templateId) {
  console.error('Usage: write-templates <template-id> [part letter...]');
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
const sheets = chosen.flatMap((part) => partTemplates(part).map((sheet) => printSheet(sheet)));
const dir = join(import.meta.dirname, '..', 'out');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${templateId}${letters.length ? `-${letters.join('')}` : ''}.html`);
writeFileSync(file, printDocument(`${templateId} templates`, sheets));
console.log(
  `Wrote ${file}: ${sheets.length} templates, ${sheets.reduce((n, s) => n + s.pages.length, 0)} pages`,
);
