import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECKED_PATHS, needsChecks, reads, root, runsCi } from './ciPaths.ts';

const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

describe('CI checked paths', () => {
  it('skip Markdown and docs/ and run on everything else', () => {
    expect(runsCi('README.md', CHECKED_PATHS)).toBe(false);
    expect(runsCi('apps/web/notes.md', CHECKED_PATHS)).toBe(false);
    expect(runsCi('docs/PRODUCT.md', CHECKED_PATHS)).toBe(false);
    expect(runsCi('docs/templates/diagram.svg', CHECKED_PATHS)).toBe(false);
    expect(runsCi('apps/web/src/ui/styles/styles.test.ts', CHECKED_PATHS)).toBe(true);
    expect(runsCi('.github/workflows/ci.yml', CHECKED_PATHS)).toBe(true);
    expect(runsCi('package.json', CHECKED_PATHS)).toBe(true);
  });

  it('run on the design system doc, whose breakpoints styles.test.ts reads', () => {
    expect(runsCi('docs/design/system.md', CHECKED_PATHS)).toBe(true);
  });

  it('let a later pattern override an earlier one', () => {
    expect(runsCi('docs/a.md', ['**', '!docs/**'])).toBe(false);
    expect(runsCi('docs/a.md', ['**', '!docs/**', 'docs/a.md'])).toBe(true);
    expect(runsCi('a/b.ts', ['*.ts'])).toBe(false);
    expect(runsCi('a/b.ts', ['**.ts'])).toBe(true);
  });

  it('need the checks when any changed file is code, or when the changes are unknown', () => {
    expect(needsChecks(['docs/PRODUCT.md', 'README.md'])).toBe(false);
    expect(needsChecks(['docs/PRODUCT.md', 'apps/api/src/app.ts'])).toBe(true);
    expect(needsChecks(['docs/design/system.md'])).toBe(true);
    expect(needsChecks([])).toBe(true);
  });
});

describe('the CI workflow', () => {
  // Main requires the check job (0010). A workflow-level paths filter would never start it on a
  // docs-only pull request, which would then wait on a check that never reports.
  it('starts on every pull request and push to main, with no paths filter', () => {
    expect(workflow).not.toMatch(/^\s+paths(-ignore)?:/m);
    expect(workflow).toMatch(/^ {2}pull_request:\s*$/m);
  });

  // A step that ran on a docs-only change before pnpm install would fail there.
  it('runs every step after deciding only when the change needs the checks', () => {
    const steps = workflow
      .slice(workflow.indexOf('id: changes'))
      .split(/\n {6}- /)
      .slice(1);
    expect(steps.length).toBeGreaterThan(5);
    for (const step of steps) expect(step).toContain("if: steps.changes.outputs.run == 'true'");
  });
});

describe('reads during a test', () => {
  it('are recorded relative to the repository root', () => {
    readFileSync(join(root, 'package.json'), 'utf8');
    readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    expect(reads()).toContain('package.json');
    expect(reads()).toContain('apps/api/package.json');
  });

  it('include files imported as JSON or ?raw, which Vite reads outside the test', async () => {
    await import('../tsconfig.json', { with: { type: 'json' } });
    // A variable, as TypeScript has no type for `?raw` outside Vite's client types.
    const raw = './fixtures.ts?raw';
    await import(raw);
    expect(reads()).toContain('apps/api/tsconfig.json');
    expect(reads()).toContain('apps/api/test/fixtures.ts');
  });

  it('include a doc CI skips, which fails the test file', () => {
    const doc = 'docs/PRODUCT.md';
    readFileSync(join(root, doc), 'utf8');
    expect(reads()).toContain(doc);
    expect(runsCi(doc, CHECKED_PATHS)).toBe(false);
    // Forgotten here so this file passes; any other test file reading it would fail.
    reads().delete(doc);
  });
});
