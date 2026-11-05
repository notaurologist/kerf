import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../../api/test/app.ts';
import { createClient, send } from './api.ts';
import { BUILD_HEADER, buildCheck } from './build.ts';

// The header the web reads is the one the API sends (#701), and every answer is checked, a
// refusal included.

afterEach(() => vi.restoreAllMocks());

describe('the build check against the API', () => {
  it('reads the build from every answer the client gets', async () => {
    const { app } = await createTestApp({ build: 'fa1eade' });
    const client = createClient(async (input, init) =>
      app.request(new URL(String(input), 'http://localhost').pathname, init),
    );
    const note = vi.spyOn(buildCheck, 'note');
    expect((await send(client.api.health.$get())).ok).toBe(true);
    expect((await send(client.api.projects.$get())).ok).toBe(false);
    const seen = note.mock.calls.map(([headers]) => headers.get(BUILD_HEADER));
    expect(seen).toEqual(['fa1eade', 'fa1eade']);
  });
});
