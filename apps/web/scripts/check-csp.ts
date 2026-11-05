import { readFileSync } from 'node:fs';
import { inlineScriptSources, webHeader } from './csp.ts';

// Run by CI after the build: each inline script in the built page must be allowed by its hash.

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
const policy = webHeader(vercel, 'Content-Security-Policy');
const sources = inlineScriptSources(html);
const missing = sources.filter((source) => !policy.includes(source));

if (sources.length === 0) {
  console.error('check-csp: dist/index.html has no inline script; expected the theme script.');
  process.exitCode = 1;
} else if (missing.length > 0) {
  console.error(
    `check-csp: dist/index.html has inline scripts the policy in vercel.json does not allow: ${missing.join(', ')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `check-csp: the policy allows all ${sources.length} inline scripts in dist/index.html.`,
  );
}
