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
    // Any script element without a src, whatever its other attributes.
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter((m) => !/\bsrc\s*=/.test(m[1] ?? ''))
      .map((m) => m[2] ?? '');
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

describe('the web Permissions-Policy', () => {
  const permissions: string = vercel.headers
    .flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers)
    .find((h: { key: string }) => h.key === 'Permissions-Policy').value;

  // Building mode keeps the screen on, and the backup is saved through the share sheet.
  it('allows the screen wake lock and sharing to the site itself, and nothing else asked for', () => {
    expect(permissions).toContain('screen-wake-lock=(self)');
    expect(permissions).toContain('web-share=(self)');
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(permissions).toContain(`${feature}=()`);
    }
  });
});

describe('deployments', () => {
  // A preview gets no database or password, so its API cannot start; each deploy also counts
  // toward the plan's daily limit. `**` matches branch names with slashes, such as `claude/…`.
  it('come from main only', () => {
    expect(vercel.git.deploymentEnabled).toEqual({ '**': false, main: true });
  });
});
