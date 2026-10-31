import { describe, expect, it } from 'vitest';
import { renderText } from '../test/render.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

describe('ErrorBoundary', () => {
  it('shows its children until a render fails', () => {
    expect(renderText(<ErrorBoundary>Projects list</ErrorBoundary>)).toBe('Projects list');
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it('then shows a heading, what happened, Reload, and a way back to Projects', () => {
    const boundary = new ErrorBoundary({ children: 'Projects list' });
    boundary.state = { failed: true };
    expect(renderText(boundary.render())).toBe(
      'This page could not be shown Kerf could not show this page. Reload it, or go back to your projects. Reload Projects',
    );
  });
});
