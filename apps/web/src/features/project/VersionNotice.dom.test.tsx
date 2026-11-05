// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../lib/types.ts';
import type { VersionReport } from '../../lib/versionReport.ts';
import { byText, click, mount, settle } from '../../test/dom.tsx';
import { projectFrom, storedSnapshots } from '../../test/projects.ts';
import { VersionNotice } from './VersionNotice.tsx';

// The version notice says why a plan can be regenerated from the project's version status, and
// loads what regenerating would change from a request of its own when it shows.

const [snapshot] = storedSnapshots;
if (!snapshot) throw new Error('fixture has a worked example');
const outputs = snapshot.outputs as { cutList: { length: string }[] };
/** What a newer version would store: the stored outputs with the first cut 1" longer. */
const lengthened = {
  ...outputs,
  cutList: outputs.cutList.map((row, i) => (i === 0 ? { ...row, length: '121"' } : row)),
};
const lengthenedFirstCut = {
  ok: true as const,
  outputs: lengthened,
  changes: [{ path: 'cutList[0].length', before: '120"', after: '121"' }],
  truncated: false,
};

/** The project's version status: the report less what regenerating would change. */
function statusOf(report: VersionReport): Project['version'] {
  if (report.status === 'behind' || report.status === 'carry-length') {
    const { regenerated: _, ...status } = report;
    return status;
  }
  return report;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * A server answering the version report, the project as another device saved it at revision 2,
 * and regenerations; it records what was asked for.
 */
function server(report: VersionReport, newer?: Project) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (input instanceof Request ? input.method : init?.method) ?? 'GET';
    const url = input instanceof Request ? input.url : String(input);
    const path = new URL(url, 'http://kerf.test').pathname;
    if (method === 'GET') {
      sent.push({ method, path, body: null });
      return path.endsWith('/version') ? json({ version: report }) : json(newer);
    }
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? '');
    const body = JSON.parse(raw) as { revision: number };
    sent.push({ method, path, body });
    if (newer && body.revision !== newer.revision) {
      return json({ error: 'stale-project', revision: newer.revision }, 409);
    }
    return json({ ...newer, revision: (newer?.revision ?? 1) + 1 });
  });
  return sent;
}

