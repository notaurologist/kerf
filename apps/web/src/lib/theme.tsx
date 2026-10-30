import { useState } from 'react';
import { CompactSelect, type Option } from '../ui/index.ts';

// Light, dark, or the device's own setting (#155). The colors are light-dark() tokens picked by
// color-scheme (tokens.css), so a choice only sets data-theme on the page's root, which forces
// one scheme; System removes it and the page follows the device, live. Print is light whatever is
// chosen (tokens.css). The choice belongs to one device, so it is kept in the browser's storage,
// which 0005 allows for display preferences. index.html reads it before the first paint, so the
// page does not flash the other scheme; keep that script in step with this file.

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** The browser storage key, also read by the script in index.html. */
export const THEME_KEY = 'kerf-theme';

const OPTIONS: readonly Option[] = [
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
}

function browserHost(): ThemeHost {
  // Rendered outside a browser, as in tests: nothing to read or set.
  if (typeof window === 'undefined') return { storage: null, root: { dataset: {} } };
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
  return { storage, root: document.documentElement };
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
}

/**
 * The theme menu, in the header and in the shop modes' bar. Its visible value names the choice,
 * so the label is read by screen readers only.
 */
export function ThemeSwitch(props: { host?: ThemeHost }) {
  const [host] = useState(() => props.host ?? browserHost());
  const [theme, setTheme] = useState(() => readTheme(host));
  return (
    <CompactSelect
      label="Theme"
      value={theme}
      options={OPTIONS}
      onChange={(value) => {
        const next = parseTheme(value);
        chooseTheme(host, next);
        setTheme(next);
      }}
    />
  );
}
