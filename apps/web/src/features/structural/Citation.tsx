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
