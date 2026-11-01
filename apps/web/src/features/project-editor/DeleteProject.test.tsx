import { describe, expect, it } from 'vitest';
import { renderText } from '../../test/render.tsx';
import { confirmsName, DeleteProject } from './DeleteProject.tsx';

describe('confirmsName', () => {
  it('accepts the exact name, ignoring spaces at either end', () => {
    expect(confirmsName('Backyard swing set', 'Backyard swing set')).toBe(true);
    expect(confirmsName('  Backyard swing set ', 'Backyard swing set')).toBe(true);
  });

  it('rejects anything else, including a different case or an empty entry', () => {
    expect(confirmsName('backyard swing set', 'Backyard swing set')).toBe(false);
    expect(confirmsName('Backyard', 'Backyard swing set')).toBe(false);
    expect(confirmsName('', 'Backyard swing set')).toBe(false);
  });
});

describe('DeleteProject', () => {
  it('starts as a single button, with no confirmation showing', () => {
    const text = renderText(<DeleteProject id="p1" name="Backyard swing set" />);
    expect(text).toBe('Delete project');
  });
});
