import { useState } from 'react';
import type { Failure } from '../ui/index.ts';
import { api, failureOf, send } from './api.ts';

// Download a backup fetches the file first, so a failed request, such as a lost login, shows a
// notice instead of saving the error as the backup. In a browser the fetched file is then saved as
// a download. In an app opened from the iPhone's Home Screen, a download puts the file over the
// whole app with no way back, so there it is handed to the share sheet, where Save to Files keeps
// it.

/** The parts of the browser this needs, so tests can pass their own. */
export interface BackupHost {
  standalone: boolean;
  /** Saves the file as a download. */
  save: (file: File) => void;
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

export type BackupState =
  | { state: 'idle' }
  | { state: 'preparing' }
  // The share sheet refused to open this long after the tap, so the next tap opens it.
  | { state: 'ready'; file: File }
  | { state: 'failed'; failure: Failure };

/** Whether the page is running as an app opened from the Home Screen. */
function isStandalone(): boolean {
  // `navigator.standalone` is Safari's own and missing from the DOM types.
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

/** Saves the file through a link to it, as the browser's own download. */
function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  // Some browsers start the download after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function browserHost(): BackupHost {
  return {
    standalone: isStandalone(),
    save: saveFile,
    canShare: navigator.canShare?.bind(navigator),
    share: navigator.share?.bind(navigator),
  };
}

const NO_SHARE: Failure = {
  message:
    'This device cannot save the backup from here. Open Kerf in Safari to download it. Safari has its own login, so log in there too.',
  connection: false,
};

/** Opens the share sheet with the file; returns the state to show after it. */
export async function shareBackup(
  host: Pick<BackupHost, 'canShare' | 'share'>,
  file: File,
): Promise<BackupState> {
  const data = { files: [file] };
  if (!host.share || !host.canShare?.(data)) return { state: 'failed', failure: NO_SHARE };
  try {
    await host.share(data);
    return { state: 'idle' };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'AbortError') return { state: 'idle' };
    if (name === 'NotAllowedError') return { state: 'ready', file };
    return { state: 'failed', failure: NO_SHARE };
  }
}

const INCOMPLETE: Failure = {
  message: 'The backup came back incomplete. Try again.',
  connection: false,
};

/**
 * Fetches every project, trashed ones included, and the tool rows as the backup file. The API streams it, so a connection
 * lost partway leaves text that does not parse, and that is reported rather than saved.
 */
export async function fetchBackup(
  client = api,
): Promise<{ ok: true; file: File } | { ok: false; failure: Failure }> {
  const result = await send(client.api.export.$get());
  if (!result.ok) return { ok: false, failure: failureOf(result.error) };
  const backup: unknown = result.value;
  if (
    typeof backup !== 'object' ||
    backup === null ||
    !('kind' in backup) ||
    backup.kind !== 'kerf-export' ||
    !('exportedAt' in backup) ||
    typeof backup.exportedAt !== 'string'
  ) {
    return { ok: false, failure: INCOMPLETE };
  }
  const name = `kerf-${backup.exportedAt.slice(0, 10)}.json`;
  return {
    ok: true,
    file: new File([JSON.stringify(backup)], name, { type: 'application/json' }),
  };
}

/**
 * The download link's click handler and what to show beside it. The link's own download is
 * stopped: in a browser the fetched backup is saved as a download, and from the Home Screen it
 * goes to the share sheet.
 */
export function useBackup(
  host: () => BackupHost = browserHost,
  fetchFile: typeof fetchBackup = fetchBackup,
) {
  const [backup, setBackup] = useState<BackupState>({ state: 'idle' });

  const onDownload = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (backup.state === 'preparing') return;
    const current = host();
    if (backup.state === 'ready') {
      setBackup(await shareBackup(current, backup.file));
      return;
    }
    setBackup({ state: 'preparing' });
    const fetched = await fetchFile();
    if (!fetched.ok) {
      setBackup({ state: 'failed', failure: fetched.failure });
      return;
    }
    if (current.standalone) {
      setBackup(await shareBackup(current, fetched.file));
      return;
    }
    current.save(fetched.file);
    setBackup({ state: 'idle' });
  };

  return { backup, onDownload };
}
