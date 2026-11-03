import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from '../test/render.tsx';
import {
  chooseTheme,
  parseTheme,
  readTheme,
  showTopColor,
  THEME_KEY,
  type ThemeHost,
  ThemeSwitch,
  TOP_COLORS,
} from './theme.tsx';

// The theme menu (#155): System by default, Light and Dark force one scheme on the page's root,
// the choice is kept on this device, and storage that fails or holds something else gives System.

function fakeHost(stored: string | null = null, options: { blocked?: boolean } = {}) {
  const values = new Map<string, string>();
  if (stored !== null) values.set(THEME_KEY, stored);
  const fail = () => {
    if (options.blocked) throw new DOMException('Blocked', 'SecurityError');
  };
  const host: ThemeHost = {
    storage: {
      getItem: (key) => {
        fail();
        return values.get(key) ?? null;
      },
      setItem: (key, value) => {
        fail();
        values.set(key, value);
      },
      removeItem: (key) => {
        fail();
        values.delete(key);
      },
    },
    root: { dataset: {} },
  };
  return { host, values };
}

describe('parseTheme', () => {
  it('reads the three choices and gives System for anything else', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('system')).toBe('system');
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme('Dark')).toBe('system');
    expect(parseTheme('sepia')).toBe('system');
  });
});

describe('readTheme', () => {
  it('is System when nothing is stored', () => {
    expect(readTheme(fakeHost().host)).toBe('system');
  });

  it('reads a stored choice', () => {
    expect(readTheme(fakeHost('dark').host)).toBe('dark');
    expect(readTheme(fakeHost('light').host)).toBe('light');
  });

  it('is System when storage is blocked or missing', () => {
    expect(readTheme(fakeHost('dark', { blocked: true }).host)).toBe('system');
    expect(readTheme({ storage: null, root: { dataset: {} } })).toBe('system');
  });
});

describe('chooseTheme', () => {
  it('forces Light or Dark on the root and keeps it', () => {
    const { host, values } = fakeHost();
    chooseTheme(host, 'dark');
    expect(host.root.dataset.theme).toBe('dark');
    expect(values.get(THEME_KEY)).toBe('dark');
    chooseTheme(host, 'light');
    expect(host.root.dataset.theme).toBe('light');
    expect(values.get(THEME_KEY)).toBe('light');
  });

  it('lets System follow the device and stores nothing', () => {
    const { host, values } = fakeHost('dark');
    host.root.dataset.theme = 'dark';
    chooseTheme(host, 'system');
    expect(host.root.dataset.theme).toBeUndefined();
    expect(values.has(THEME_KEY)).toBe(false);
  });

  it('still shows the choice when storage is blocked', () => {
    const { host } = fakeHost(null, { blocked: true });
    chooseTheme(host, 'dark');
    expect(host.root.dataset.theme).toBe('dark');
  });
});

describe('the theme-color metas', () => {
  const metas = () => [
    { getAttribute: () => '(prefers-color-scheme: light)', content: '' },
    { getAttribute: () => '(prefers-color-scheme: dark)', content: '' },
  ];

  it('take the title bar in each scheme under System', () => {
    const host: ThemeHost = { ...fakeHost().host, metas: metas() };
    showTopColor(host);
    expect(host.metas?.map((m) => m.content)).toEqual(['#ffffff', '#1a1d23']);
  });

  it('both take the chosen scheme under Light or Dark, and go back to their own under System', () => {
    const host: ThemeHost = { ...fakeHost().host, metas: metas() };
    chooseTheme(host, 'dark');
    expect(host.metas?.map((m) => m.content)).toEqual(['#1a1d23', '#1a1d23']);
    chooseTheme(host, 'light');
    expect(host.metas?.map((m) => m.content)).toEqual(['#ffffff', '#ffffff']);
    chooseTheme(host, 'system');
    expect(host.metas?.map((m) => m.content)).toEqual(['#ffffff', '#1a1d23']);
  });

  it('are the colors of the bars in tokens.css', () => {
    const css = readFileSync(new URL('../ui/styles/tokens.css', import.meta.url), 'utf8');
    const token = (name: string) => {
      const match = css.match(
        new RegExp(`--${name}: light-dark\\((#[0-9a-f]{6}), (#[0-9a-f]{6})\\)`),
      );
      return { light: match?.[1], dark: match?.[2] };
    };
    expect(TOP_COLORS.title).toEqual(token('raised'));
    expect(TOP_COLORS.Shopping).toEqual(token('mode-shopping'));
    expect(TOP_COLORS.Building).toEqual(token('mode-building'));
  });
});

describe('ThemeSwitch', () => {
  it('is a labeled menu with System chosen by default', () => {
    const html = render(<ThemeSwitch host={fakeHost().host} />);
    expect(html).toContain('<span class="k-visually-hidden">Theme</span>');
    expect(html).toContain('<option value="system" selected="">System theme</option>');
    expect(html).toContain('<option value="light">Light theme</option>');
    expect(html).toContain('<option value="dark">Dark theme</option>');
  });

  it('shows the stored choice', () => {
    const html = render(<ThemeSwitch host={fakeHost('dark').host} />);
    expect(html).toContain('<option value="dark" selected="">Dark theme</option>');
  });
});

describe('before the first paint', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

  it('index.html sets the stored theme with the same key and values', () => {
    const html = read('../../index.html');
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`);
    expect(html).toContain("theme === 'light' || theme === 'dark'");
    expect(html).toContain('document.documentElement.dataset.theme = theme');
  });

  it('index.html starts the theme-color metas on the title bar in each scheme', () => {
    const html = read('../../index.html');
    expect(html).toContain(
      `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${TOP_COLORS.title.light}" />`,
    );
    expect(html).toContain(
      `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${TOP_COLORS.title.dark}" />`,
    );
  });

  it('tokens.css forces each scheme by data-theme and prints light whatever is chosen', () => {
    const css = read('../ui/styles/tokens.css');
    expect(css).toMatch(/\[data-theme="light"\] \{\s*color-scheme: light;/);
    expect(css).toMatch(/\[data-theme="dark"\] \{\s*color-scheme: dark;/);
    expect(css).toMatch(/@media print \{\s*:root,\s*\[data-theme\] \{\s*color-scheme: light;/);
  });
});