/** The notice for a project at revision 1 with this report, once the report has arrived. */
async function show(report: VersionReport, revision = 1) {
  const sent = server(report);
  const project = projectFrom(snapshot ?? null, {
    revision,
    version: statusOf(report),
    templateBehind: report.status === 'behind',
  });
  const { container } = mount(<VersionNotice project={project} onRegenerated={() => {}} />);
  for (let i = 0; i < 3; i++) await settle();
  return { text: container.textContent ?? '', html: container.innerHTML, sent };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VersionNotice', () => {
  it('shows nothing when the plan is current, and asks for no report', async () => {
    const { html, sent } = await show({ status: 'current', version: 1 }, 101);
    expect(html).toBe('');
    expect(sent).toEqual([]);
  });

  it('shows the regenerated plan with each changed value marked, and offers to regenerate', async () => {
    const { text, html, sent } = await show(
      { status: 'behind', storedVersion: 1, currentVersion: 2, regenerated: lengthenedFirstCut },
      102,
    );
    expect(sent.map((s) => s.path)).toEqual([`/api/projects/${projectFrom(null).id}/version`]);
    expect(text).toContain('This plan was made with version 1; the current version is 2.');
    expect(text).toContain('Regenerating would change 1 values');
    expect(text).toContain("These are version 2's values.");
    // textContent runs the value and the one it replaces together.
    expect(text).toMatch(/121"\s*was 120"/);
    expect(html.match(/<tr data-changed="">/g)).toHaveLength(1);
    expect(text).not.toMatch(/cutList|\[0\]/);
    expect(text).toContain('Regenerate with version 2');
  });

  it('asks for the report once per revision of the plan, however often it shows', async () => {
    const report: VersionReport = {
      status: 'behind',
      storedVersion: 1,
      currentVersion: 2,
      regenerated: lengthenedFirstCut,
    };
    const first = await show(report, 108);
    const again = await show(report, 108);
    expect(first.sent).toHaveLength(1);
    expect(again.sent).toEqual([]);
    expect(again.text).toContain('Regenerating would change 1 values');
    expect((await show(report, 109)).sent).toHaveLength(1);
  });

  it('offers to update a plan made with another carry length (#690)', async () => {
    const { text } = await show(
      {
        status: 'carry-length',
        version: 1,
        storedCarryLength: null,
        carryLength: 96,
        regenerated: lengthenedFirstCut,
      },
      103,
    );
    expect(text).toContain('Your carry length changed.');
    expect(text).toContain(
      `This plan's boards were planned with no carry length; you now have a carry length of 8' 0".`,
    );
    expect(text).toContain('These are the values with your carry length now.');
    expect(text).toContain('Update the shopping list');
    expect(text).not.toContain('template');
  });

  it('says when more values changed than it can list', async () => {
    const { text } = await show(
      {
        status: 'behind',
        storedVersion: 1,
        currentVersion: 2,
        regenerated: { ...lengthenedFirstCut, truncated: true },
      },
      104,
    );
    expect(text).toContain('Regenerating would change 1 or more values');
    expect(text).toContain('More values changed than can be listed');
  });

  it('gives the issues, and no regenerate button, when the new version cannot make the plan', async () => {
    const { text } = await show(
      {
        status: 'behind',
        storedVersion: 1,
        currentVersion: 2,
        regenerated: {
          ok: false,
          issues: [
            { code: 'x', message: 'Beam length is now at most 200".', params: ['beamLength'] },
          ],
        },
      },
      105,
    );
    expect(text).toContain('Version 2 cannot make a plan from this project');
    expect(text).toContain('Beam length is now at most 200".');
    expect(text).not.toContain('Regenerate with');
  });

  it('says a plan from a newer version is shown as stored, with no action', async () => {
    const { text, html, sent } = await show(
      { status: 'ahead', storedVersion: 3, currentVersion: 2 },
      106,
    );
    expect(text).toContain('newer than the version this app has (2)');
    expect(text).not.toContain('Regenerate');
    expect(html).toMatch(/^<div class="k-callout" data-tone="info" role="status">/);
    expect(sent).toEqual([]);
  });

  it('says why, and offers to try again, when the report cannot be loaded', async () => {
    let answer = json({ error: 'internal' }, 500);
    vi.stubGlobal('fetch', async () => answer);
    const project = projectFrom(snapshot ?? null, {
      revision: 107,
      version: { status: 'behind', storedVersion: 1, currentVersion: 2 },
      templateBehind: true,
    });
    const { container } = mount(<VersionNotice project={project} onRegenerated={() => {}} />);
    for (let i = 0; i < 3; i++) await settle();
    expect(container.textContent).toContain('What regenerating would change could not be loaded.');
    expect(container.textContent).not.toContain('Regenerate with');

    answer = json({
      version: {
        status: 'behind',
        storedVersion: 1,
        currentVersion: 2,
        regenerated: lengthenedFirstCut,
      },
    });
    await click(byText(container, 'button', 'Try again'));
    for (let i = 0; i < 3; i++) await settle();
    expect(container.textContent).toContain('Regenerating would change 1 values');
  });
});

// Regenerating from the version notice (#425): it names the revision the notice was computed at,
// so a save from another device since then is refused rather than regenerated unseen.
describe('regenerating from the version notice', () => {
  const report: VersionReport = {
    status: 'behind',
    storedVersion: 1,
    currentVersion: 2,
    regenerated: { ok: true, outputs: snapshot.outputs, changes: [], truncated: false },
  };
  const version = statusOf(report);
  const opened = projectFrom(snapshot, { revision: 1, version, templateBehind: true });
  const newer = projectFrom(snapshot, { revision: 2, version, templateBehind: true });

  it('sends the revision the notice was computed at, and offers the newer version when refused', async () => {
    const sent = server(report, newer);
    const regenerated = vi.fn();
    const shown: Project[] = [];
    const notice = (project: Project) => (
      <VersionNotice
        project={project}
        onRegenerated={regenerated}
        onNewer={(p) => {
          shown.push(p);
          view.rerender(notice(p));
        }}
      />
    );
    const view = mount(notice(opened));
    const { container } = view;
    for (let i = 0; i < 3; i++) await settle();

    await click(byText(container, 'button', 'Regenerate with version 2'));
    await click(byText(container, 'button', 'Regenerate'));
    await settle();
    const posts = () => sent.filter((s) => s.method === 'POST').map((s) => s.body);
    expect(posts()).toEqual([{ revision: 1 }]);
    expect(regenerated).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Changed on another device.');
    expect(container.textContent).toContain('Nothing was regenerated.');
    expect(container.textContent).not.toContain('Regenerate with version 2');

    await click(byText(container, 'button', 'Load the newer version'));
    for (let i = 0; i < 3; i++) await settle();
    expect(shown.map((p) => p.revision)).toEqual([2]);
    expect(container.textContent).not.toContain('Changed on another device.');

    await click(byText(container, 'button', 'Regenerate with version 2'));
    await click(byText(container, 'button', 'Regenerate'));
    await settle();
    expect(posts().at(-1)).toEqual({ revision: 2 });
    expect(regenerated).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }));
  });
});
