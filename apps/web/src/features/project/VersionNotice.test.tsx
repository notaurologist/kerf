import { describe, expect, it } from 'vitest';
import type { Project } from '../../lib/types.ts';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, renderText } from '../../test/render.tsx';
import { reportValue, VersionNotice } from './VersionNotice.tsx';

const snapshot = storedSnapshots[0] ?? null;
const withReport = (version: Project['version']) =>
  projectFrom(snapshot, { version, templateBehind: version?.status === 'behind' });
const show = (version: Project['version']) =>
  renderText(<VersionNotice project={withReport(version)} onRegenerated={() => {}} />);

describe('VersionNotice', () => {
  it('shows nothing when the plan is current', () => {
    expect(
      render(
        <VersionNotice
          project={withReport({ status: 'current', version: 1 })}
          onRegenerated={() => {}}
        />,
      ),
    ).toBe('');
  });

  it('lists what regenerating would change, before and after, and offers to regenerate', () => {
    const text = show({
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: {
        ok: true,
        changes: [
          { path: 'cutList[0].length', before: '120"', after: '121"' },
          { path: 'lumber.boards[0].offcut', before: 22.875, after: 21.875 },
          { path: 'design.flags[3]', after: { category: 'load-bearing' } },
        ],
        truncated: false,
      },
    });
    expect(text).toContain('This plan was made with version 1; the current version is 2.');
    expect(text).toContain('Regenerating would change 3 values');
    expect(text).toContain('cutList[0].length 120" 121"');
    expect(text).toContain('lumber.boards[0].offcut 22.9 21.9');
    expect(text).toContain('design.flags[3] (none)');
    expect(text).toContain('Regenerate with version 2');
  });

  it('says when the list of changes is cut short', () => {
    const text = show({
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: { ok: true, changes: [{ path: 'a', before: 1, after: 2 }], truncated: true },
    });
    expect(text).toContain('Regenerating would change 1 or more values');
    expect(text).toContain('Only the first 1 changes are listed.');
  });

  it('gives the issues, and no regenerate button, when the new version cannot make the plan', () => {
    const text = show({
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: {
        ok: false,
        issues: [
          { code: 'x', message: 'Beam length is now at most 200".', params: ['beamLength'] },
        ],
      },
    });
    expect(text).toContain('Version 2 cannot make a plan from this project');
    expect(text).toContain('Beam length is now at most 200".');
    expect(text).not.toContain('Regenerate with');
  });

  it('says a plan from a newer version is shown as stored, with no action', () => {
    const text = show({ status: 'ahead', storedVersion: 3, currentVersion: 2 });
    expect(text).toContain('newer than the version this app has (2)');
    expect(text).not.toContain('Regenerate');
  });
});

describe('reportValue', () => {
  it('shows text as stored and numbers through core', () => {
    expect(reportValue('8-15/16"')).toBe('8-15/16"');
    expect(reportValue(138.35412783771903)).toBe('138.4');
    expect(reportValue(undefined)).toBe('(none)');
  });
});
