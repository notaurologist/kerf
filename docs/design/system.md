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
  - `WithAside` for a main column at a form's width with an aside that stays in view beside it from 60rem, such as the editor's preview; narrower, the aside follows;
  - `Center` for a readable measure.

  Gaps are steps of the spacing scale (`3xs` to `xl`), never lengths.
- **Headings:** plain `h1` to `h5`, which the base styles size. Sections of the plan use `PlanSection`, which also gives each its printed page and title block, and an `intro` line under the heading when the section needs one. `newPage={false}` lets the first section share the printed page with the title. Each section is its own screen (#156): pass `hidden` for every section but the current one, so they stay in the page and print in order A. After a move between sections, focus goes to its heading (`usePlanMoves`, `lib/planMoves.ts`).
- **Loading and errors:** render `useLoad`'s state through `Loaded` (`lib/Loaded.tsx`), which shows `Loading` while data loads (it waits 300 ms, so a fast load does not flash) and a `Notice` if it did not load. Use `Notice` for any other problem that is not about a field, with `icon="connection"` when the server cannot be reached; `failureOf` (`lib/api.ts`) says which.
- **Announcing:** screens never write `role="alert"` or `role="status"`. `ErrorText alert`, `Notice`, `SaveFailed`, `StatusLine`, `InfoNotice`, and `Loading` own their live regions; `ui/screens.test.ts` fails if a screen writes one.
- **A lone action:** a single button or link goes in a `Cluster`, so it keeps its own width instead of stretching across a `Stack`.

## Which component for which job

| Job | Component | Notes |
|---|---|---|
| A plan's contents | `WithContents` | The sections' titles in order, each a link to its section's own screen, with the `current` one marked (`aria-current="page"`, a bar, and bold). From 48rem of its own width they sit beside the section and stay in view; narrower, a bar such as "3 of 8 · Structural review" is a button (`aria-expanded`) that opens the list in place (#156). Not printed. |
| Moving through the plan's sections | `SectionPager` | Previous and Next at the end of a section, each naming the section it goes to, in a `nav` labeled "Plan sections", as GOV.UK's pagination block does. Stacked under 36rem of its own width. Not printed. |
| Every section with what is in it | `SectionList` | Each section a link with core's one-line digest under it (`planDigests`), for the plan's summary (#156). |
| A glossary term in running text | `Term`, through `Measured terms` or `items` with `terms` | A button named by the words as written, opening a popover (`popover="auto"`) with the definition and a link to the glossary entry; Escape or a tap elsewhere closes it, and `aria-expanded` follows its `toggle` event. Only the first use of a term in a `TermScope` is marked: the app gives each screen one, and each `PlanSection` its own. Pass `terms` only for method text, flags, and end cuts. A dotted underline, solid while open; its target reaches the control height without moving the line. |
| Terms with their definitions | `Definitions` | Each term a `dfn` in a description list, with an optional `figure` (a `Diagram`) under the definition, no wider than 28rem, each entry with its own `id` that takes focus, so a link can bring it into view. The glossary (`#/glossary`). An entry does not split across printed pages. |
| Key figures at a glance | `Figures` | A label over each value, with an optional `detail` line, as many to a row as fit. The plan's summary. |
| One line of a longer text | `OneLine` | Cut short with an ellipsis, with the full text in the page; only where the full text is a link away. |
| The top of a screen | `ScreenHeader` | The `h1` with the screen's `actions` beside it (wrapping under it when narrow), then a `lede`, a `meta` line of facts, and a `status` such as a `StatusLine`. |
| An action | `Button` | `primary` for the main action, `secondary` for the others, `destructive` for one that destroys (named for what it destroys), `link` for a quiet action in running text. `busy` while working, with `busyLabel` saying what is happening ("Saving…"). |
| An action that fails | `ErrorText alert` under it | Announced when it appears. |
| A question asked in place | `InlineConfirm` | The question (and any field to fill in), the action named for what it does, a "Keep …" choice, the busy label, and the error. A form, so Enter answers. Use `ConfirmDialog` only when the answer has to come before going anywhere. |
| Going to another screen | `ButtonLink`, or a plain `a` | `ButtonLink` when it should look like an action, such as "New swing set". |
| A field | `Field` with `TextInput`, `Select`, or `YesNo` | `Field` holds the label, hint, error, echo, and input needed. Give it an `id` when an error summary links to it. Lengths use the full keyboard (the default); numbers use `keyboard="decimal"` or `"numeric"`. `width="short"` (10rem) for a number or length, `"medium"` (up to 20rem) for a name or a choice; a `unit` stays on the input's line. Input needed sits on its own line under the label. |
| Related fields | `FieldGroup` inside a `Grid`, or one after another in a `Stack` for a long form | A legend and optional help. A long form is one field per row (#164). |
| How much of a long form is entered | `FormProgress` | "N of M entered", then the groups with an empty field, each a link to its first one. |
| A menu in a row | `CompactSelect` | Its label is read by screen readers only, such as a project's status. |
| Problems after a save | `ErrorSummary` at the top, `error` on each `Field`, state from `useFormIssues` | The summary links to each field (#67) and takes focus once for each save that finds problems: pass the hook's `attempt`, and call `report` after every save. Show errors only after a save. |
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
| A part's letter | `PartLetter` | Core's letter in a dark square with eased corners, before the part's name, as the drawings show it (#66). Prints with its square. |
| A saw setting | `SawSetting` | The setting boxed and larger, the angle to the edge smaller and labeled. |
| A list of measurements | `MeasureTable` | A table from about 640 px of its own width, labeled rows below it. Put the name of each row in the first column, which keeps at least 8rem. Mark number columns `numeric`; give shortened headers a `fullLabel`. Give short values `width: 'fit'` (as narrow as the value; on one line from about 900 px of the table's width, and below that breaking only between whole lengths or readings) and long text `width: 'fill'` (shares what is left equally). `equalColumns` makes every column the same width, so separate tables with the same columns line up, such as Parameters and inputs. |
| Working, sources, detail | `Disclosure` | Closed on screen, open in print. `size="small"` for a "Source" toggle. |
| A raised item | `Card` | One check, one checklist entry, one project. |
| Lists | `PlainList` (no bullets) or `List` | `items` takes core's sentences and makes each an item through `Measured`. |
| A tool's name | `ToolLabel` (or `ToolIcon` inside a button) | The tool type's icon before its name, kept on one line. The icon is 1.2em, so 20 px beside desk text and 24 px in shop density, and hidden from screen readers. A tool type with no icon shows its name alone. |
| The name as a logo | `Wordmark` | The outlined wordmark (#166, `brand.md`), sized in em to the type around it, on the baseline, named "Kerf". In the header and as the login and connection screens' heading; in running text, write "Kerf". |
| Formulas and IDs | `Code` | The Mono, never wrapped; scrolls within its line. |
| Secondary text | `Text tone="muted"` | Desk screens only. Shop modes use the text color for every word (#43, rule 5). |
| Leaving with changes | `useLeaveGuard(dirty)` | Render its `dialog`; it asks before any link to another route (`#/…`) and when the tab closes. Links within the page, such as the error summary's, do not ask. |
| A diagram | `Diagram`, inside `DiagramFrame` | `Diagram` draws core's primitives (#90, #91): roles to the line and diagram tokens, text at least 13 px, part letters in columns (one column when narrow), and `selected` and `onSelect` to link a part with the cut list. Give it a short `label` generated from the data and `describedBy` the cut list's id; `page="landscape"` for views that print on their own landscape page. |
| Shop modes | `ModeFrame` (or `ModeBar` alone) | The mode's name, the project's name, and Exit, over content in shop density: space times 1.5, controls at least 56 px tall, and every word in the text color. No other navigation (#61). |

## Tokens

`ui/styles/tokens.css` holds every value; components use only these.

| Group | Names | From |
|---|---|---|
| Color | `--bg`, `--raised`, `--sunken`, `--text`, `--muted`, `--border`, `--border-strong`, `--accent`, `--on-accent`, `--focus`, `--flag-bg`, `--flag-border`, `--flag-text`, `--input-bg`, `--input-border`, `--input-text`, `--done`, `--error`, `--error-bg` | C1 (#43). Each is `light-dark(light, dark)`. |
| Diagram ink | `--ink`, `--dim`, `--hidden`, `--highlight`, `--zone`, `--zone-line`, `--tone-1` to `--tone-3`, `--highlight-1` to `--highlight-3` | #44 |
| Type | `--font-text`, `--font-mono`, `--size--1` to `--size-3`, `--size-read`, `--size-glance`, `--size-saw`, `--size-edge`, `--leading-*` | #42, decision 0015 |
| Space and corners | `--space-3xs` to `--space-xl`, `--density`, `--control-min`, `--content-max`, `--measure`; `--radius` (2 px, eased; 1 px on small tags) | #41, #148 |
| Lines | `--line-*` (screen widths; print widths in print), `--dash-*` | #44 |

`tokens.test.ts` checks every contrast ratio recorded in `color.html` against these values. When a color changes, measure the new pairing and update both the value and the recorded ratio.

## Layers

`ui/styles/index.css` sets the order: `reset, tokens, base, layout, components, print`. A later layer wins whatever its specificity, so components never need `!important`. The one exception is reduced motion in `reset`, where `!important` in the first layer outranks every later one on purpose.

## Themes, density, and print

- **Theme:** follows the device unless the Theme menu (`ThemeSwitch` in `lib/theme.tsx`, #155) chooses Light or Dark for this device, which sets `data-theme` on the page's root. `data-theme="light"` or `"dark"` on any element forces one, as the catalog does. Shop modes pass the menu to `ModeFrame`'s `end`.
- **Shop density:** `data-density="shop"` on a container gives Shopping and Building their spacing and control size.
- **Print:** always light, on US Letter with 1/2" margins. Each `PlanSection` starts a page with its title block, hidden ones included, so the whole plan prints from any section, and every `Disclosure` opens.

## Adding a component

1. **Check first.** Make sure no existing component or primitive does the job, and that the need traces to a recorded design choice. A new visual idea goes to the owner first.
2. **Write the code.** Add the component to `ui/`, with its styles as a `k-` block in `styles/components.css`, states as `data-` attributes, and colors, sizes, and space from tokens only.
3. **Export it** from `ui/index.ts`.
4. **Test it.** Add render tests to `ui.test.tsx`: each state, its accessible name and role, and that no meaning rests on color.
5. **Show it** on the catalog page in each state.
6. **Document it.** Add it to the table above.

## Icons

Corners are eased everywhere (#148): boxes, fields, buttons, the dialog, and the part letter use `--radius` (2 px), and small tags 1 px. Drawings stop lines where they are drawn (butt ends) and round their joins. Use `--radius` rather than a new literal value.

Kerf's icons (`ui/Icon.tsx`) are drawn on a 16-unit grid with a 1-unit line on half units, with round ends and joins, to match the tool icons. They are always decorative.

Tool icons (`ui/ToolIcon.tsx`, #86) are drawn to their own guide, chosen in `tool-icons.html`. A new tool type gets one in the same change:

- **Grid:** 24 × 24 units, artwork inside a one-unit margin.
- **Line:** one 1-unit line, centered, with round ends and joins, to match the app's eased corners (#148). Outlines only; nothing filled.
- **Corners:** boxes and handles eased with `rx="0.6"`; a 45° chamfer where the real tool has one. Circles only for round parts: blades, hubs, nuts.
- **View:** side-on and flat, no perspective; long tools at 45°.
- **Shared edges:** where two parts touch, draw the edge once. A part that butts against another is an open path ending on the other's outline.
- **Detail:** only what tells the tool from its neighbors, with at least 1.5 units between parallel lines.
- **Use:** beside the tool's name (`ToolLabel`), never alone, and never under 20 px on screen.

