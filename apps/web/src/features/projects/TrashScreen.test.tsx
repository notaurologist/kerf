import { describe, expect, it } from 'vitest';
import type { TrashedProject } from '../../lib/types.ts';
import { renderText } from '../../test/render.tsx';
import { TrashList } from './TrashScreen.tsx';

const trashed: TrashedProject = {
  id: '6f1c2a3e-0000-4000-8000-000000000001',
  name: 'Backyard swing set',
  status: 'planned',
  templateId: 'swing-set-a-frame',
  templateVersion: 2,
  revision: 1,
  templateBehind: false,
  progress: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  deletedAt: '2026-10-28T12:00:00.000Z',
  purgeAt: '2026-11-27T12:00:00.000Z',
};

describe('TrashList', () => {
  it('says when there are no deleted projects, and how long they wait', () => {
    const text = renderText(<TrashList projects={[]} onGone={() => {}} />);
    expect(text).toContain('Deleted projects wait here for 30 days, then are deleted for good.');
    expect(text).toContain('No deleted projects.');
  });

  it('shows each project with when it was deleted and when it goes for good, and its actions', () => {
    const text = renderText(<TrashList projects={[trashed]} onGone={() => {}} />);
    const day = (iso: string) => new Date(iso).toLocaleDateString();
    expect(text).toContain('Backyard swing set');
    expect(text).toContain(
      `Deleted ${day(trashed.deletedAt)}. Deleted for good on ${day(trashed.purgeAt)}.`,
    );
    expect(text).toContain('Restore');
    expect(text).toContain('Delete for good');
  });

  it('says what the last action did', () => {
    const text = renderText(<TrashList projects={[]} said="Restored “Shed”." onGone={() => {}} />);
    expect(text).toContain('Restored “Shed”.');
  });
});
