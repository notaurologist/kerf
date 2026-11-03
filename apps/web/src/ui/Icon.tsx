// Icons drawn for Kerf (#45), redrawn with eased corners to match the tool icons (#148): 16-unit
// grid, a 1-unit line on half units so it lands on the pixel grid, round ends and joins, in the
// current text color. An icon is hidden from assistive technology: words beside it, or an icon
// button's label, say what it means (#43, rule 6: never color or shape alone).

const PATHS = {
  flag: <path d="M3.5 15V1.5M3.5 2.5h9l-2.5 3 2.5 3h-9" />,
  error: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4v5M8 10.5V12" />
    </>
  ),
  done: <path d="M2.5 8.5l3.5 3.5 7.5-8" />,
  pending: <circle cx="8" cy="8" r="5.5" strokeDasharray="2 1.5" />,
  info: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7v5M8 4.5h0" />
    </>
  ),
  chevron: <path d="M3.5 6l4.5 4.5L12.5 6" />,
  connection: <path d="M1.5 6.5a9.2 9.2 0 0 1 13 0M4 9.5a5.6 5.6 0 0 1 8 0M2 2l12 12" />,
  edit: <path d="M10.5 2.5l3 3-8 8h-3v-3zM8.5 4.5l3 3" />,
  'log-out': <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10.5 5l3 3-3 3M13.5 8h-7" />,
  // The theme menu shows the choice (#155): half a disc for the device's own, a sun, a moon.
  'theme-system': (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
    </>
  ),
  'theme-light': (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
    </>
  ),
  'theme-dark': <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" />,
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
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[props.name]}
    </svg>
  );
}
