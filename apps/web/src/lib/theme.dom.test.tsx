// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../test/dom.tsx';
import { type ThemeHost, ThemeSwitch, useModeColor } from './theme.tsx';

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

const metas = () => [
  { getAttribute: () => '(prefers-color-scheme: light)', content: '' },
  { getAttribute: () => '(prefers-color-scheme: dark)', content: '' },
];

function Mode(props: { mode: 'Shopping' | 'Building'; host: ThemeHost }) {
  useModeColor(props.mode, props.host);
  return <ThemeSwitch host={props.host} />;
}

describe('a shop mode in the theme-color metas', () => {
  it('shows its color while it is open and the title bar after it closes', () => {
    const host: ThemeHost = { storage: null, root: { dataset: {} }, metas: metas() };
    const { rerender } = mount(<Mode mode="Shopping" host={host} />);
    expect(host.metas?.map((m) => m.content)).toEqual(['#39346a', '#2b2458']);
    rerender(<Mode mode="Building" host={host} />);
    expect(host.metas?.map((m) => m.content)).toEqual(['#4c311e', '#3c220f']);
    rerender(<p>Plan</p>);
    expect(host.metas?.map((m) => m.content)).toEqual(['#ffffff', '#1a1d23']);
  });

  it('follows a theme chosen in the mode', () => {
    const host: ThemeHost = { storage: null, root: { dataset: {} }, metas: metas() };
    const { container } = mount(<Mode mode="Building" host={host} />);
    const select = container.querySelector('select');
    if (!select) throw new Error('the theme menu');
    act(() => {
      select.value = 'light';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.metas?.map((m) => m.content)).toEqual(['#4c311e', '#4c311e']);
  });
});

// Vite turns `new URL(path, import.meta.url)` into an asset address under happy-dom, so the path
// is joined to this file's own.
describe("index.html's script before the first paint", () => {
  const html = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../index.html'),
    'utf8',
  );
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
  const themeColors = html.match(/<meta name="theme-color"[^>]*>/g)?.join('') ?? '';

  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  });

  const run = (stored: string | null) => {
    if (stored) localStorage.setItem('kerf-theme', stored);
    document.head.insertAdjacentHTML('beforeend', themeColors);
    new Function(script)();
    return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
      (meta) => meta.content,
    );
  };

  it('gives both metas the stored scheme', () => {
    expect(run('dark')).toEqual(['#1a1d23', '#1a1d23']);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('leaves each meta its own scheme under System', () => {
    expect(run(null)).toEqual(['#ffffff', '#1a1d23']);
  });
});
