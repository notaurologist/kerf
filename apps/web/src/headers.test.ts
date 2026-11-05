import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inlineScriptSources, webHeader } from '../scripts/csp.ts';

// The inline theme script runs only while its hash is in the policy. CI checks the built page too.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));

const policy = webHeader(vercel, 'Content-Security-Policy');

describe('the web Content-Security-Policy', () => {
  it('allows each inline script in index.html by the hash of what it holds now', () => {
    const sources = inlineScriptSources(html);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(policy).toContain(source);
  });

  it('allows no framing, plugins, or other sites', () => {
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('unsafe-inline');
  });
});

describe('the web Permissions-Policy', () => {
  const permissions = webHeader(vercel, 'Permissions-Policy');

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
