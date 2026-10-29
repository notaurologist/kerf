import type { CSSProperties, ReactNode } from 'react';

// The frame every diagram is drawn in (#44): an SVG drawn for the width it is shown at, with a
// short label for assistive technology and a caption. The long description is the cut list,
// which is the diagram's full text equivalent (W3C, complex images); `describedBy` points to it.

export function DiagramFrame(props: {
  /** A short description generated from the same data, such as "Cut detail for A, Rail". */
  label: string;
  caption?: ReactNode;
  viewBox: string;
  /** The id of the element that describes the diagram in full, such as the cut list. */
  describedBy?: string;
  /** The width to draw at, in CSS pixels, when narrower than the container. */
  width?: number;
  children: ReactNode;
}) {
  return (
    <figure
      className="k-diagram"
      style={props.width ? ({ '--diagram-width': `${props.width}px` } as CSSProperties) : undefined}
    >
      <svg
        viewBox={props.viewBox}
        role="img"
        aria-label={props.label}
        aria-describedby={props.describedBy}
      >
        {props.children}
      </svg>
      {props.caption && <figcaption>{props.caption}</figcaption>}
    </figure>
  );
}
