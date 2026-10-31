import { formatBoardLength, groupHardware, type HardwareLine, type LumberPlan } from '@kerf/core';
import { type Changes, marked, NO_CHANGES } from '../../lib/changes.tsx';
import { ErrorText, Length, List, Measured, MeasureTable, Stack, Text } from '../../ui/index.ts';
import { BoardSelection } from './BoardSelection.tsx';

// The shopping list (PRODUCT.md, MVP feature 4): boards to buy, what to look for in them, and
// hardware. Which parts come from which board is the plan's Boards section (#119). Board and piece lengths are stored in inches or feet and shown through core's
// formatLength, so they round the same way as the cut list. In a preview (#56), `changes` marks
// each line that differs from the saved plan with the saved value.

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
        <ErrorText key={issue.message} alert>
          <Measured text={issue.message} />
        </ErrorText>
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
                <Length>{formatBoardLength(l.feet)}</Length>,
                (before) => formatBoardLength(before as number),
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
            text={removedLumber
              .map((l) => `${l.count} x ${l.nominal}, ${formatBoardLength(l.feet)}`)
              .join('; ')}
          />
          .
        </Text>
      )}
      <List items={lumber.notes} terms />
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
      <List items={props.hardwareNotes} terms />
    </Stack>
  );
}
