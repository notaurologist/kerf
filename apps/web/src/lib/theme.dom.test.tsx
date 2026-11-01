// @vitest-environment happy-dom
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { mount } from '../test/dom.tsx';
import { type ThemeHost, ThemeSwitch } from './theme.tsx';

// The frame draws the theme menu twice, in the title bar and the sidebar (#155), so a choice in
// one shows in both.

describe('ThemeSwitch, drawn twice', () => {
  it('shows a choice made in one copy in the other', () => {
    const host: ThemeHost = { storage: null, root: { dataset: {} } };
    const { container } = mount(
      <>
        <ThemeSwitch host={host} />
        <ThemeSwitch host={host} />
      </>,
    );
    const [first, second] = [...container.querySelectorAll('select')];
    if (!first || !second) throw new Error('two menus');
    act(() => {
      first.value = 'dark';
      first.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.root.dataset.theme).toBe('dark');
    expect(second.value).toBe('dark');
  });
});
