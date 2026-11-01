import { findGlossaryEntry, type GlossaryId } from '@kerf/core';
import { createContext, type ReactNode, useContext, useId } from 'react';
import { usePopover } from './Popover.tsx';

// Glossary terms defined where they are used (docs/design/README.md, Terms defined in place): a
// term is a button that opens its definition in a popover, with a link to its glossary entry.
// Only the first use of a term in a scope is marked (content.md, Definitions). A scope is a
// screen, and each plan section within it.

interface Scope {
  /** Which text owns the first use of each term: the `useId` of the `Measured` that marks it. */
  owners: Map<GlossaryId, string>;
  entryHref: (id: GlossaryId) => string;
}

const ScopeContext = createContext<Scope | null>(null);

/**
 * A scope of first uses. Texts claim their terms while they render, in the order they appear on
 * the page. The scope starts afresh each time it renders, and since its value is then new, every
 * text in it renders again, in order, so the first use is always the first one shown. A text that
 * renders on its own keeps what it owns. `entryHref` comes from the nearest outer scope when left
 * out.
 */
export function TermScope(props: { entryHref?: (id: GlossaryId) => string; children: ReactNode }) {
  const outer = useContext(ScopeContext);
  const entryHref = props.entryHref ?? outer?.entryHref;
  if (!entryHref) return props.children;
  const scope: Scope = { owners: new Map(), entryHref };
  return <ScopeContext.Provider value={scope}>{props.children}</ScopeContext.Provider>;
}

/**
 * Which of a text's term uses to mark: the first use of each term in the scope, and only once in
 * the text. Outside a scope, none.
 */
export function useFirstUses<T extends { id: GlossaryId }>(uses: readonly T[]): Set<T> {
  const scope = useContext(ScopeContext);
  const self = useId();
  const marked = new Set<T>();
  if (!scope) return marked;
  const seen = new Set<GlossaryId>();
  for (const use of uses) {
    if (seen.has(use.id)) continue;
    seen.add(use.id);
    const owner = scope.owners.get(use.id);
    if (owner === undefined) scope.owners.set(use.id, self);
    if (owner === undefined || owner === self) marked.add(use);
  }
  return marked;
}

/** The glossary entry's address in this scope. */
export function useEntryHref(): ((id: GlossaryId) => string) | undefined {
  return useContext(ScopeContext)?.entryHref;
}

/**
 * A glossary term in running text: a button named by the words as written, opening a popover
 * (`usePopover`) with the definition and a link to the entry.
 */
export function Term(props: { id: GlossaryId; href: string; children: string }) {
  const entry = findGlossaryEntry(props.id);
  const popover = usePopover();
  if (!entry) return props.children;
  return (
    <span className="k-term">
      <button
        type="button"
        className="k-term__button"
        popoverTarget={popover.id}
        aria-expanded={popover.open}
      >
        {props.children}
      </button>
      <span ref={popover.ref} id={popover.id} popover="auto" className="k-popover">
        <b>{entry.term}</b> {entry.definition}{' '}
        <a className="k-term__entry" href={props.href}>
          Open the glossary entry
        </a>
      </span>
    </span>
  );
}
