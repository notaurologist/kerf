// Icons drawn for Kerf at the diagram line weights (#44, #45): 16-unit grid, 1.6-unit strokes,
// round joins, in the current text color. Every icon is decorative; the text beside it says what
// it means (#43, rule 6: never color or shape alone).

const PATHS = {
  flag: <path d="M3.5 1.5v13M3.5 2.5h9l-2.2 3 2.2 3h-9" />,
  error: (
    <>
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 4.6v4.1M8 10.9v.4" />
    </>
  ),
  done: <path d="M2.5 8.5l3.5 3.5 7.5-8" />,
  pending: <circle cx="8" cy="8" r="5.5" strokeDasharray="2.2 1.8" />,
  info: (
    <>
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 7.2v4.2M8 4.7v.4" />
    </>
  ),
  chevron: <path d="M3.5 6l4.5 4.5L12.5 6" />,
  connection: (
    <>
      <path d="M1.5 6.2a9.5 9.5 0 0 1 13 0M4 9a5.8 5.8 0 0 1 8 0" />
      <path d="M2 2l12 12" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon(props: { name: IconName }) {
  return (
    <svg
      className="k-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[props.name]}
    </svg>
  );
}
