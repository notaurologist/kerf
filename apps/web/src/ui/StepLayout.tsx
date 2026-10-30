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
