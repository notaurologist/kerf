import { designValues } from '@kerf/core';

type CitationData = designValues.Citation;

/** Where a value or formula came from, linked to the source (AWC's free copies where they exist). */
export function Citation(props: { citation: CitationData }) {
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
    <ul className="citations">
      {props.citations.map((c) => (
        <li key={`${c.source}/${c.locator}`}>
          <Citation citation={c} />
        </li>
      ))}
    </ul>
  );
}

/** A small control beside a value that opens its citations. */
export function SourceToggle(props: { citations: readonly CitationData[] | undefined }) {
  if (!props.citations || props.citations.length === 0) return null;
  return (
    <details className="source">
      <summary>Source</summary>
      <CitationList citations={props.citations} />
    </details>
  );
}

/** Every publication the given citations draw on, once each, with edition and a link. */
export function SourceList(props: { citations: readonly CitationData[] }) {
  const ids = [...new Set(props.citations.map((c) => c.source))];
  return (
    <ul className="citations">
      {ids.map((id) => {
        const source = designValues.SOURCES[id];
        return (
          <li key={id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            , {source.publisher}, {source.edition}.
            {'note' in source && source.note ? <span className="muted"> {source.note}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
