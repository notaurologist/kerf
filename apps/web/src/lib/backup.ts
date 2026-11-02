import { useState } from 'react';
import type { Failure } from '../ui/index.ts';
import { api, failureOf, send } from './api.ts';

// Download a backup is a plain download link, which works in a browser. In an app opened from the
// iPhone's Home Screen, following it puts the file over the whole app with no way back, so there
// the backup is fetched and handed to the share sheet instead, where Save to Files keeps it.

/** The parts of the browser this needs, so tests can pass their own. */
export interface BackupHost {
  standalone: boolean;
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

function browserHost(): BackupHost {
  return {
    standalone: isStandalone(),
    canShare: navigator.canShare?.bind(navigator),
    share: navigator.share?.bind(navigator),
  };
}

const NO_SHARE: Failure = {
  message: 'This device cannot save the backup from here. Open Kerf in Safari to download it.',
  connection: false,
};

/** Opens the share sheet with the file; returns the state to show after it. */
export async function shareBackup(host: BackupHost, file: File): Promise<BackupState> {
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

/** Fetches every project and the tools as the backup file. */
export async function fetchBackup(): Promise<
  { ok: true; file: File } | { ok: false; failure: Failure }
> {
  const result = await send(api.api.export.$get());
  if (!result.ok) return { ok: false, failure: failureOf(result.error) };
  const name = `kerf-${result.value.exportedAt.slice(0, 10)}.json`;
  return {
    ok: true,
    file: new File([JSON.stringify(result.value)], name, { type: 'application/json' }),
  };
}

/**
 * The download link's click handler and what to show beside it. In a browser the link downloads
 * as usual; from the Home Screen the backup goes to the share sheet.
 */
export function useBackup(
  host: () => BackupHost = browserHost,
  fetchFile: typeof fetchBackup = fetchBackup,
) {
  const [backup, setBackup] = useState<BackupState>({ state: 'idle' });

  const onDownload = async (event: { preventDefault(): void }) => {
    const current = host();
    if (!current.standalone) return;
    event.preventDefault();
    if (backup.state === 'preparing') return;
    if (backup.state === 'ready') {
      setBackup(await shareBackup(current, backup.file));
      return;
    }
    setBackup({ state: 'preparing' });
    const fetched = await fetchFile();
    setBackup(
      fetched.ok
        ? await shareBackup(current, fetched.file)
        : { state: 'failed', failure: fetched.failure },
    );
  };

  return { backup, onDownload };
}
