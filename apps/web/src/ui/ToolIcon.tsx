import type { ReactNode } from 'react';

// Tool icons (#86; docs/design/tool-icons.html), one per tool type in the library (#85), keyed by
// its ID. Drawn on a 24-unit grid with one 1-unit line, eased like the app's corners (#148): round
// ends and joins, and a 0.6-unit radius on each box. Side-on and flat, with each shared edge drawn
// once. Always shown beside the tool's name and hidden from
// assistive technology (#43, rule 6): the name says what the tool is.

const DRAWINGS: Readonly<Record<string, ReactNode>> = {
  'tape-measure': (
    <>
      <rect x="3" y="5" width="13" height="13" rx="0.6" />
      <circle cx="9.5" cy="11.5" r="2.2" />
      <path d="M16 14.5 H21.5 M16 16.5 H21.5 M21.5 13 V18" />
    </>
  ),
  'combination-square': (
    <>
      <path d="M3 5 H8 V16 L5.5 18.5 H3 Z" />
      <path d="M8 7 H21.5 V10 H8" />
      <path d="M11 10 V8.5 M13.5 10 V9 M16 10 V8.5 M18.5 10 V9" />
    </>
  ),
  'rafter-square': (
    <>
      <path d="M18 20 H3 L18 5" />
      <rect x="18" y="4" width="2.5" height="17" rx="0.6" />
      <path d="M10 17 H15 V12 Z" />
    </>
  ),
  'sliding-bevel': (
    <>
      <rect x="2" y="14" width="13" height="4" rx="0.6" />
      <path d="M9.6 14 L19 4.6 L20.6 6.2 L12.8 14" />
      <circle cx="11" cy="16" r="0.9" />
    </>
  ),
  'chalk-line': (
    <>
      <path d="M3 8 H13 L16 12 L13 16 H3 Z" />
      <circle cx="8" cy="12" r="1.6" />
      <path d="M8 13.6 V19 H5.5 M16 12 H21.5 M21.5 10.5 V13.5" />
    </>
  ),
  level: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="0.6" />
      <rect x="9.5" y="10.5" width="5" height="3" rx="0.6" />
      <path d="M11.25 10.5 V13.5 M12.75 10.5 V13.5" />
    </>
  ),
  'string-line': (
    <>
      <path d="M3 5 H5 V18 L4 20 L3 18 Z M19 5 H21 V18 L20 20 L19 18 Z M5 8 H19" />
    </>
  ),
  'line-level': (
    <>
      <path d="M2 12 H7 M17 12 H22" />
      <rect x="7" y="10" width="10" height="4" rx="0.6" />
      <path d="M11 10 V14 M13 10 V14" />
    </>
  ),
  'circular-saw': (
    <>
      <path d="M2 15 H22 M5 15 A7 7 0 0 1 19 15 M8 15 A4 4 0 0 0 16 15 M16.6 9.4 L19 5.5 H22" />
    </>
  ),
  'miter-saw': (
    <>
      <rect x="2" y="19" width="20" height="2.5" rx="0.6" />
      <path d="M5 19 V6 L9 9 M16.5 8 L20 4.5" />
      <circle cx="13" cy="12" r="5" />
      <circle cx="13" cy="12" r="0.8" />
    </>
  ),
  'hand-saw': (
    <>
      <rect x="2" y="6" width="7" height="12" rx="0.6" />
      <rect x="4" y="9" width="3" height="6" rx="0.6" />
      <path d="M9 7 L22 11 V13" />
      <path d="M22 13 L20.97 14.47 L19.40 13.60 L18.37 15.07 L16.80 14.20 L15.77 15.67 L14.20 14.80 L13.17 16.27 L11.60 15.40 L10.57 16.87 L9 16" />
    </>
  ),
  jigsaw: (
    <>
      <path d="M3 17 H18 M5 17 V10 H17 L18.5 12 V17 M7 10 V5 H15 V10 M12 17 V22" />
    </>
  ),
  'drill-driver': (
    <>
      <path d="M11 16 L11.5 10 H9 V5 H20 V10 H15.5 L15 16" />
      <rect x="9" y="16" width="8.5" height="4" rx="0.6" />
      <path d="M9 5.8 L5.5 6.8 V8.2 L9 9.2 M5.5 7.5 H2" />
    </>
  ),
  'impact-driver': (
    <>
      <path d="M11 16 L11.5 10 H11 V5 H19.5 V10 H15.5 L15 16" />
      <rect x="9" y="16" width="8.5" height="4" rx="0.6" />
      <path d="M11 5.8 H7.5 V9.2 H11" />
      <path d="M7.5 7.5 H4.5" />
    </>
  ),
  'spade-bits': (
    <>
      <path d="M12 2 V11 M9 11 H15 V17 L13 18 L12 22 L11 18 L9 17 Z" />
    </>
  ),
  'auger-bits': (
    <>
      <path d="M12 2 V7 L15 8.5 L9 11.5 L15 14.5 L9 17.5 L12 19 V22" />
    </>
  ),
  'socket-wrench': (
    <>
      <g transform="rotate(-45 12 12)">
        <path d="M14.84 10.5 H2 V13.5 H14.84" />
        <circle cx="18" cy="12" r="3.5" />
        <rect x="16.8" y="10.8" width="2.4" height="2.4" rx="0.6" />
      </g>
    </>
  ),
  clamps: (
    <>
      <rect x="4" y="2.5" width="2" height="19" rx="0.6" />
      <path d="M6 2.5 H16 V5.5 H6 M6 13 H14 V15.5 H6" />
      <path d="M11.5 9.5 V13 M11.5 15.5 V20.5 M9.5 9.5 H13.5 M9 20.5 H14" />
    </>
  ),
  chisel: (
    <>
      <g transform="rotate(-45 12 12)">
        <path d="M10 9.8 H2.3 L1.5 10.6 V13.4 L2.3 14.2 H10" />
        <rect x="10" y="10.4" width="1.5" height="3.2" rx="0.6" />
        <path d="M11.5 10.9 H20 L22 13.1 H11.5" />
      </g>
    </>
  ),
  'block-plane': (
    <>
      <path d="M2 18 H22 V15 L19 12 H6 L3 15 Z M10 18 L15.5 9" />
    </>
  ),
  sander: (
    <>
      <rect x="3" y="17" width="18" height="2.5" rx="0.6" />
      <path d="M5 17 V13 L8 9 H16 L19 13 V17 M9 9 V5 H15 V9 M19 14 H22" />
    </>
  ),
  'post-hole-digger': (
    <>
      <path d="M7 2 H9 M15 2 H17 M8 2 L11 15 M16 2 L13 15 M10.5 15 H13.5 M11 15 L8.5 19.5 L11 22 M13 15 L15.5 19.5 L13 22" />
    </>
  ),
  shovel: (
    <>
      <path d="M9.5 2 H14.5 M12 2 V12 M8 12 H16 V17 L12 22 L8 17 Z" />
    </>
  ),
  tamper: (
    <>
      <path d="M9 2 H15 M12 2 V16" />
      <rect x="5" y="16" width="14" height="5" rx="0.6" />
    </>
  ),
};

/** Tool type IDs that have an icon, for the catalog and tests. */
export const TOOL_ICON_IDS = Object.keys(DRAWINGS);

/** A tool type's icon, or nothing for a tool type without one. */
export function ToolIcon(props: { toolTypeId: string }) {
  const drawing = DRAWINGS[props.toolTypeId];
  if (!drawing) return null;
  return (
    <svg
      className="k-tool-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  );
}

/** A tool's name with its icon before it, kept together on one line. */
export function ToolLabel(props: { toolTypeId: string; children: ReactNode }) {
  return (
    <span className="k-tool-label">
      <ToolIcon toolTypeId={props.toolTypeId} />
      {props.children}
    </span>
  );
}
