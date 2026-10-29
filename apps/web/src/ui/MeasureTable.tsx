import type { ReactNode } from 'react';

// A table of measurements (#41): a table when its container is wide, stacked rows below about
// 640 px, every value visible either way. The first column names the row. Numeric columns are
// right-aligned so inch marks line up (#42).

export interface Column<Row> {
  key: string;
  label: string;
  numeric?: boolean;
  cell: (row: Row) => ReactNode;
}

export function MeasureTable<Row>(props: {
  caption: ReactNode;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
}) {
  return (
    <div className="k-table-wrap">
      <table className="k-table">
        <caption>{props.caption}</caption>
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th key={c.key} scope="col" data-numeric={c.numeric ? '' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={props.rowKey(row)}>
              {props.columns.map((c) => (
                <td key={c.key} data-label={c.label} data-numeric={c.numeric ? '' : undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
