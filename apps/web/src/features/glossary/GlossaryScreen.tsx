import { GLOSSARY } from '@kerf/core';
import { useEffect } from 'react';
import { Definitions, ScreenHeader, Stack } from '../../ui/index.ts';
import { SourceToggle } from '../structural/Citation.tsx';

// Every glossary term, in alphabetical order, each at its own address (#/glossary/<id>) so text
// that uses a term can link to its entry.

/** The element id of a term's entry on this screen. */
export function entryId(term: string): string {
  return `term-${term}`;
}

export function GlossaryScreen(props: { term?: string }) {
  useEffect(() => {
    const target = props.term ? document.getElementById(entryId(props.term)) : null;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  }, [props.term]);

  return (
    <Stack>
      <ScreenHeader
        title="Glossary"
        lede="The woodworking terms Kerf's plans use, in alphabetical order."
      />
      <Definitions
        items={GLOSSARY.map((entry) => ({
          id: entryId(entry.id),
          term: entry.term,
          definition: entry.definition,
          detail: entry.sources.length > 0 && <SourceToggle citations={entry.sources} />,
        }))}
      />
    </Stack>
  );
}
