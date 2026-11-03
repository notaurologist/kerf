import { type PlannedCutRow as CutListRow, type Flag, panelMade } from '@kerf/core';
import type { ReactNode } from 'react';
import { type Changes, marked as mark, NO_CHANGES } from '../../lib/changes.tsx';
import { cutListPartId } from '../../lib/show.ts';
import {
  FlagList,
  Length,
  List,
  Measured,
  MeasureTable,
  PartLetter,
  PlainList,
  Readings,
  SettingBox,
  SettingBoxes,
  Stack,
  StatusLine,
  Text,
} from '../../ui/index.ts';

// The cut list (PRODUCT.md, MVP feature 3). Every length and angle arrives as text from core's
// cut list, which formats them with the shared formatters; nothing is rounded here. In a preview
// (#56), `changes` marks each value that differs from the saved plan with the saved one. Stage 16
// (#360, C1): a narrow table of what is compared at the saw (part, how many, how long, each end's
// saw setting), each row opening to what is read once, including the part's expert checks (#356).

export function CutList(props: {
  rows: readonly CutListRow[];
  changes?: Changes;
  /** The part selected in the drawings (#91), whose row is marked. */
  selected?: string | null;
  /** Where a part's name goes: in the plan, the drawings with that part selected (#156). */
  partHref?: (partId: string) => string;
  /** The design's expert checks, each shown on the parts it concerns. */
  flags?: readonly Flag[];
}) {
  const changes = props.changes ?? NO_CHANGES;
  const path = (row: CutListRow) => `cutList[${props.rows.indexOf(row)}]`;
  const marked = (at: string, value: ReactNode) => mark(changes, at, value);
  const removed = changes.removed('cutList') as CutListRow[];
  const chosen = props.rows.find((r) => r.partId === props.selected);
  const flagsOn = (row: CutListRow) =>
    (props.flags ?? []).filter((f) => f.partIds.includes(row.partId));
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
        keepTable
        narrow
        rows={props.rows}
        rowKey={(row) => row.partId}
        rowChanged={(row) => changes.under(path(row))}
        rowSelected={(row) => props.selected === row.partId}
        details={{
          name: (row) => `${row.letter} ${row.name}`,
          content: (row) => (
            <Details row={row} path={path(row)} marked={marked} flags={flagsOn(row)} />
          ),
        }}
        columns={[
          {
            key: 'part',
            label: 'Part',
            // The letter first, as magazine plans list parts, then the name (#66), and the stock
            // under it: nominal for buying, the actual size for cutting.
            lead: (row) => <PartLetter>{row.letter}</PartLetter>,
            cell: (row) => {
              const name = <b>{row.name}</b>;
              const partHref = props.partHref;
              return (
                <>
                  {marked(
                    path(row),
                    partHref ? (
                      <a id={cutListPartId(row.partId)} href={partHref(row.partId)}>
                        {name}
                      </a>
                    ) : (
                      name
                    ),
                  )}
                  <Text tone="muted" size="small">
                    {marked(`${path(row)}.stock`, <Readings text={row.stock} />)}
                  </Text>
                </>
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
            label: 'Ends',
            fullLabel: 'Saw setting at each end',
            width: 'fit',
            cell: (row) => (
              <SettingBoxes>
                {row.settings.map((setting, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the two ends are positional.
                  <span key={i}>
                    {marked(`${path(row)}.ends[${i}]`, <SettingBox>{setting}</SettingBox>)}
                  </span>
                ))}
              </SettingBoxes>
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

/**
 * What a row opens to (#360): what is read once at the bench rather than compared down the
 * column. Each end in words with the angle to the edge, marks, the panel's boards, notes, and
 * the expert checks about the part.
 */
function Details(props: {
  row: CutListRow;
  path: string;
  marked: (at: string, value: ReactNode) => ReactNode;
  flags: readonly Flag[];
}) {
  const { row, path, marked } = props;
  return (
    <Stack gap="xs">
      <List ordered>
        {row.ends.map((end, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the two ends are positional.
          <li key={i}>{marked(`${path}.ends[${i}]`, <Measured text={end} terms />)}</li>
        ))}
      </List>
      <Text tone="muted" size="small">
        {row.endsParallel ? 'Ends parallel.' : 'Ends mirror each other.'}
      </Text>
      {(row.marks.length > 0 || row.notes.length > 0 || row.panel) && (
        <PlainList gap="xs">
          {row.panel && (
            <li>
              {panelMade(row.panel)}{' '}
              {marked(`${path}.panel.recipe`, <Readings text={row.panel.recipe} />)}.
            </li>
          )}
          {row.marks.map((m, i) => (
            <li key={m.label}>
              {m.label}:{' '}
              {marked(
                `${path}.marks[${i}].value`,
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
      )}
      <FlagList flags={props.flags} />
    </Stack>
  );
}
