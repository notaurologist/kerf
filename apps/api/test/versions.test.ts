import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Versions are pinned exactly (decisions 0002 and 0011), so a range added by hand fails here.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const manifests = [
  'package.json',
  ...['apps', 'packages'].flatMap((folder) =>
    readdirSync(join(root, folder)).map((name) => `${folder}/${name}/package.json`),
  ),
];
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

describe('dependency versions', () => {
  it.each(manifests)('are exact in %s', (path) => {
    const manifest = JSON.parse(readFileSync(join(root, path), 'utf8'));
    const declared = SECTIONS.flatMap((section) =>
      Object.entries((manifest[section] ?? {}) as Record<string, string>),
    );
    expect(declared.length).toBeGreaterThan(0);
    const loose = declared.filter(([, v]) => v !== 'workspace:*' && !EXACT.test(v));
    expect(loose).toEqual([]);
  });

  it('pin pnpm exactly and refuse an unsupported Node', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(manifest.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
    expect(workspace).toMatch(/^engineStrict: true$/m);
    expect(workspace).toMatch(/^saveExact: true$/m);
  });
});
