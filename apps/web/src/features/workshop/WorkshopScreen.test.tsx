// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { click, mount } from '../../test/dom.tsx';
import { WorkshopScreen } from './WorkshopScreen.tsx';

describe('WorkshopScreen', () => {
  it('links to Tools, the glossary, the trash, and the download of every project', () => {
    const { container } = mount(<WorkshopScreen onLogOut={() => {}} />);
    const links = [...container.querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Tools', '#/tools'],
      ['Glossary', '#/glossary'],
      ['Trash', '#/trash'],
      ['Download all projects', '/api/export'],
    ]);
    expect(container.querySelector('a[href="/api/export"]')?.hasAttribute('download')).toBe(true);
  });

  it('has the theme in words and Log out', async () => {
    const onLogOut = vi.fn();
    const { container } = mount(<WorkshopScreen onLogOut={onLogOut} />);
    const theme = container.querySelector('select');
    expect([...(theme?.options ?? [])].map((o) => o.textContent)).toEqual([
      'System theme',
      'Light theme',
      'Dark theme',
    ]);
    const logOut = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Log out',
    );
    await click(logOut as HTMLButtonElement);
    expect(onLogOut).toHaveBeenCalledOnce();
  });
});
