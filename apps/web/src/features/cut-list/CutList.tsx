import type { CutListRow } from '@kerf/core';
import type { ReactNode } from 'react';
import { type Changes, marked as mark, NO_CHANGES } from '../../lib/changes.tsx';
import { cutListPartId } from '../../lib/show.ts';
import {
  Length,
  List,
  Measured,
  MeasureTable,
  PartLetter,
  PlainList,
  Readings,
  StatusLine,
  Text,
} from '../../ui/index.ts';

// The cut list (PRODUCT.md, MVP feature 3). Every length and angle arrives as text from core's
// cut list, which formats them with the shared formatters; nothing is rounded here. In a preview
// (#56), `changes` marks each value that differs from the saved plan with the saved one.

export function CutList(props: {
  rows: readonly CutListRow[];
  changes?: Changes;
  /** The part selected in the drawings (#91), whose row is marked. */
  selected?: string | null;
  /** Where a part's name goes: in the plan, the drawings with that part selected (#156). */
  partHref?: (partId: string) => string;
}) {
  const changes = props.changes ?? NO_CHANGES;
  const path = (row: CutListRow) => `cutList[${props.rows.indexOf(row)}]`;
  const marked = (at: string, value: ReactNode) => mark(changes, at, value);
  const removed = changes.removed('cutList') as CutListRow[];
  const chosen = props.rows.find((r) => r.partId === props.selected);
  return (
    <>
      {/* The row is marked too; this says which in words (#43, rule 6). */}
      {chosen && props.partHref && (
        <StatusLine>
          {chosen.letter} · {chosen.name} selected.{' '}
          <a href={props.partHref(chosen.partId)}>Show it in the drawings</a>
        </StatusLine>
      )}
      <MeasureTable
        caption="Cut list"
        captionHidden
        rows={props.rows}
        rowKey={(row) => row.partId}
        rowChanged={(row) => changes.under(path(row))}
        rowSelected={(row) => props.selected === row.partId}
        columns={[
          {
            key: 'part',
            label: 'Part',
            // The letter first, as magazine plans list parts, then the name (#66).
            cell: (row) => {
              const name = (
                <>
                  <PartLetter>{row.letter}</PartLetter>
                  <b>{row.name}</b>
                </>
              );
              const partHref = props.partHref;
              return marked(
                path(row),
                partHref ? (
                  <a id={cutListPartId(row.partId)} href={partHref(row.partId)}>
                    {name}
                  </a>
                ) : (
                  name
                ),
              );
            },
          },
          {
            key: 'qty',
            label: 'Qty',
            fullLabel: 'Quantity',
            numeric: true,
            width: 'fit',
            cell: (row) => marked(`${path(row)}.quantity`, row.quantity),
          },
          {
            key: 'stock',
            label: 'Stock',
            width: 'fit',
            cell: (row) => marked(`${path(row)}.stock`, <Readings text={row.stock} />),
          },
          {
            key: 'length',
            label: 'Length',
            numeric: true,
            width: 'fit',
            cell: (row) =>
              marked(
                `${path(row)}.length`,
                <b>
                  <Length>{row.length}</Length>
                </b>,
              ),
          },
          {
            key: 'ends',
            label: 'End cuts',
            width: 'fill',
            cell: (row) => (
              <>
                <List ordered>
                  {row.ends.map((end, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the two ends are positional.
                    <li key={i}>
                      {marked(`${path(row)}.ends[${i}]`, <Measured text={end} terms />)}
                    </li>
                  ))}
                </List>
                <Text tone="muted" size="small">
                  {row.endsParallel ? 'Ends parallel.' : 'Ends mirror each other.'}
                </Text>
              </>
            ),
          },
          {
            key: 'marks',
            label: 'Marks and notes',
            width: 'fill',
            cell: (row) =>
              row.marks.length === 0 && row.notes.length === 0 ? (
                <Text tone="muted" as="span">
                  None
                </Text>
              ) : (
                <PlainList gap="xs">
                  {row.marks.map((m, i) => (
                    <li key={m.label}>
                      {m.label}:{' '}
                      {marked(
                        `${path(row)}.marks[${i}].value`,
                        <b>
                          <Length>{m.value}</Length>
                        </b>,
                      )}
                    </li>
                  ))}
                  {row.notes.map((n) => (
                    <li key={n}>
                      <Measured text={n} />
                    </li>
                  ))}
                </PlainList>
              ),
          },
        ]}
      />
      {removed.length > 0 && (
        <Text>No longer in the plan: {removed.map((row) => row.name).join(', ')}.</Text>
      )}
    </>
  );
}
