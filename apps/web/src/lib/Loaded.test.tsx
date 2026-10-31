import { describe, expect, it } from 'vitest';
import { render, renderText } from '../test/render.tsx';
import { Loaded } from './Loaded.tsx';

describe('Loaded', () => {
  const show = (value: string) => <b>{value}</b>;

  it('says it is loading, after the usual delay', () => {
    expect(
      render(<Loaded state={{ state: 'loading' }} loading="Loading project…" onRetry={() => {}} />),
    ).toBe('<p class="k-loading" role="status"></p>');
  });

  it('gives the problem and a way back, with Try again and the connection icon when the server was not reached', () => {
    const offline = (
      <Loaded
        state={{
          state: 'error',
          error: { kind: 'failed', status: 0, message: 'Kerf could not reach the server.' },
        }}
        loading="Loading project…"
        onRetry={() => {}}
        title="Project"
      >
        {show}
      </Loaded>
    );
    expect(renderText(offline)).toBe('Project Kerf could not reach the server. Try again Projects');
    expect(render(offline)).toContain('role="alert"');
    expect(render(offline)).toContain('M2 2l12 12');
    const missing = (
      <Loaded
        state={{ state: 'error', error: { kind: 'not-found' } }}
        loading="Loading project…"
        onRetry={() => {}}
      >
        {show}
      </Loaded>
    );
    // Trying again cannot find what is not there, so only the way back is offered.
    expect(renderText(missing)).toBe('Not found. Projects');
    expect(render(missing)).toContain('href="#/projects"');
    expect(render(missing)).not.toContain('M2 2l12 12');
  });

  it('shows the value once loaded', () => {
    expect(
      render(
        <Loaded
          state={{ state: 'ready', value: 'Backyard' }}
          loading="Loading project…"
          onRetry={() => {}}
        >
          {show}
        </Loaded>,
      ),
    ).toBe('<b>Backyard</b>');
  });
});
