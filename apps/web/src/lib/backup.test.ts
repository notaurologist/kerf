import { describe, expect, it, vi } from 'vitest';
import { createClient } from './api.ts';
import { fetchBackup, shareBackup } from './backup.ts';

const file = new File(['{}'], 'kerf-2026-11-02.json', { type: 'application/json' });

function host(share: (data: ShareData) => Promise<void>, canShare = true) {
  return { standalone: true, canShare: () => canShare, share: vi.fn(share) };
}

describe('shareBackup', () => {
  it('hands the file to the share sheet and goes back to idle', async () => {
    const h = host(async () => {});
    expect(await shareBackup(h, file)).toEqual({ state: 'idle' });
    expect(h.share).toHaveBeenCalledWith({ files: [file] });
  });

  it('goes back to idle when the share sheet is closed without saving', async () => {
    const h = host(async () => {
      throw new DOMException('closed', 'AbortError');
    });
    expect(await shareBackup(h, file)).toEqual({ state: 'idle' });
  });

  it('keeps the file for the next tap when the share sheet refuses to open after the fetch', async () => {
    const h = host(async () => {
      throw new DOMException('no gesture', 'NotAllowedError');
    });
    expect(await shareBackup(h, file)).toEqual({ state: 'ready', file });
  });

  it('says to use Safari when the device cannot share the file', async () => {
    const result = await shareBackup(
      host(async () => {}, false),
      file,
    );
    expect(result).toMatchObject({ state: 'failed', failure: { connection: false } });
    if (result.state === 'failed') expect(result.failure.message).toContain('Safari');
    expect(await shareBackup({ standalone: true }, file)).toMatchObject({ state: 'failed' });
  });
});

describe('fetchBackup', () => {
  const answering = (body: string) =>
    createClient(
      async () => new Response(body, { headers: { 'content-type': 'application/json' } }),
    );
  const backup = {
    kind: 'kerf-export',
    formatVersion: 1,
    exportedAt: '2026-11-02T12:00:00.000Z',
    projects: [],
    tools: { tools: [] },
  };

  it('names the file by the day it was exported and keeps what the API sent', async () => {
    const result = await fetchBackup(answering(JSON.stringify(backup)));
    if (!result.ok) throw new Error('expected the backup');
    expect(result.file.name).toBe('kerf-2026-11-02.json');
    expect(JSON.parse(await result.file.text())).toEqual(backup);
  });

  it('reports a backup cut off partway rather than saving it', async () => {
    const whole = JSON.stringify(backup);
    const result = await fetchBackup(answering(whole.slice(0, whole.length - 5)));
    expect(result).toMatchObject({ ok: false, failure: { connection: false } });
    if (!result.ok) expect(result.failure.message).toContain('incomplete');
  });
});
