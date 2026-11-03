import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ciFilters, pullRequestFilter, reads, root, runsCi, workflow } from './ciPaths.ts';

const filters = ciFilters(readFileSync(workflow, 'utf8'));

describe('CI path filters', () => {
  it('are the same for pushes to main and pull requests', () => {
    expect(filters.pull_request?.length).toBeGreaterThan(0);
    expect(filters.push).toEqual(filters.pull_request);
  });

  it('skip Markdown and docs/ and run on everything else', () => {
    const filter = pullRequestFilter();
    expect(runsCi('README.md', filter)).toBe(false);
    expect(runsCi('apps/web/notes.md', filter)).toBe(false);
    expect(runsCi('docs/PRODUCT.md', filter)).toBe(false);
    expect(runsCi('docs/templates/diagram.svg', filter)).toBe(false);
    expect(runsCi('apps/web/src/ui/styles/styles.test.ts', filter)).toBe(true);
    expect(runsCi('.github/workflows/ci.yml', filter)).toBe(true);
    expect(runsCi('package.json', filter)).toBe(true);
  });

  it('run on the design system doc, whose breakpoints styles.test.ts reads', () => {
    expect(runsCi('docs/design/system.md', pullRequestFilter())).toBe(true);
  });

  it('let a later pattern override an earlier one', () => {
    expect(runsCi('docs/a.md', ['**', '!docs/**'])).toBe(false);
    expect(runsCi('docs/a.md', ['**', '!docs/**', 'docs/a.md'])).toBe(true);
    expect(runsCi('a/b.ts', ['*.ts'])).toBe(false);
    expect(runsCi('a/b.ts', ['**.ts'])).toBe(true);
  });

  it('refuse paths-ignore, which cannot list a doc back in', () => {
    const yaml = 'on:\n  pull_request:\n    paths-ignore:\n      - "docs/**"\n';
    expect(() => ciFilters(yaml)).toThrow(/paths-ignore/);
  });
});

describe('reads during a test', () => {
  it('are recorded relative to the repository root', () => {
    readFileSync(join(root, 'package.json'), 'utf8');
    readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    expect(reads()).toContain('package.json');
    expect(reads()).toContain('apps/api/package.json');
  });

  it('include a doc CI skips, which fails the test file', () => {
    const doc = 'docs/PRODUCT.md';
    readFileSync(join(root, doc), 'utf8');
    expect(reads()).toContain(doc);
    expect(runsCi(doc, pullRequestFilter())).toBe(false);
    // Forgotten here so this file passes; any other test file reading it would fail.
    reads().delete(doc);
  });
});
