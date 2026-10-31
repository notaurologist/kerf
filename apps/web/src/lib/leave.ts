// At most one screen holds unsaved changes at a time. Navigation the app chose, such as after a
// save, does not ask.

export type Ask = (go: () => void) => void;

export interface Navigation {
  hash: () => string;
  /** Without a hashchange. */
  restore: (hash: string) => void;
  go: (hash: string) => void;
}

export function createLeaveGate(nav: Navigation) {
  let asker: Ask | null = null;
  let allowed: string | null = null;

  const confirm = (go: () => void) => {
    if (!asker) {
      go();
      return;
    }
    asker(() => {
      asker = null;
      go();
    });
  };

  const allow = (hash: string) => {
    // The current hash fires no hashchange, so nothing would clear it.
    allowed = hash === nav.hash() ? null : hash;
  };

  return {
    hold(ask: Ask): () => void {
      asker = ask;
      return () => {
        if (asker === ask) asker = null;
      };
    },

    confirm,

    pass(hash: string) {
      allow(hash);
      nav.go(hash);
    },

    allow,

    /** False when a held draft stopped the change: the address is put back and the owner asked. */
    follow(from: string): boolean {
      const to = nav.hash();
      if (to === allowed) {
        allowed = null;
        return true;
      }
      if (!asker || to === from) return true;
      nav.restore(from);
      confirm(() => {
        allowed = to;
        nav.go(to);
      });
      return false;
    },
  };
}

export const leaveGate = createLeaveGate({
  hash: () => window.location.hash,
  restore: (hash) => window.history.pushState(null, '', hash),
  go: (hash) => {
    window.location.hash = hash;
  },
});
