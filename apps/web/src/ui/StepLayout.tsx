import type { ReactNode } from 'react';

// A Building step and its drawing (#118, #134). From 600 px of its own width, where the page grid
// has 8 columns (#41), the step sits beside the drawing. Narrower, as on a phone, the drawing
// comes after the step's lead (a cutting step's pieces, or nothing) and before the rest (methods
// and flags), so it is near the top, where the step is read. The drawing is rendered once.

export function StepLayout(props: {
  /** What comes before the drawing on a phone. */
  lead?: ReactNode;
  drawing?: ReactNode;
  /** Everything else, after the drawing on a phone. */
  children: ReactNode;
}) {
  return (
    <div className="k-steplayout">
      <div className="k-steplayout__grid" data-drawing={props.drawing ? '' : undefined}>
        {props.lead && <div className="k-steplayout__lead">{props.lead}</div>}
        {props.drawing && <div className="k-steplayout__drawing">{props.drawing}</div>}
        <div className="k-steplayout__rest">{props.children}</div>
      </div>
    </div>
  );
}

/**
 * A piece on a cutting step's board (#455): its tick, letter, and name, then its length and
 * settings, then its action, such as Cut card, on a line of its own. The same grid for every piece,
 * so the action keeps its place from piece to piece and step to step however long the name.
 */
export function PieceRow(props: { tick: ReactNode; action: ReactNode; children: ReactNode }) {
  return (
    <div className="k-piece">
      {props.tick}
      <div className="k-piece__detail">{props.children}</div>
      <div className="k-piece__action">{props.action}</div>
    </div>
  );
}
