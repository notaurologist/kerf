import { describe, expect, it } from 'vitest';
import { renderText } from '../../test/render.tsx';
import { DeleteProject } from './DeleteProject.tsx';

describe('DeleteProject', () => {
  it('starts as a heading and a single button, with no confirmation showing', () => {
    const text = renderText(<DeleteProject id="p1" name="Backyard swing set" />);
    expect(text).toBe('Delete this project Delete project');
  });
});
