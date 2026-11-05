import { createHash } from 'node:crypto';

// The inline theme script runs only while its hash is in the policy. The test checks the source
// index.html and CI checks the built one (check-csp.ts), which Vite writes.

type VercelConfig = { headers: { headers: { key: string; value: string }[] }[] };

/** A header vercel.json sets on the web app's pages. */
export function webHeader(vercel: VercelConfig, key: string): string {
  const header = vercel.headers.flatMap((rule) => rule.headers).find((h) => h.key === key);
  if (!header) throw new Error(`vercel.json sets no ${key} header.`);
  return header.value;
}

/** The CSP source for each inline script in a page: each script element without a src. */
export function inlineScriptSources(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc\s*=/.test(m[1] ?? ''))
    .map(
      (m) =>
        `'sha256-${createHash('sha256')
          .update(m[2] ?? '')
          .digest('base64')}'`,
    );
}
