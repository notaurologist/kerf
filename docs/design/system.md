# Design system: how to use it

Kerf's screens are built from one design system in `apps/web/src/ui`. The choices behind it are in `README.md` (Stages 0 to 6); this page says how to use it. Every component is shown, in each state, light and dark, on the catalog page at `#/catalog` (signed in).

## The rules

1. **Screens write no styles.** A file outside `ui/` never passes `className` or `style` and never imports a stylesheet. `ui/screens.test.ts` fails if one does. If a screen needs something the system does not have, add it to `ui/` (see "Adding a component").
2. **Numbers come from core.** Components show strings core formatted (hard rule 1). They decide how a number looks, never what it is. Put every length and angle in `Length`, or pass core's text through `Measured`, so a length never breaks across lines. A value with a second reading in parentheses, such as `92.5 in (92-1/2")`, goes in `Readings`, which can break between the two readings in a narrow column.
3. **Never color alone** (#43, rule 6). Every state has words and usually an icon as well as a color. Icons are hidden from assistive technology, and the words beside them say the meaning.
4. **Words follow `content.md`.** Use the shop voice, the patterns there, and the word list: no "safe", "pass", "fail", "invalid", or "sanity".

## Building a screen

- **Frame:** the app shell supplies `Header` and `Page`. A screen returns its content: usually a `Stack` holding a `ScreenHeader`, then sections.
- **Layout:** the primitives, which respond to the space they are given rather than to the page width (#41):
  - `Stack` for a column;
  - `Cluster` for a wrapping row, with `spread` to push items to either end;
  - `Grid` for as many columns as fit;
  - `Switcher` for side by side, switching to a column all at once;
  - `Sidebar` for a narrow side beside a wide main;
  - `Center` for a readable measure.

  Gaps are steps of the spacing scale (`3xs` to `xl`), never lengths.
- **Headings:** plain `h1` to `h5`, which the base styles size. Sections of the plan use `PlanSection`, which also gives each its printed page and title block, and an `intro` line under the heading when the section needs one. `newPage={false}` lets the first section share the printed page with the title. Its heading takes focus from the contents.
- **Loading and errors:** render `useLoad`'s state through `Loaded` (`lib/Loaded.tsx`), which shows `Loading` while data loads (it waits 300 ms, so a fast load does not flash) and a `Notice` if it did not load. Use `Notice` for any other problem that is not about a field, with `icon="connection"` when the server cannot be reached; `failureOf` (`lib/api.ts`) says which.
- **Announcing:** screens never write `role="alert"` or `role="status"`. `ErrorText alert`, `Notice`, `SaveFailed`, `StatusLine`, `InfoNotice`, and `Loading` own their live regions; `ui/screens.test.ts` fails if a screen writes one.
- **A lone action:** a single button or link goes in a `Cluster`, so it keeps its own width instead of stretching across a `Stack`.

## Which component for which job

| Job | Component | Notes |
|---|---|---|
| A plan's contents | `WithContents` | The sections' titles in order, beside them from 48rem of its own width and staying in view, a list on top when narrower. Each moves focus to its section's heading (`goToSection`). Not printed. |
| Key figures at a glance | `Figures` | A label over each value, with an optional `detail` line, as many to a row as fit. The plan's summary. |
| One line of a longer text | `OneLine` | Cut short with an ellipsis, with the full text in the page; only where the full text is a link away. |
| The top of a screen | `ScreenHeader` | The `h1` with the screen's `actions` beside it (wrapping under it when narrow), then a `lede`, a `meta` line of facts, and a `status` such as a `StatusLine`. |
| An action | `Button` | `primary` for the main action, `secondary` for the others, `destructive` for one that destroys (named for what it destroys), `link` for a quiet action in running text. `busy` while working, with `busyLabel` saying what is happening ("Saving…"). |
| An action that fails | `ErrorText alert` under it | Announced when it appears. |
| A question asked in place | `InlineConfirm` | The question (and any field to fill in), the action named for what it does, a "Keep …" choice, the busy label, and the error. A form, so Enter answers. Use `ConfirmDialog` only when the answer has to come before going anywhere. |
| Going to another screen | `ButtonLink`, or a plain `a` | `ButtonLink` when it should look like an action, such as "New swing set". |
| A field | `Field` with `TextInput`, `Select`, or `YesNo` | `Field` holds the label, hint, error, echo, and input needed. Give it an `id` when an error summary links to it. Lengths use the full keyboard (the default); numbers use `keyboard="decimal"` or `"numeric"`. |
| Related fields | `FieldGroup` inside a `Grid` | A legend and optional help. |
| A menu in a row | `CompactSelect` | Its label is read by screen readers only, such as a project's status. |
| Problems after a save | `ErrorSummary` at the top, `error` on each `Field` | The summary takes focus and links to each field (#67). Show errors only after a save. |
| An empty structural input | `needed` on `Field`, or `InputNeeded` | A question, not an error (#43, rule 4). |
| A question for an experienced builder | `ExpertCheck` | Amber, with the flag icon and "Expert check" (#43, rule 3). |
| A plan's or a step's flags | `FlagList` | Core's `Flag[]`, each an `ExpertCheck` labeled with its category. Nothing when there are none. |
| Where a structural check stands | `CheckStatus` | The margin through core's formatter, input needed, or "Not computed." with the reason; `was` in a preview. |
| A save that did not go through | `SaveFailed` | "Not saved.", the reason, and "Your changes are still here", with the connection icon when the server was not reached. Takes a `Failure` from `failureOf`. A preview passes its own `title` and `kept`. |
| Something to know that is not a problem | `InfoNotice` | Status, not an alert, with the info icon. Such as a plan made with a newer or older template version. |
| Loading a screen's data | `Loaded` (`lib/Loaded.tsx`) | Takes `useLoad`'s state, the loading words, and a function from the value to the screen. |
| What just happened | `StatusLine` | Stays until the next action. Use `setFlash` (`lib/flash.ts`) to carry it to the next screen. |
| Progress not yet sent | `Pending` | Shop modes (#57). |
| A Building step with its drawing | `StepLayout` | `lead` (a cutting step's pieces), `drawing`, then the rest. From 600 px of its own width the drawing sits beside the step; narrower, it comes after the lead and before the rest (#134). |
| Marking an item done in a shop mode | `Tick` | A native checkbox with the item as its label, at least the control height; `waiting` adds `Pending` (#61). |
| A margin | `MarginLine` | Core's `formatMargin`, then "under these assumptions", in the text color. In a preview, `was` gives the saved margin. |
| A value a preview changes | `Changed`, and `rowChanged` on `MeasureTable` | The new value with "was" and the saved value under it, and a bar beside the row (#56). `was={null}` says "new". |
| The state of the numbers shown | `StateTag` | Words in an outlined box, such as "Preview, not saved". |
| The length you cut to | `Glance` | 51 px bold: readable across the bench (#42). |
| A part's letter | `PartLetter` | Core's letter in a dark rounded square, before the part's name, as the drawings show it (#66). Prints with its square. |
| A saw setting | `SawSetting` | The setting boxed and larger, the angle to the edge smaller and labeled. |
| A list of measurements | `MeasureTable` | A table from about 640 px of its own width, labeled rows below it. Put the name of each row in the first column. Mark number columns `numeric`; give shortened headers a `fullLabel`. |
| Working, sources, detail | `Disclosure` | Closed on screen, open in print. `size="small"` for a "Source" toggle. |
| A raised item | `Card` | One check, one checklist entry, one project. |
| Lists | `PlainList` (no bullets) or `List` | `items` takes core's sentences and makes each an item through `Measured`. |
| A tool's name | `ToolLabel` (or `ToolIcon` inside a button) | The tool type's icon before its name, kept on one line. The icon is 1.2em, so 20 px beside desk text and 24 px in shop density, and hidden from screen readers. A tool type with no icon shows its name alone. |
| Formulas and IDs | `Code` | The Mono, never wrapped; scrolls within its line. |
| Secondary text | `Text tone="muted"` | Desk screens only. Shop modes use the text color for every word (#43, rule 5). |
| Leaving with changes | `useLeaveGuard(dirty)` | Render its `dialog`; it asks before any in-app link and when the tab closes. |
| A diagram | `Diagram`, inside `DiagramFrame` | `Diagram` draws core's primitives (#90, #91): roles to the line and diagram tokens, text at least 13 px, part letters in columns (one column when narrow), and `selected` and `onSelect` to link a part with the cut list. Give it a short `label` generated from the data and `describedBy` the cut list's id; `page="landscape"` for views that print on their own landscape page. |
| Shop modes | `ModeFrame` (or `ModeBar` alone) | The mode's name, the project's name, and Exit, over content in shop density: space times 1.5, controls at least 56 px tall, and every word in the text color. No other navigation (#61). |

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

Icons are drawn in the repo (`ui/Icon.tsx`) on a 16-unit grid with 1.6-unit round strokes, matching the diagram line weights. They are always decorative.

Tool icons (`ui/ToolIcon.tsx`, #86) are drawn to their own guide, chosen in `tool-icons.html`. A new tool type gets one in the same change:

- **Grid:** 24 × 24 units, artwork inside a one-unit margin.
- **Line:** one 1-unit line, centered, with square (butt) ends and mitered joins. Outlines only; nothing filled.
- **Corners:** square boxes and handles; a 45° chamfer where the real tool has one. Circles only for round parts: blades, hubs, nuts.
- **View:** side-on and flat, no perspective; long tools at 45°.
- **Shared edges:** where two parts touch, draw the edge once. A part that butts against another is an open path ending on the other's outline.
- **Detail:** only what tells the tool from its neighbors, with at least 1.5 units between parallel lines.
- **Use:** beside the tool's name (`ToolLabel`), never alone, and never under 20 px on screen.

Whether `Icon.tsx` and the rest of the app move to the same square corners is #148.
