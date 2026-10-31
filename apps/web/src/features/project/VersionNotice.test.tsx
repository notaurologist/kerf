import { describe, expect, it } from 'vitest';
import type { Project } from '../../lib/types.ts';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { render, renderText } from '../../test/render.tsx';
import { VersionNotice } from './VersionNotice.tsx';

const snapshot = storedSnapshots[0] ?? null;
const outputs = snapshot?.outputs as { cutList: { length: string }[] };
/** What a newer version would store: the stored outputs with the first cut 1" longer. */
const lengthened = {
  ...outputs,
  cutList: outputs.cutList.map((row, i) => (i === 0 ? { ...row, length: '121"' } : row)),
};
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

  it('shows the regenerated plan with each changed value marked, and offers to regenerate', () => {
    const version = {
      status: 'behind' as const,
      storedVersion: 1,
      currentVersion: 2,
      regenerated: {
        ok: true as const,
        outputs: lengthened,
        changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
        truncated: false,
      },
    };
    const text = show(version);
    const html = render(<VersionNotice project={withReport(version)} onRegenerated={() => {}} />);
    expect(text).toContain('This plan was made with version 1; the current version is 2.');
    expect(text).toContain('Regenerating would change 1 values');
    expect(text).toContain("These are version 2's values.");
    expect(text).toContain('121" was 120"');
    expect(html.match(/<tr data-changed="">/g)).toHaveLength(1);
    expect(text).not.toMatch(/cutList|\[0\]/);
    expect(text).toContain('Regenerate with version 2');
  });

  it('says when more values changed than it can list', () => {
    const text = show({
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: {
        ok: true,
        outputs: lengthened,
        changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
        truncated: true,
      },
    });
    expect(text).toContain('Regenerating would change 1 or more values');
    expect(text).toContain('More values changed than can be listed');
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
    const html = render(
      <VersionNotice
        project={withReport({ status: 'ahead', storedVersion: 3, currentVersion: 2 })}
        onRegenerated={() => {}}
      />,
    );
    expect(html).toMatch(/^<div class="k-info" role="status">/);
  });
});
