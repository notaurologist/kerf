import type { CutListRow } from '@kerf/core';
import { Measured } from '../../components/Measured.tsx';

// The cut list (PRODUCT.md, MVP feature 3). Every length and angle arrives as text from core's
// cut list, which formats them with the shared formatters; nothing is rounded here.

export function CutList(props: { rows: readonly CutListRow[] }) {
  return (
    <table className="list cut-list">
      <thead>
        <tr>
          <th>Part</th>
          <th className="number">Qty</th>
          <th>Stock</th>
          <th className="number">Length</th>
          <th>End cuts</th>
          <th>Marks and notes</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.partId}>
            <td data-label="Part">
              <strong>{row.name}</strong>
            </td>
            <td data-label="Qty" className="number">
              {row.quantity}
            </td>
            <td data-label="Stock">
              <Measured text={row.stock} />
            </td>
            <td data-label="Length" className="number length">
              <span className="nowrap">{row.length}</span>
            </td>
            <td data-label="End cuts">
              <ol className="ends">
                {row.ends.map((end, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the two ends are positional.
                  <li key={i}>
                    <Measured text={end} />
                  </li>
                ))}
              </ol>
              <span className="muted">
                {row.endsParallel ? 'Ends parallel.' : 'Ends mirror each other.'}
              </span>
            </td>
            <td data-label="Marks and notes">
              {row.marks.length === 0 && row.notes.length === 0 ? (
                <span className="muted">None</span>
              ) : (
                <ul className="plain">
                  {row.marks.map((m) => (
                    <li key={m.label}>
                      {m.label}: <strong className="nowrap">{m.value}</strong>
                    </li>
                  ))}
                  {row.notes.map((n) => (
                    <li key={n}>
                      <Measured text={n} />
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
