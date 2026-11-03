import { useEffect, useState, useSyncExternalStore } from 'react';
import { CompactSelect, IconSelect } from '../ui/index.ts';

// Light, dark, or the device's own setting (#155). The colors are light-dark() tokens picked by
// color-scheme (tokens.css), so a choice only sets data-theme on the page's root, which forces
// one scheme; System removes it and the page follows the device, live. Print is light whatever is
// chosen (tokens.css). The choice belongs to one device, so it is kept in the browser's storage,
// which 0005 allows for display preferences. index.html reads it before the first paint, so the
// page does not flash the other scheme; keep that script in step with this file.
//
// The theme-color metas follow the choice and the bar at the top of the screen, for
// browsers that color their own bars from them. Safari 26 on the phone ignores them and samples a
// full-width sticky bar at the top instead, which the title bar and the mode bar are.

const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** The browser storage key, also read by the script in index.html. */
export const THEME_KEY = 'kerf-theme';

const OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: 'system', label: 'System theme' },
  { value: 'light', label: 'Light theme' },
  { value: 'dark', label: 'Dark theme' },
];

/** A stored or chosen value, read as a theme. Anything else, including nothing, is System. */
export function parseTheme(value: unknown): Theme {
  return THEMES.find((t) => t === value) ?? 'system';
}

/** The parts of the browser this needs, so tests can pass their own. */
export interface ThemeHost {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  root: { dataset: DOMStringMap };
  /** index.html's theme-color metas, one for each scheme. */
  metas?: readonly Pick<HTMLMetaElement, 'getAttribute' | 'content'>[];
}

/** The bar at the top of the screen: the frame's title bar, or a shop mode's bar. */
export type TopBar = 'title' | 'Shopping' | 'Building';

/**
 * Each bar's color in each scheme, from tokens.css: `--raised` for the title bar and each mode's
 * own color. theme.test.tsx keeps them in step, and index.html starts with the title bar's.
 */
export const TOP_COLORS: Record<TopBar, Record<'light' | 'dark', string>> = {
  title: { light: '#ffffff', dark: '#1a1d23' },
  Shopping: { light: '#39346a', dark: '#2b2458' },
  Building: { light: '#4c311e', dark: '#3c220f' },
};

function browserHost(): ThemeHost {
  // Rendered outside a browser, as in tests: nothing to read or set.
  if (typeof window === 'undefined') return { storage: null, root: { dataset: {} } };
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
  return {
    storage,
    root: document.documentElement,
    metas: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')],
  };
}

/** The stored choice. Storage that is missing, blocked, or cleared gives System. */
export function readTheme(host: ThemeHost): Theme {
  try {
    return parseTheme(host.storage?.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

/** Shows a choice on the page and keeps it for the next visit. System stores nothing. */
export function chooseTheme(host: ThemeHost, theme: Theme): void {
  if (theme === 'system') delete host.root.dataset.theme;
  else host.root.dataset.theme = theme;
  try {
    if (theme === 'system') host.storage?.removeItem(THEME_KEY);
    else host.storage?.setItem(THEME_KEY, theme);
  } catch {
    // Storage full or blocked: the choice still shows until the page is reloaded.
  }
  showTopColor(host);
}

/** The bar at the top of the screen now, which a shop mode sets while it is open. */
let top: TopBar = 'title';

/** Sets the theme-color metas to the top bar's color: each in its own scheme under System. */
export function showTopColor(host: ThemeHost): void {
  const theme = shown(host);
  for (const meta of host.metas ?? []) {
    const media = meta.getAttribute('media') ?? '';
    const scheme = theme !== 'system' ? theme : media.includes('dark') ? 'dark' : 'light';
    meta.content = TOP_COLORS[top][scheme];
  }
}

/** For a shop mode: its bar's color in the theme-color metas while it is open. */
export function useModeColor(mode: 'Shopping' | 'Building', host?: ThemeHost): void {
  useEffect(() => {
    const target = host ?? browserHost();
    top = mode;
    showTopColor(target);
    return () => {
      top = 'title';
      showTopColor(target);
    };
  }, [mode, host]);
}

/** Every theme menu on the page, told when one of them changes the choice. */
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The choice showing on the page, which outlasts storage that is blocked. */
const shown = (host: ThemeHost) => parseTheme(host.root.dataset.theme ?? readTheme(host));

/**
 * The theme menu: in the shop modes' bar, an icon for the choice over the device's own menu, so a
 * tap opens the native picker; in Workshop (`named`), the choice in words. Every copy follows one
 * choice.
 */
export function ThemeSwitch(props: { host?: ThemeHost; named?: boolean }) {
  const [host] = useState(() => props.host ?? browserHost());
  const read = () => shown(host);
  const theme = useSyncExternalStore(subscribe, read, read);
  const choose = (value: string) => {
    chooseTheme(host, parseTheme(value));
    for (const listener of listeners) listener();
  };
  if (props.named) {
    return <CompactSelect label="Theme" value={theme} options={OPTIONS} onChange={choose} />;
  }
  return (
    <IconSelect
      label="Theme"
      value={theme}
      icon={`theme-${theme}`}
      options={OPTIONS}
      onChange={choose}
    />
  );
}
