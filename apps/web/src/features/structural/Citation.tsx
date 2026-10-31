import { designValues } from '@kerf/core';
import { Disclosure, List, Text } from '../../ui/index.ts';

type CitationData = designValues.Citation;

/** Where a value or formula came from, linked to the source (AWC's free copies where they exist). */
function Citation(props: { citation: CitationData }) {
  const { citation } = props;
  const source = designValues.SOURCES[citation.source];
  return (
    <a href={citation.url ?? source.url} target="_blank" rel="noreferrer">
      {source.title} ({source.edition}), {citation.locator}
    </a>
  );
}

export function CitationList(props: { citations: readonly CitationData[] }) {
  return (
    <List>
      {props.citations.map((c) => (
        <li key={`${c.source}/${c.locator}`}>
          <Citation citation={c} />
        </li>
      ))}
    </List>
  );
}

/** A small control beside a value that opens its citations. */
export function SourceToggle(props: { citations: readonly CitationData[] | undefined }) {
  if (!props.citations || props.citations.length === 0) return null;
  return (
    <Disclosure summary="Source" size="small">
      <CitationList citations={props.citations} />
    </Disclosure>
  );
}

/** Every publication the given citations draw on, once each, with edition and a link. */
export function SourceList(props: { citations: readonly CitationData[] }) {
  const ids = [...new Set(props.citations.map((c) => c.source))];
  return (
    <List>
      {ids.map((id) => {
        const source = designValues.SOURCES[id];
        return (
          <li key={id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            , {source.publisher}, {source.edition}.
            {'note' in source && source.note ? (
              <Text tone="muted" as="span">
                {' '}
                {source.note}
              </Text>
            ) : null}
          </li>
        );
      })}
    </List>
  );
}
