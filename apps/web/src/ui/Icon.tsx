// Icons drawn for Kerf (#45), redrawn with eased corners to match the tool icons (#148): 16-unit
// grid, a 1-unit line on half units so it lands on the pixel grid, round ends and joins, in the
// current text color. Every icon is decorative; the text beside it says what it means (#43,
// rule 6: never color or shape alone).

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
      <path d="M8 6.5V12M8 4v1.5" />
    </>
  ),
  chevron: <path d="M3.5 6l4.5 4.5L12.5 6" />,
  connection: <path d="M1.5 6.5a9.2 9.2 0 0 1 13 0M4 9.5a5.6 5.6 0 0 1 8 0M2 2l12 12" />,
  // The three places in the tab bar (#265): a plan sheet, a framing square, an open book.
  projects: <path d="M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3M5.5 8h5M5.5 10.5h5" />,
  tools: <path d="M2.5 1.5v13h12v-3h-9v-10z" />,
  glossary: (
    <path d="M8 3.5C6.5 2.5 4.5 2 1.5 2v10.5c3 0 5 .5 6.5 1.5 1.5-1 3.5-1.5 6.5-1.5V2c-3 0-5 .5-6.5 1.5zM8 3.5V14" />
  ),
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
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
