import { formatLength, type HardwareLine, type LumberPlan } from '@kerf/core';
import { Fragment } from 'react';
import {
  Disclosure,
  ErrorText,
  Length,
  List,
  Measured,
  MeasureTable,
  Stack,
  Text,
} from '../../ui/index.ts';

// The shopping list (PRODUCT.md, MVP feature 4): boards to buy, how the parts fit on them, and
// hardware. Board and piece lengths are stored in inches or feet and shown through core's
// formatLength, so they round the same way as the cut list.

/** A board length in feet, shown as feet and inches. */
const feet = (f: number) => formatLength(f * 12, 'feet-inches');

export function ShoppingList(props: {
  lumber: LumberPlan;
  hardware: readonly HardwareLine[];
  hardwareNotes: readonly string[];
}) {
  const { lumber } = props;
  return (
    <Stack>
      <h3>Lumber</h3>
      {lumber.issues.map((issue) => (
        <div key={issue.message} role="alert">
          <ErrorText>
            <Measured text={issue.message} />
          </ErrorText>
        </div>
      ))}
      <MeasureTable
        caption="Lumber to buy"
        captionHidden
        rows={lumber.lines}
        rowKey={(line) => `${line.nominal}/${line.feet}`}
        columns={[
          { key: 'stock', label: 'Stock', cell: (line) => <b>{line.nominal}</b> },
          {
            key: 'length',
            label: 'Board length',
            numeric: true,
            cell: (line) => <Length>{feet(line.feet)}</Length>,
          },
          { key: 'buy', label: 'Buy', numeric: true, cell: (line) => line.count },
        ]}
      />
      <List>
        {lumber.notes.map((n) => (
          <li key={n}>
            <Measured text={n} />
          </li>
        ))}
      </List>
      <Disclosure summary="Which parts come from which board">
        <List ordered>
          {lumber.boards.map((board, b) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: boards are listed in the plan's order and have no ID.
            <li key={b}>
              <b>
                {board.nominal}, <Length>{feet(board.feet)}</Length>
              </b>
              :{' '}
              {board.pieces.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: pieces are listed in cutting order and repeat.
                <Fragment key={i}>
                  {i > 0 && ', '}
                  {p.name} <Length>{formatLength(p.length)}</Length>
                </Fragment>
              ))}
              .{' '}
              <Text tone="muted" as="span">
                Offcut about <Length>{formatLength(board.offcut)}</Length>.
              </Text>
            </li>
          ))}
        </List>
      </Disclosure>

      <h3>Hardware</h3>
      <MeasureTable
        caption="Hardware to buy"
        captionHidden
        rows={props.hardware}
        rowKey={(line) => line.description}
        columns={[
          { key: 'item', label: 'Item', cell: (line) => <Measured text={line.description} /> },
          {
            key: 'qty',
            label: 'Qty',
            fullLabel: 'Quantity',
            numeric: true,
            cell: (line) => line.quantity,
          },
        ]}
      />
      <List>
        {props.hardwareNotes.map((n) => (
          <li key={n}>
            <Measured text={n} />
          </li>
        ))}
      </List>
    </Stack>
  );
}
