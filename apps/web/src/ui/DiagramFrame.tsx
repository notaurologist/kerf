import type { ReactNode } from 'react';

// The frame every diagram is drawn in (#44): an SVG drawn for the width it is shown at, with a
// short label for assistive technology and a caption. The long description is the cut list,
// which is the diagram's full text equivalent (W3C, complex images). Diagrams themselves are M5.

export function DiagramFrame(props: {
  /** A short description generated from the same data, such as "Cut detail for the back leg". */
  label: string;
  caption?: ReactNode;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <figure className="k-diagram">
      <svg viewBox={props.viewBox} role="img" aria-label={props.label}>
        {props.children}
      </svg>
      {props.caption && <figcaption>{props.caption}</figcaption>}
    </figure>
  );
}
