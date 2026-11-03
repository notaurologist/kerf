// The printed sets (#469): the whole plan, which the browser's own Print also gives, and the
// shorter shop set of the cut list, boards, and build steps. Choosing the shop set marks the page's
// root while the print dialog is open, and print.css leaves out the rest.

export type PrintSet = 'whole' | 'shop';

/** The parts of the browser this needs, so tests can pass their own. */
export interface PrintHost {
  root: { dataset: DOMStringMap };
  print: () => void;
  addEventListener: (type: 'afterprint', listener: () => void, options: { once: true }) => void;
}

function browserHost(): PrintHost {
  return {
    root: document.documentElement,
    print: () => window.print(),
    addEventListener: (type, listener, options) => window.addEventListener(type, listener, options),
  };
}

/** Opens the browser's print dialog for one set; the page returns to the whole plan after. */
export function printSet(set: PrintSet, host: PrintHost = browserHost()): void {
  if (set === 'shop') {
    host.root.dataset.print = 'shop';
    host.addEventListener('afterprint', () => delete host.root.dataset.print, { once: true });
  } else {
    delete host.root.dataset.print;
  }
  host.print();
}
