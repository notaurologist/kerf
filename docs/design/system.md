# Design system: how to use it

Kerf's screens are built from one design system in `apps/web/src/ui`. The choices behind it are in `README.md` (Stages 0 to 6); this page says how to use it. Every component is shown, in each state, light and dark, on the catalog page at `#/catalog` (signed in).

## The rules

1. **Screens write no styles.** A file outside `ui/` never passes `className` or `style` and never imports a stylesheet. `ui/screens.test.ts` fails if one does. If a screen needs something the system does not have, add it to `ui/` (see "Adding a component").
2. **Numbers come from core.** Components show strings core formatted (hard rule 1). They decide how a number looks, never what it is. Put every length and angle in `Length`, or pass core's text through `Measured`, so a length never breaks across lines.
3. **Never color alone** (#43, rule 6). Every state has words and usually an icon as well as a color. Icons are hidden from assistive technology, and the words beside them say the meaning.
4. **Words follow `content.md`.** Use the shop voice, the patterns there, and the word list: no "safe", "pass", "fail", "invalid", or "sanity".

## Building a screen

- **Frame:** the app shell supplies `Header` and `Page`. A screen returns its content: usually a `Stack` holding an `h1`, then sections.
- **Layout:** the primitives, which respond to the space they are given rather than to the page width (#41):
  - `Stack` for a column;
  - `Cluster` for a wrapping row, with `spread` to push items to either end;
  - `Grid` for as many columns as fit;
  - `Switcher` for side by side, switching to a column all at once;
  - `Sidebar` for a narrow side beside a wide main;
  - `Center` for a readable measure.

  Gaps are steps of the spacing scale (`3xs` to `xl`), never lengths.
- **Headings:** plain `h1` to `h5`, which the base styles size. Sections of the plan use `PlanSection`, which also gives each its printed page and title block.
- **Loading and errors:** use `Loading` while data loads; it waits 300 ms, so a fast load does not flash. Use `Notice` for a problem that is not about a field, with `icon="connection"` when the server cannot be reached.

## Which component for which job

| Job | Component | Notes |
|---|---|---|
| An action | `Button` | `primary` for the main action, `secondary` for the others, `destructive` for one that destroys (named for what it destroys), `link` for a quiet action in running text. `busy` while working. |
| Going to another screen | `ButtonLink`, or a plain `a` | `ButtonLink` when it should look like an action, such as "New swing set". |
| A field | `Field` with `TextInput`, `Select`, or `YesNo` | `Field` holds the label, hint, error, echo, and input needed. Give it an `id` when an error summary links to it. Lengths use the full keyboard (the default); numbers use `keyboard="decimal"` or `"numeric"`. |
| Related fields | `FieldGroup` inside a `Grid` | A legend and optional help. |
| A menu in a row | `CompactSelect` | Its label is read by screen readers only, such as a project's status. |
| Problems after a save | `ErrorSummary` at the top, `error` on each `Field` | The summary takes focus and links to each field (#67). Show errors only after a save. |
| An empty structural input | `needed` on `Field`, or `InputNeeded` | A question, not an error (#43, rule 4). |
| A question for an experienced builder | `ExpertCheck` | Amber, with the flag icon and "Expert check" (#43, rule 3). |
| What just happened | `StatusLine` | Stays until the next action. Use `setFlash` (`lib/flash.ts`) to carry it to the next screen. |
| Progress not yet sent | `Pending` | Shop modes (#57). |
| A margin | `MarginLine` | Core's `formatMargin`, then "under these assumptions", in the text color. In a preview, `was` gives the saved margin. |
| A value a preview changes | `Changed`, and `rowChanged` on `MeasureTable` | The new value with "was" and the saved value under it, and a bar beside the row (#56). `was={null}` says "new". |
| The state of the numbers shown | `StateTag` | Words in an outlined box, such as "Preview, not saved". |
| The length you cut to | `Glance` | 51 px bold: readable across the bench (#42). |
| A part's letter | `PartLetter` | Core's letter in a dark rounded square, before the part's name, as the drawings show it (#66). Prints with its square. |
| A saw setting | `SawSetting` | The setting boxed and larger, the angle to the edge smaller and labeled. |
| A list of measurements | `MeasureTable` | A table from about 640 px of its own width, labeled rows below it. Put the name of each row in the first column. Mark number columns `numeric`; give shortened headers a `fullLabel`. |
| Working, sources, detail | `Disclosure` | Closed on screen, open in print. `size="small"` for a "Source" toggle. |
| A raised item | `Card` | One check, one checklist entry, one project. |
| Lists | `PlainList` (no bullets) or `List` | |
| Formulas and IDs | `Code` | The Mono, never wrapped; scrolls within its line. |
| Secondary text | `Text tone="muted"` | Desk screens only. Shop modes use the text color for every word (#43, rule 5). |
| Leaving with changes | `useLeaveGuard(dirty)` | Render its `dialog`; it asks before any in-app link and when the tab closes. |
| A diagram | `DiagramFrame` | A short label for assistive technology; the cut list is the long description (#44). Strokes take the line tokens. |
| Shop modes | `ModeBar`, `data-density="shop"` | The mode's name and Exit; space times 1.5, controls at least 56 px tall. |

## Tokens

`ui/styles/tokens.css` holds every value; components use only these.

| Group | Names | From |
|---|---|---|
| Color | `--bg`, `--raised`, `--sunken`, `--text`, `--muted`, `--border`, `--border-strong`, `--accent`, `--on-accent`, `--focus`, `--flag-bg`, `--flag-border`, `--flag-text`, `--input-bg`, `--input-border`, `--input-text`, `--done`, `--error`, `--error-bg` | C1 (#43). Each is `light-dark(light, dark)`. |
| Diagram ink | `--ink`, `--dim`, `--hidden`, `--highlight`, `--zone`, `--zone-line`, `--tone-1` to `--tone-3`, `--highlight-1` to `--highlight-3` | #44 |
| Type | `--font-text`, `--font-mono`, `--size--1` to `--size-3`, `--size-read`, `--size-glance`, `--size-saw`, `--size-edge`, `--leading-*` | #42, decision 0015 |
| Space | `--space-3xs` to `--space-xl`, `--density`, `--control-min`, `--content-max`, `--measure`, `--radius` | #41 |
| Lines | `--line-*` (screen widths; print widths in print), `--dash-*` | #44 |

`tokens.test.ts` checks every contrast ratio recorded in `color.html` against these values. When a color changes, measure the new pairing and update both the value and the recorded ratio.

## Layers

`ui/styles/index.css` sets the order: `reset, tokens, base, layout, components, print`. A later layer wins whatever its specificity, so components never need `!important`. The one exception is reduced motion in `reset`, where `!important` in the first layer outranks every later one on purpose.

## Themes, density, and print

- **Theme:** follows the device. `data-theme="light"` or `"dark"` on an element forces one, as the catalog does.
- **Shop density:** `data-density="shop"` on a container gives Shopping and Building their spacing and control size.
- **Print:** always light, on US Letter with 1/2" margins. Each `PlanSection` starts a page with its title block, and every `Disclosure` opens.

## Adding a component

1. **Check first.** Make sure no existing component or primitive does the job, and that the need traces to a recorded design choice. A new visual idea goes to the owner first.
2. **Write the code.** Add the component to `ui/`, with its styles as a `k-` block in `styles/components.css`, states as `data-` attributes, and colors, sizes, and space from tokens only.
3. **Export it** from `ui/index.ts`.
4. **Test it.** Add render tests to `ui.test.tsx`: each state, its accessible name and role, and that no meaning rests on color.
5. **Show it** on the catalog page in each state.
6. **Document it.** Add it to the table above.

## Icons

Icons are drawn in the repo (`ui/Icon.tsx`) on a 16-unit grid with 1.6-unit round strokes, matching the diagram line weights. They are always decorative. Tool icons are #86.
