import type { Inventory } from '@kerf/core';
import { api, send } from '../../lib/api.ts';
import { type Kept, useLoad } from '../../lib/useLoad.ts';

// The last inventory the API returned, so opening Tools again shows it at once while it refreshes,
// as an open project does (lib/projectStore.ts). It lives in memory only (decision 0005).

let last: Inventory | undefined;

const kept: Kept<Inventory> = {
  get: () => last,
  set: (inventory) => {
    last = inventory;
  },
};

/** The tool inventory, from memory at once if it is there, refreshed from the API. */
export function useInventory() {
  return useLoad(() => send(api.api.tools.$get()), 'tools', kept);
}
