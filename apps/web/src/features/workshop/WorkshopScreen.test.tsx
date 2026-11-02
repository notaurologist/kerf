// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { BackupHost } from '../../lib/backup.ts';
import { byText, click, mount } from '../../test/dom.tsx';
import { WorkshopScreen } from './WorkshopScreen.tsx';

const file = new File(['{}'], 'kerf-2026-11-02.json', { type: 'application/json' });
const fetched = async () => ({ ok: true as const, file });

function homeScreen(share: (data: ShareData) => Promise<void>) {
  const host: BackupHost = { standalone: true, canShare: () => true, share: vi.fn(share) };
  return { host, backupHost: () => host };
}

/** Clicks the download link and says whether its default action, the download, was stopped. */
async function download(container: HTMLElement) {
  const link = byText<HTMLAnchorElement>(container, 'a', 'Download a backup');
  let prevented = false;
  // On the document, so it runs after React's handler on the root; then stops the navigation.
  const listener = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('click', listener);
  await click(link);
  document.removeEventListener('click', listener);
  return prevented;
}

describe('WorkshopScreen', () => {
  it('links to My toolbox, the glossary, the trash, and the download of every project', () => {
    const { container } = mount(<WorkshopScreen onLogOut={() => {}} />);
    const links = [...container.querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['My toolbox', '#/tools'],
      ['Glossary', '#/glossary'],
      ['Deleted projects', '#/trash'],
      ['Download a backup', '/api/export'],
    ]);
    expect(container.querySelector('a[href="/api/export"]')?.hasAttribute('download')).toBe(true);
  });

  it('has the theme in words and Log out', async () => {
    const onLogOut = vi.fn();
    const { container } = mount(<WorkshopScreen onLogOut={onLogOut} />);
    const theme = container.querySelector('select');
    expect([...(theme?.options ?? [])].map((o) => o.textContent)).toEqual([
      'System theme',
      'Light theme',
      'Dark theme',
    ]);
    const logOut = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Log out',
    );
    await click(logOut as HTMLButtonElement);
    expect(onLogOut).toHaveBeenCalledOnce();
  });

  it('downloads with the link in a browser', async () => {
    const fetchBackup = vi.fn(fetched);
    const { container } = mount(
      <WorkshopScreen
        onLogOut={() => {}}
        backupHost={() => ({ standalone: false })}
        fetchBackup={fetchBackup}
      />,
    );
    expect(await download(container)).toBe(false);
    expect(fetchBackup).not.toHaveBeenCalled();
  });

  it('from the Home Screen, hands the backup to the share sheet in place of following the link', async () => {
    const { host, backupHost } = homeScreen(async () => {});
    const { container } = mount(
      <WorkshopScreen onLogOut={() => {}} backupHost={backupHost} fetchBackup={fetched} />,
    );
    expect(await download(container)).toBe(true);
    expect(host.share).toHaveBeenCalledWith({ files: [file] });
    expect(container.textContent).not.toContain('Preparing');
  });

  it('asks for a second tap when the share sheet will not open after the fetch', async () => {
    let refuse = true;
    const { host, backupHost } = homeScreen(async () => {
      if (refuse) throw new DOMException('no gesture', 'NotAllowedError');
    });
    const fetchBackup = vi.fn(fetched);
    const { container } = mount(
      <WorkshopScreen onLogOut={() => {}} backupHost={backupHost} fetchBackup={fetchBackup} />,
    );
    await download(container);
    expect(container.textContent).toContain('Tap Download a backup again');
    refuse = false;
    await download(container);
    expect(fetchBackup).toHaveBeenCalledOnce();
    expect(host.share).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('Tap Download a backup again');
  });

  it('shows why when the backup cannot be fetched', async () => {
    const { backupHost } = homeScreen(async () => {});
    const { container } = mount(
      <WorkshopScreen
        onLogOut={() => {}}
        backupHost={backupHost}
        fetchBackup={async () => ({
          ok: false as const,
          failure: { message: 'Kerf could not reach the server.', connection: true },
        })}
      />,
    );
    await download(container);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'could not reach the server',
    );
  });
});
