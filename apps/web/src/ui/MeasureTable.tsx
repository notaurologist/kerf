import type { ReactNode } from 'react';

// A table of measurements (#41): a table when its container is wide, stacked rows below about
// 640 px, every value visible either way. The first column names the row. Numeric columns are
// right-aligned so inch marks line up (#42).

export interface Column<Row> {
  key: string;
  label: string;
  /** The label in full for screen readers, when `label` is shortened for a narrow column. */
  fullLabel?: string;
  numeric?: boolean;
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
}) {
  return (
    <div className="k-table-wrap">
      <table className="k-table">
        <caption className={props.captionHidden ? 'k-visually-hidden' : undefined}>
          {props.caption}
        </caption>
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th key={c.key} scope="col" data-numeric={c.numeric ? '' : undefined}>
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
          {props.rows.map((row, index) => (
            <tr
              key={props.rowKey(row)}
              data-changed={props.rowChanged?.(row, index) ? '' : undefined}
              data-selected={props.rowSelected?.(row) ? '' : undefined}
            >
              {props.columns.map((c) => (
                <td key={c.key} data-label={c.label} data-numeric={c.numeric ? '' : undefined}>
                  {/* One box per cell, so stacked rows keep mixed text and lengths together. */}
                  <div>{c.cell(row)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
