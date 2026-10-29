import type { CutListRow } from '@kerf/core';
import { Length, List, Measured, MeasureTable, PlainList, Text } from '../../ui/index.ts';

// The cut list (PRODUCT.md, MVP feature 3). Every length and angle arrives as text from core's
// cut list, which formats them with the shared formatters; nothing is rounded here.

export function CutList(props: { rows: readonly CutListRow[] }) {
  return (
    <MeasureTable
      caption="Cut list"
      captionHidden
      rows={props.rows}
      rowKey={(row) => row.partId}
      columns={[
        { key: 'part', label: 'Part', cell: (row) => <b>{row.name}</b> },
        {
          key: 'qty',
          label: 'Qty',
          fullLabel: 'Quantity',
          numeric: true,
          cell: (row) => row.quantity,
        },
        { key: 'stock', label: 'Stock', cell: (row) => <Measured text={row.stock} /> },
        {
          key: 'length',
          label: 'Length',
          numeric: true,
          cell: (row) => (
            <b>
              <Length>{row.length}</Length>
            </b>
          ),
        },
        {
          key: 'ends',
          label: 'End cuts',
          cell: (row) => (
            <>
              <List ordered>
                {row.ends.map((end, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the two ends are positional.
                  <li key={i}>
                    <Measured text={end} />
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
          cell: (row) =>
            row.marks.length === 0 && row.notes.length === 0 ? (
              <Text tone="muted" as="span">
                None
              </Text>
            ) : (
              <PlainList gap="xs">
                {row.marks.map((m) => (
                  <li key={m.label}>
                    {m.label}:{' '}
                    <b>
                      <Length>{m.value}</Length>
                    </b>
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
  );
}
