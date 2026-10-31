import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The inline theme script runs only while its hash is in the policy.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));

const policy: string = vercel.headers
  .flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers)
  .find((h: { key: string }) => h.key === 'Content-Security-Policy').value;

describe('the web Content-Security-Policy', () => {
  it('allows each inline script in index.html by the hash of what it holds now', () => {
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
    expect(inline.length).toBeGreaterThan(0);
    for (const script of inline) {
      const hash = createHash('sha256').update(script).digest('base64');
      expect(policy).toContain(`'sha256-${hash}'`);
    }
  });

  it('allows no framing, plugins, or other sites', () => {
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('unsafe-inline');
  });
});

describe('deployments', () => {
  // A preview gets no database or password, so its API cannot start; each deploy also counts
  // toward the plan's daily limit. `**` matches branch names with slashes, such as `claude/…`.
  it('come from main only', () => {
    expect(vercel.git.deploymentEnabled).toEqual({ '**': false, main: true });
  });
});
