import { formatLength, type HardwareLine, type LumberPlan } from '@kerf/core';
import { Fragment } from 'react';
import { Measured } from '../../components/Measured.tsx';

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
    <>
      <h3>Lumber</h3>
      {lumber.issues.map((issue) => (
        <p key={issue.message} className="error" role="alert">
          <Measured text={issue.message} />
        </p>
      ))}
      <table className="list keep">
        <thead>
          <tr>
            <th className="number">Buy</th>
            <th>Stock</th>
            <th>Board length</th>
          </tr>
        </thead>
        <tbody>
          {lumber.lines.map((line) => (
            <tr key={`${line.nominal}/${line.feet}`}>
              <td data-label="Buy" className="number">
                {line.count}
              </td>
              <td data-label="Stock">{line.nominal}</td>
              <td data-label="Board length" className="nowrap">
                {feet(line.feet)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="notes">
        {lumber.notes.map((n) => (
          <li key={n}>
            <Measured text={n} />
          </li>
        ))}
      </ul>
      <details className="boards">
        <summary>Which parts come from which board</summary>
        <ol>
          {lumber.boards.map((board, b) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: boards are listed in the plan's order and have no ID.
            <li key={b}>
              <strong>
                {board.nominal}, {feet(board.feet)}
              </strong>
              :{' '}
              {board.pieces.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: pieces are listed in cutting order and repeat.
                <Fragment key={i}>
                  {i > 0 && ', '}
                  {p.name} <span className="nowrap">{formatLength(p.length)}</span>
                </Fragment>
              ))}
              .{' '}
              <span className="muted">
                Offcut about <span className="nowrap">{formatLength(board.offcut)}</span>.
              </span>
            </li>
          ))}
        </ol>
      </details>

      <h3>Hardware</h3>
      <table className="list keep">
        <thead>
          <tr>
            <th className="number">Qty</th>
            <th>Item</th>
          </tr>
        </thead>
        <tbody>
          {props.hardware.map((line) => (
            <tr key={line.description}>
              <td data-label="Qty" className="number">
                {line.quantity}
              </td>
              <td data-label="Item">
                <Measured text={line.description} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="notes">
        {props.hardwareNotes.map((n) => (
          <li key={n}>
            <Measured text={n} />
          </li>
        ))}
      </ul>
    </>
  );
}
