import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import rootConfig from '../../../vitest.config.ts';
import { root } from './ciPaths.ts';

// The root config runs each workspace package as its own Vitest project, from the package's own
// config. A project named by a path keeps only its own settings: the root's reach only projects
// written inline, and an inline project cannot also load its package's config, which the web app
// needs for its Vite plugins. So each package's config repeats the settings every test needs, and
// this checks that none is missing, including in a package added later.

interface PackageConfig {
  plugins?: unknown[];
  test?: { expect?: { requireAssertions?: boolean }; setupFiles?: string | string[] };
}

/** Every folder the root config's `projects` patterns name, relative to the repository root. */
function projectFolders(): string[] {
  const patterns = rootConfig.test?.projects ?? [];
  return patterns.flatMap((pattern) => {
    if (typeof pattern !== 'string' || !/^[\w-]+\/\*$/.test(pattern)) {
      throw new Error(`Expected projects like "packages/*", found ${JSON.stringify(pattern)}`);
    }
    const parent = pattern.slice(0, -2);
    return readdirSync(join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}`);
  });
}

function pluginNames(plugins: unknown[] = []): string[] {
  return plugins.flat(Infinity).flatMap((p) => {
    const name = (p as { name?: unknown } | null)?.name;
    return typeof name === 'string' ? [name] : [];
  });
}

describe('every workspace package', () => {
  const folders = projectFolders();

  it('is found', () => {
    expect(folders).toEqual(expect.arrayContaining(['apps/api', 'apps/web', 'packages/core']));
  });

  it.each(folders)('%s has a Vitest config with the shared settings', async (folder) => {
    const file = ['vitest.config.ts', 'vite.config.ts']
      .map((name) => join(root, folder, name))
      .find((path) => existsSync(path));
    expect(file, `${folder} has no vitest.config.ts or vite.config.ts`).toBeDefined();
    const config = ((await import(file as string)) as { default: PackageConfig }).default;
    expect(typeof config, `${folder}'s config exports an object`).toBe('object');
    const setupFiles = [config.test?.setupFiles ?? []].flat().map((f) => resolve(root, folder, f));
    expect({
      folder,
      requireAssertions: config.test?.expect?.requireAssertions,
      ciPathsSetup: setupFiles.includes(join(root, 'apps/api/test/ciPaths.setup.ts')),
      recordsDataImports: pluginNames(config.plugins).includes('kerf-record-data-imports'),
    }).toEqual({ folder, requireAssertions: true, ciPathsSetup: true, recordsDataImports: true });
  });
});
