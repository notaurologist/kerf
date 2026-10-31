import {
  findGlossaryEntry,
  GLOSSARY,
  GLOSSARY_GROUP_LABELS,
  GLOSSARY_GROUPS,
  type GlossaryEntry,
  ILLUSTRATIONS,
} from '@kerf/core';
import { href } from '../../lib/route.ts';
import { DefinitionFigure, Diagram, PlainList, ScreenHeader, Stack, Text } from '../../ui/index.ts';
import { SourceToggle } from '../structural/Citation.tsx';

// The glossary: an index of every term by group, and a page for each entry (#/glossary/<id>), so
// a term's popover links to that one entry rather than to a long list.

export function GlossaryScreen(props: { term?: string }) {
  const entry = props.term ? findGlossaryEntry(props.term) : undefined;
  return entry ? <EntryPage entry={entry} /> : <Index />;
}

function Index() {
  return (
    <Stack>
      <ScreenHeader
        title="Glossary"
        lede="The woodworking and structural terms Kerf's plans use, by topic."
      />
      {GLOSSARY_GROUPS.map((group) => (
        <Stack key={group} as="section" gap="xs">
          <h2>{GLOSSARY_GROUP_LABELS[group]}</h2>
          <PlainList gap="xs">
            {GLOSSARY.filter((e) => e.group === group).map((e) => (
              <li key={e.id}>
                <a href={href({ screen: 'glossary', term: e.id })}>{e.term}</a>
              </li>
            ))}
          </PlainList>
        </Stack>
      ))}
    </Stack>
  );
}

function EntryPage(props: { entry: GlossaryEntry }) {
  const { entry } = props;
  const drawing = entry.illustration ? ILLUSTRATIONS[entry.illustration] : undefined;
  return (
    <Stack>
      <ScreenHeader
        title={entry.term}
        meta={
          <>
            {GLOSSARY_GROUP_LABELS[entry.group]} ·{' '}
            <a href={href({ screen: 'glossary' })}>All terms</a>
          </>
        }
      />
      <Text>{entry.definition}</Text>
      {drawing && (
        <DefinitionFigure>
          <Diagram drawing={drawing} label={drawing.description} />
        </DefinitionFigure>
      )}
      <SourceToggle citations={entry.sources} />
    </Stack>
  );
}
