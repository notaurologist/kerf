import {
  formatBoardFeet,
  formatBoardLength,
  groupHardware,
  type HardwareLine,
  type LumberPlan,
  lumberLineKey,
  type Replacement,
  readingsBesideHardware,
  readingsBesideLumber,
  type StoreReading,
  type StoreReadingsByLine,
} from '@kerf/core';
import { type Changes, marked, NO_CHANGES } from '../../lib/changes.tsx';
import {
  ErrorText,
  Grid,
  InputNeeded,
  Length,
  List,
  Measured,
  MeasureTable,
  Stack,
  Text,
} from '../../ui/index.ts';
import { BoardSelection } from './BoardSelection.tsx';
import { StoreReadings, uniqueReadings } from './StoreReadings.tsx';

// The shopping list (PRODUCT.md, MVP feature 4): boards to buy, what to look for in them, and
// hardware, as Stage 17 lays it out (#361, L1): narrow tables with the count first, grouped in
// store order, and the guidance on choosing boards folded. Which parts come from which board is
// the plan's Boards section (#119). Board lengths are stored in feet and shown through core's
// formatter, so they round the same way as the cut list. In a preview (#56), `changes` marks
// each line that differs from the saved plan with the saved value. Values read at the store
// (#390) follow the table of the lines they are read from.

export function ShoppingList(props: {
  lumber: LumberPlan;
  hardware: readonly HardwareLine[];
  hardwareNotes: readonly string[];
  changes?: Changes;
  /** What to read at the store, by line, and where each opens in Edit. */
  readings?: {
    byLine: StoreReadingsByLine;
    href: (reading: StoreReading) => string;
  };
  /** Boards for pieces cut shorter than the plan now needs, before a change (#444). */
  replacements?: readonly Replacement[];
}) {
  const { lumber, readings } = props;
  const changes = props.changes ?? NO_CHANGES;
  const line = (l: object, list: readonly object[], name: string) => `${name}[${list.indexOf(l)}]`;
  const removedLumber = changes.removed('lumber.lines') as LumberPlan['lines'];
  const removedHardware = changes.removed('hardware') as HardwareLine[];
  const lumberColumns = [
    {
      key: 'buy',
      label: 'Buy',
      numeric: true,
      cell: (l: LumberPlan['lines'][number]) =>
        marked(changes, `${line(l, lumber.lines, 'lumber.lines')}.count`, <b>{l.count}</b>),
    },
    {
      key: 'stock',
      label: 'Stock',
      cell: (l: LumberPlan['lines'][number]) =>
        marked(changes, `${line(l, lumber.lines, 'lumber.lines')}.nominal`, l.nominal),
    },
    {
      key: 'length',
      label: 'Length',
      numeric: true,
      cell: (l: LumberPlan['lines'][number]) =>
        marked(
          changes,
          `${line(l, lumber.lines, 'lumber.lines')}.feet`,
          <Length>{formatBoardLength(l.feet)}</Length>,
          (before) => formatBoardLength(before as number),
        ),
    },
    // Hardwood from a dealer is sold by the board foot (#296).
    ...(lumber.lines.some((l) => l.boardFeet !== undefined)
      ? [
          {
            key: 'board-feet',
            label: 'Board feet',
            numeric: true,
            cell: (l: LumberPlan['lines'][number]) =>
              l.boardFeet === undefined ? '' : formatBoardFeet(l.boardFeet),
          },
        ]
      : []),
  ];
  return (
    <Stack>
      {/* Groups in store order (Stage 17, L1), side by side where there is room. */}
      <Grid min="l" gap="l">
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
            keepTable
            narrow
            rows={lumber.lines}
            rowKey={lumberLineKey}
            // What to buy instead (#450) changes with the margins, which the review marks.
            rowChanged={(l) =>
              ['count', 'nominal', 'feet', 'boardFeet', 'notes'].some((key) =>
                changes.under(`${line(l, lumber.lines, 'lumber.lines')}.${key}`),
              )
            }
            columns={lumberColumns}
          />
          {readings && (
            <StoreReadings
              readings={uniqueReadings(
                lumber.lines.map((l) => readingsBesideLumber(readings.byLine, l)),
              )}
              readingHref={readings.href}
            />
          )}
          {props.replacements && props.replacements.length > 0 && (
            <Text>
              Also buy, for pieces cut before a change and now too short:{' '}
              <Measured
                text={props.replacements
                  .map((r) => `1 x ${r.nominal}, ${formatBoardLength(r.feet)} for ${r.piece}`)
                  .join('; ')}
              />
              .
            </Text>
          )}
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
          <List items={[...lumber.lines.flatMap((l) => l.notes), ...lumber.notes]} terms />
        </Stack>

        <Stack>
          <h3>Hardware</h3>
          {/* By store group (#59): each group the template names, under its own heading, and each
              as wide as the column, so stacked groups end together. */}
          {groupHardware(props.hardware, (h) => h.group).map((group, _, groups) => (
            <Stack key={group.title} gap="xs">
              {groups.length > 1 && <h4>{group.title}</h4>}
              <MeasureTable
                caption={`${group.title} to buy`}
                captionHidden
                keepTable
                rows={group.lines}
                rowKey={(h) => h.description}
                rowChanged={(h) => changes.under(line(h, props.hardware, 'hardware'))}
                columns={[
                  {
                    key: 'buy',
                    label: 'Buy',
                    numeric: true,
                    width: 'fit',
                    cell: (h) =>
                      marked(
                        changes,
                        `${line(h, props.hardware, 'hardware')}.quantity`,
                        // A count read at the store: its prompt is under the table (#406).
                        h.quantity === undefined ? <InputNeeded /> : <b>{h.quantity}</b>,
                      ),
                  },
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
                ]}
              />
              {readings && (
                <StoreReadings
                  readings={uniqueReadings(
                    group.lines.map((h) => readingsBesideHardware(readings.byLine, h)),
                  )}
                  readingHref={readings.href}
                />
              )}
              {/* Each line's own notes, named by the line, as the lumber notes are (#449). */}
              {group.lines.some((h) => h.notes.length > 0) && (
                <List
                  items={group.lines.flatMap((h) => h.notes.map((n) => `${h.description}: ${n}`))}
                  terms
                />
              )}
            </Stack>
          ))}
          {removedHardware.length > 0 && (
            <Text>
              No longer bought:{' '}
              <Measured
                text={removedHardware
                  .map((h) =>
                    h.quantity === undefined ? h.description : `${h.quantity} x ${h.description}`,
                  )
                  .join('; ')}
              />
              .
            </Text>
          )}
          <List items={props.hardwareNotes} terms />
        </Stack>
      </Grid>

      <BoardSelection lumber={lumber} folded />
    </Stack>
  );
}
