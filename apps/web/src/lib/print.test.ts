import { describe, expect, it } from 'vitest';
import { type PrintHost, printSet } from './print.ts';

// Print's two sets (#469): the shop set marks the page's root while the dialog is open.

function host(dataset: DOMStringMap = {}) {
  const after: (() => void)[] = [];
  const printed: (string | undefined)[] = [];
  const h: PrintHost = {
    root: { dataset },
    print: () => printed.push(dataset.print),
    addEventListener: (_type, listener) => after.push(listener),
  };
  const afterPrint = () => {
    for (const listener of after.splice(0)) listener();
  };
  return { h, dataset, printed, afterPrint };
}

describe('printing a set', () => {
  it('prints the shop set with the root marked, and returns to the whole plan after', () => {
    const { h, dataset, printed, afterPrint } = host();
    printSet('shop', h);
    expect(printed).toEqual(['shop']);
    afterPrint();
    expect(dataset.print).toBeUndefined();
  });

  it('prints the whole plan unmarked, even if a shop set’s mark was left behind', () => {
    const { h, printed } = host({ print: 'shop' });
    printSet('whole', h);
    expect(printed).toEqual([undefined]);
  });
});
