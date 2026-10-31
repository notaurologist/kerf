// Leaving a screen that holds unsaved changes (#67). At most one screen holds a draft at a time;
// while its draft differs from what is saved, every way of leaving asks first: links, Back and
// Forward, and Log out. The app's own navigation, such as after a save, goes through without
// asking, since the app chose it.

/** Asks the owner, then calls `go` if they choose to leave. */
export type Ask = (go: () => void) => void;

export interface Navigation {
  /** The hash now in the address bar. */
  hash: () => string;
  /** Puts `hash` back in the address bar without a hashchange, as a new history entry. */
  restore: (hash: string) => void;
  /** Goes to `hash` as a new history entry. */
  go: (hash: string) => void;
}

export function createLeaveGate(nav: Navigation) {
  let asker: Ask | null = null;
  // The hash the app is about to go to itself, which the hashchange it causes must not stop.
  let allowed: string | null = null;

  /** Leaves by calling `go`: after asking when unsaved changes are held, otherwise now. */
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

  /** Lets the hashchange to `hash` through, for an app navigation. */
  const allow = (hash: string) => {
    // Going to the hash already shown fires no hashchange, so nothing would clear it.
    allowed = hash === nav.hash() ? null : hash;
  };

  return {
    /** Holds `ask` while a draft is unsaved. Returns the release, for an effect's cleanup. */
    hold(ask: Ask): () => void {
      asker = ask;
      return () => {
        if (asker === ask) asker = null;
      };
    },

    confirm,

    /** Goes to `hash` without asking, for navigation the app itself chose. */
    pass(hash: string) {
      allow(hash);
      nav.go(hash);
    },

    allow,

    /**
     * Called on every hashchange, with the hash the screen was showing. True when the router
     * should follow it. When unsaved changes are held, as after Back or Forward, puts `from` back
     * and asks; leaving then goes to the new hash.
     */
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
