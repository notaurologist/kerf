import { type ReactNode, useId, useState } from 'react';
import { Icon } from './Icon.tsx';

// A table of measurements (#41): a table when its container is wide, stacked rows below about
// 640 px, every value visible either way, unless `keepTable` keeps a few narrow columns as a table.
// The first column names the row. Numeric columns are right-aligned so inch marks line up (#42).
// With `details`, a row opens beneath to what is read once rather than compared, one row at a
// time, and every row is open in print (#360).

export interface Column<Row> {
  key: string;
  label: string;
  /** The label in full for screen readers, when `label` is shortened for a narrow column. */
  fullLabel?: string;
  numeric?: boolean;
  /**
   * In a table: `fit` is as narrow as its content, on one line from about 900 px of the table's
   * width and breaking only between whole pieces (`Length`, `Readings`) below that; `fill` columns
   * share what is left equally. Unset, the browser shares the width by content.
   */
  width?: 'fit' | 'fill';
  cell: (row: Row) => ReactNode;
}

export function MeasureTable<Row>(props: {
  /** Shown above the table; when the surrounding heading already names it, read only. */
  caption: ReactNode;
  captionHidden?: boolean;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Rows a preview changes (#56); each changed value also says what it was, in words. */
  rowChanged?: (row: Row, index: number) => boolean;
  /** The row selected in a linked drawing (#91), highlighted as the drawing highlights its part. */
  rowSelected?: (row: Row) => boolean;
  /** Every column the same width, so separate tables with the same columns line up. */
  equalColumns?: boolean;
  /** A table at every width, for a few columns that fit a phone. */
  keepTable?: boolean;
  /** What a row opens to beneath it, and the row's name for its toggle. */
  details?: { content: (row: Row) => ReactNode; name: (row: Row) => string };
}) {
  const ids = useId();
  const [open, setOpen] = useState<string | null>(null);
  const { details } = props;
  return (
    <div className="k-table-wrap">
      <table
        className="k-table"
        data-equal={props.equalColumns ? '' : undefined}
        data-keep={props.keepTable ? '' : undefined}
      >
        <caption className={props.captionHidden ? 'k-visually-hidden' : undefined}>
          {props.caption}
        </caption>
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                data-numeric={c.numeric ? '' : undefined}
                data-width={c.width}
              >
                {c.fullLabel ? (
                  <>
                    <span aria-hidden="true">{c.label}</span>
                    <span className="k-visually-hidden">{c.fullLabel}</span>
                  </>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.flatMap((row, index) => {
            const key = props.rowKey(row);
            const detailsId = `${ids}-${index}`;
            const isOpen = open === key;
            const main = (
              <tr
                key={key}
                data-changed={props.rowChanged?.(row, index) ? '' : undefined}
                data-selected={props.rowSelected?.(row) ? '' : undefined}
                data-open={isOpen ? '' : undefined}
              >
                {props.columns.map((c, i) => (
                  <td
                    key={c.key}
                    data-label={c.label}
                    data-numeric={c.numeric ? '' : undefined}
                    data-width={c.width}
                  >
                    {/* One box per cell, so stacked rows keep mixed text and lengths together. */}
                    <div>
                      {c.cell(row)}
                      {details && i === 0 && (
                        <button
                          type="button"
                          className="k-table__toggle"
                          aria-expanded={isOpen}
                          aria-controls={detailsId}
                          onClick={() => setOpen(isOpen ? null : key)}
                        >
                          Details<span className="k-visually-hidden"> for {details.name(row)}</span>
                          <span className="k-table__chevron">
                            <Icon name="chevron" />
                          </span>
                        </button>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            );
            if (!details) return [main];
            return [
              main,
              <tr key={`${key}/details`} id={detailsId} data-details="" hidden={!isOpen}>
                <td colSpan={props.columns.length}>{details.content(row)}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
