import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach } from 'vitest';

// For `*.dom.test.tsx` files, which run in happy-dom (decision 0017): effects, focus, events and
// the address run as in a browser. React's `act` flushes renders and effects before each check.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; container: HTMLElement }[] = [];

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  window.history.replaceState(null, '', '/');
});

/** Renders `node` into the document and runs its effects. */
export function mount(node: ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => root.render(node));
  return {
    container,
    rerender: (next: ReactNode) => act(() => root.render(next)),
  };
}

/** A left click, as a person makes it, then a turn for any hashchange it causes. */
export async function click(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Sets the address as Back or a typed URL would, and waits for its hashchange. */
export async function goTo(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Waits a turn, for events such as the hashchange after code changes the address. */
export async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

/** The one element matching `selector` whose text is `text`, or a failure saying how many. */
export function byText<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
  text: string,
): T {
  const found = [...root.querySelectorAll<T>(selector)].filter(
    (e) => e.textContent?.trim() === text,
  );
  if (found.length !== 1) {
    throw new Error(`Expected one ${selector} reading "${text}", found ${found.length}.`);
  }
  return found[0] as T;
}
