import { formatLength, groupHardware, type HardwareLine, type LumberPlan } from '@kerf/core';
import { Fragment } from 'react';
import { type Changes, marked, NO_CHANGES } from '../../lib/changes.tsx';
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
import { BoardSelection } from './BoardSelection.tsx';

// The shopping list (PRODUCT.md, MVP feature 4): boards to buy, how the parts fit on them, and
// hardware. Board and piece lengths are stored in inches or feet and shown through core's
// formatLength, so they round the same way as the cut list. In a preview (#56), `changes` marks
// each line that differs from the saved plan with the saved value.

/** A board length in feet, shown as feet and inches. */
const feet = (f: number) => formatLength(f * 12, 'feet-inches');

export function ShoppingList(props: {
  lumber: LumberPlan;
  hardware: readonly HardwareLine[];
  hardwareNotes: readonly string[];
  changes?: Changes;
}) {
  const { lumber } = props;
  const changes = props.changes ?? NO_CHANGES;
  const line = (l: object, list: readonly object[], name: string) => `${name}[${list.indexOf(l)}]`;
  const removedLumber = changes.removed('lumber.lines') as LumberPlan['lines'];
  const removedHardware = changes.removed('hardware') as HardwareLine[];
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
        rowKey={(l) => `${l.nominal}/${l.feet}`}
        rowChanged={(l) => changes.under(line(l, lumber.lines, 'lumber.lines'))}
        columns={[
          {
            key: 'stock',
            label: 'Stock',
            cell: (l) =>
              marked(
                changes,
                `${line(l, lumber.lines, 'lumber.lines')}.nominal`,
                <b>{l.nominal}</b>,
              ),
          },
          {
            key: 'length',
            label: 'Board length',
            numeric: true,
            cell: (l) =>
              marked(
                changes,
                `${line(l, lumber.lines, 'lumber.lines')}.feet`,
                <Length>{feet(l.feet)}</Length>,
                (before) => feet(before as number),
              ),
          },
          {
            key: 'buy',
            label: 'Buy',
            numeric: true,
            cell: (l) => marked(changes, `${line(l, lumber.lines, 'lumber.lines')}.count`, l.count),
          },
        ]}
      />
      {removedLumber.length > 0 && (
        <Text>
          No longer bought:{' '}
          <Measured
            text={removedLumber.map((l) => `${l.count} x ${l.nominal}, ${feet(l.feet)}`).join('; ')}
          />
          .
        </Text>
      )}
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
      <BoardSelection lumber={lumber} />

      <h3>Hardware</h3>
      {/* By store group (#59): each group the template names, under its own heading. */}
      {groupHardware(props.hardware, (h) => h.group).map((group, _, groups) => (
        <Stack key={group.title} gap="xs">
          {groups.length > 1 && <h4>{group.title}</h4>}
          <MeasureTable
            caption={`${group.title} to buy`}
            captionHidden
            rows={group.lines}
            rowKey={(h) => h.description}
            rowChanged={(h) => changes.under(line(h, props.hardware, 'hardware'))}
            columns={[
              {
                key: 'item',
                label: 'Item',
                cell: (h) =>
                  marked(
                    changes,
                    `${line(h, props.hardware, 'hardware')}.description`,
                    <Measured text={h.description} />,
                  ),
              },
              {
                key: 'qty',
                label: 'Qty',
                fullLabel: 'Quantity',
                numeric: true,
                cell: (h) =>
                  marked(changes, `${line(h, props.hardware, 'hardware')}.quantity`, h.quantity),
              },
            ]}
          />
        </Stack>
      ))}
      {removedHardware.length > 0 && (
        <Text>
          No longer bought:{' '}
          <Measured
            text={removedHardware.map((h) => `${h.quantity} x ${h.description}`).join('; ')}
          />
          .
        </Text>
      )}
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
