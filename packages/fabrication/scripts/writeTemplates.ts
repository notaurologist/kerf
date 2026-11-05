import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exampleParts } from '../src/parts.ts';
import { printDocument, printSheet } from '../src/print.ts';
import { partSheet } from '../src/sheet.ts';

// Writes full-size templates of parts from a template's first worked example, as an HTML file to
// open in a browser and print at actual size:
//   pnpm --filter @kerf/fabrication write-templates swing-set-a-frame E
// The file goes to packages/fabrication/out/, which git ignores.

const [templateId, ...letters] = process.argv.slice(2);
if (!templateId || letters.length === 0) {
  console.error('Usage: write-templates <template-id> <part letter>...');
  process.exit(1);
}
const parts = exampleParts(templateId);
const sheets = letters.map((letter) => {
  const part = parts.find((p) => p.letter === letter);
  if (!part) throw new Error(`${templateId} has no part ${letter}`);
  return printSheet(partSheet(part));
});
const dir = join(import.meta.dirname, '..', 'out');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${templateId}-${letters.join('')}.html`);
writeFileSync(file, printDocument(`${templateId} templates`, sheets));
console.log(`Wrote ${file}, ${sheets.reduce((n, s) => n + s.pages.length, 0)} pages`);
