# Design

Status: in progress. Stage 6 (#45): foundations, components, and screens are built (#78 to #80); guidance and the owner's review remain (#81).

The design milestone (`MILESTONES.md`, Design) runs in stages. Each stage explores two or three directions, critiques them against named principles and published precedents, and records the owner's choice here with the rejected directions and why. Later stages build only on recorded choices.

| Stage | Issue | Status | Review page |
|---|---|---|---|
| 0. Wireframes and the data they need | #39 | Decided October 2026 | `wireframes.html` |
| 1. Information architecture | #40 | Decided October 2026 | `information-architecture.html` |
| 2. Layout and grid | #41 | Decided October 2026 | `layout.html` |
| 3. Typography | #42 | Decided October 2026 | `typography.html` |
| 4. Color | #43 | Decided October 2026 | `color.html` |
| 5. Diagram language | #44 | Decided October 2026 | `diagrams.html` |
| 5a. Number entry and form states | #67 | Decided October 2026 | `entry.html` |
| 5b. Words | #68 | Decided October 2026 | `words.html`, `content.md` |
| 6. Design system | #45 | Decided October 2026; building in #78 to #81 | `system.html` |
| 7. A repeatable garage check | #69 | Blocked by #45 | |

Review pages are standalone HTML. Open one in a browser from the repository, or use the private link given in the pull request, which works on a phone.

## Stage 6: design system (#45)

What the system contains was decided in Stages 0 to 5b; `system.html` maps each token group and component to its stage, previews them together in C1, and asks how the system is built:

- DS1: layered global CSS. Tokens and #41's layout primitives in cascade layers, component blocks with a `k-` prefix, states as data attributes, and a test that screens write no styles.
- DS2: CSS Modules. Each component's styles in a module beside it; tokens and layout still global.
- DS3: tokens in TypeScript, written out as CSS variables and applied through typed style props.

It also asks where the code lives (a folder in `apps/web` or its own package), whether the work lands as four pull requests or one, and whether to add test dependencies (an accessibility checker or screenshot tests). None of the directions needs a new dependency.

### Choices

The owner took the suggested option for each (October 2026).

| Question | Chosen | Rejected, and why |
|---|---|---|
| How styles are written | DS1, layered global CSS. Cascade layers in the order reset, tokens, base, layout, components, print. Tokens are CSS custom properties; #41's layout primitives are global classes; components are `k-` blocks with states as data attributes. Screens write no styles: a test fails if a file outside `ui/` passes `className` or `style`. | DS2, CSS Modules: the no-one-off-styles rule comes built in, but tokens and layout primitives still need global CSS, print rules spread across modules, and Vitest needs CSS Modules switched on. DS3, tokens in TypeScript: catches misspelled tokens, but inline styles cannot express focus, container queries, or print, so a stylesheet would still be needed beside a build step and a generated file. |
| Where it lives | `apps/web/src/ui`, a folder of the only app that uses it. | `packages/ui`: a package boundary, build, and version for one consumer. |
| How it lands | Four pull requests, each a sub-issue of #45: #78 fonts, tokens, layers, layout primitives, and the contrast test; #79 components, icons, and the catalog page; #80 the M4 screens rebuilt; #81 usage guidance and ARCHITECTURE.md. Each leaves the app working and is checked in a Vercel preview. | One pull request: nothing half-switched, but the largest review in the project, and a late problem holds up all of it. |
| Test dependencies | None for now. Checks: the contrast test, render tests of states and accessible names, the no-styles-in-screens test, the catalog page, accessibility checked by hand, and the garage check (#69). Revisit after #69. | An accessibility checker (two development dependencies) and screenshot tests (one large dependency and stored images); either can be added later if the garage check shows a gap. |

### Components (#79)

The components are in `apps/web/src/ui`, and every one is shown, in each state, on the catalog page at `#/catalog` (signed in): light and dark side by side, and shop density. The catalog's sample values come from the worked example's committed snapshot and core's formatters and messages. Render tests cover each state and what assistive technology is told: labels tied to inputs, errors and hints tied by `aria-describedby`, `aria-invalid` only on errors, status and alert roles, icons hidden, table cells labeled for stacked rows, and the word list.

Checked by hand in the catalog, October 2026:

| Check | Result |
|---|---|
| Keyboard | Every control in the catalog is reachable with Tab and has a name; every input and select has a label. The disclosure opens with Enter. The dialog focuses the safe choice ("Keep editing"), closes with Escape, and returns focus to the button that opened it. |
| Visible focus | A 3 px ring in the focus color, 2 px outside, on every control. |
| Reflow (WCAG 1.4.10) | No sideways scrolling at 360 px or at 640 px (a 1280 px window at 200%); the measurement table stacks into labeled rows. The browser pane used could not go below 360 px, so 320 px itself was not tested. |
| Reduced motion | The rule is in the reset layer and outranks every later layer. The only motion is the disclosure arrow's 0.15 s turn. The preference could not be switched on in the browser used, so the rule was confirmed, not seen in effect. |
| Screen reader | Not tested with VoiceOver; covered by the render tests' roles and names. Worth a pass in #81. |

### Screens (#80)

Every M4 screen is built from `apps/web/src/ui` only: login, projects, tools, the editor, and the plan. `ui/screens.test.ts` fails if any file outside `ui/` writes `className` or `style`, or imports a stylesheet. The old `styles.css` and its `legacy` layer are gone. The changes the stages called for:

- The plan reads in section order A (#40): summary, structural review, cut list, shopping list. On paper each section starts a page with a title block naming the project and the section (#41), and every "Show the working" opens for printing.
- The editor follows #67:
  - an error summary at the top that takes focus, with each problem linked to its field;
  - errors beside fields only after a save, with core's reading under each length while typing;
  - "Input needed" on empty structural inputs;
  - a busy Save button, and read-only fields while saving;
  - "Not saved." with the reason when the server cannot be reached, keeping what was typed;
  - a "Saved." line on the plan afterwards;
  - a prompt before leaving with unsaved changes, from any link or when the tab closes.
- The 14 screen strings from #68's audit are changed. The core hardware note waits for the next template version bump (0008).

Checked in the browser with the worked example's stored snapshot served in place of the API, at 375 px and about 820 px, in light and dark: the plan, the editor's failed save and leave prompt, and the tools screen. No page scrolls sideways, and long formulas scroll within their own line. Print was not checked in a browser; it is worth checking on paper in #81.

## Stage 5b: words (#68)

`words.html` writes the same four pieces of real Kerf text (a method for cutting the back legs, the burial-depth flag, an out-of-range beam height, and the bending margin) in three voices:

- V1: shop voice. Plain and direct: "you", the active voice, the verb first, then the number, then why.
- V2: report voice. Impersonal and exact, like an engineering memo; the register the structural working already uses.
- V3: mentor voice. Warm and encouraging, with contractions and exclamation marks.

It also asked whether to rename "sanity checks" to "structural checks", proposes a content guide (one pattern for each kind of text) and a word list, and audits every string on the M4 screens and the text core generates for the worked example against the guide: 15 proposed changes. Every number in the samples is a string from the snapshot or core's formatters.

### Choices

The owner took the suggested option for each (October 2026).

| Question | Chosen | Rejected, and why |
|---|---|---|
| Voice | V1, shop voice: "you", the active voice, the verb first, then the number, then why. Everything a person acts on uses it; the structural working keeps its exact, impersonal register. The guide is `content.md`. | V2, report voice: exact, but the reader has to turn labels into actions with a saw in hand, "Invalid input" reads as blame (NN/g), and "Expert review" and "required" lean toward a verdict. Kept only for the working. V3, mentor voice: friendlier, but its reassurance becomes verdicts ("perfectly level", "a little headroom"), which hard rule 2 forbids, and cheer wears thin when repeated (NN/g). |
| "Sanity checks" | Renamed "structural checks" in PRODUCT.md, AGENTS.md, DOMAIN.md, ARCHITECTURE.md, and MILESTONES.md in this change, and in the app in #45. Decision 0001 keeps its wording. | Keeping "sanity checks": familiar, and the word warns that the checks are rough, but it is vague about what is checked, and the review already says "not an engineered design". |
| Guide, word list, and audit | As written. The audit's 15 changes (in `words.html`) are made in #45; the change to core's hardware note waits for the next template version bump (0008). | None proposed. |

## Stage 5a: number entry and form states (#67)

`entry.html` compares three ways to enter a length, each drawn on a phone and in the laptop editor:

- E1: typed as written on a plan (`138-3/8`, `11' 6-3/8"`), read by core and echoed back in core's format. The forgiving format; CAD tools in architectural units read lengths the same way.
- E2: split fields for feet, inches, and a sixteenths menu. The structured format, as GOV.UK asks for dates.
- E3: E1's field with Kerf's own feet-inch-fraction keypad on a phone, after construction calculators.

It also asks when problems are shown (on save, or on leaving a field), draws every form state (new, typing, not a length yet, kept exactly, errors, error summary, input needed, saving, saved, no connection, leaving with changes, loading, and the shop modes' "not yet sent" mark), and proposes an entry standard: what the parser accepts and refuses, with the message for each refusal, the round trip for saved values, angles, and where parsing lives (core). The page includes a working prototype of the parser, using core's `formatLength`; the prototype stays in the scratch build, and core's version comes with hand-checked tests.

### Choices

The owner took the suggested option for each (October 2026).

| Question | Chosen | Rejected, and why |
|---|---|---|
| How a length is entered | E1: one text field per length, typed as a plan writes it (`138-3/8`, `11' 6-3/8"`, `138.4`). Core reads it and the field echoes core's reading, in feet and inches and then inches, as you type. The fastest on the laptop, where the editor is used (#40), and paste works. Built in #73. | E2, split fields: big number-pad keys on a phone, but slow on a laptop (three stops per length) and it cannot hold a decimal or a 1/32, so editing a saved project would round values (hard rule 4). E3, Kerf's own keypad: the fewest taps on a phone, but a page-drawn keypad loses VoiceOver typing, dictation, a paired keyboard, cursor gestures, and paste, for about one tap per length on a screen rarely used on a phone. The owner liked the idea; #74 keeps it as a possible later improvement if marks can be added above the native keyboard reliably. |
| When problems are shown | On save. While typing, the echo shows core's reading, or "Not a length yet" in the normal text color. On a failed save, each problem is marked beside its field and listed in a summary at the top that takes focus. | Errors on leaving a field (NN/g): marks fields left empty while filling others, and on the split edit screen the output is already changing beside them. |
| Entry standard | As written in `entry.html`: a number on its own is inches; feet with `'`; fractions in powers of two to 1/64; ambiguous, metric, and negative entries refused with a message that says what to type; values kept exactly; parsing in core, so the API and snapshots are unchanged; saved values written back without rounding. | None proposed. |

The form states drawn on the page (new, typing, not a length yet, kept exactly, errors, error summary, input needed, saving, saved, no connection, leaving with changes, loading, and the shop modes' "not yet sent" mark) become components in #45.

## Stage 5: diagram language (#44)

`diagrams.html` proposes how Kerf draws, and draws it: three diagram languages, each showing the isometric, exploded, per-part cut detail (back leg and crossbar), and site layout views of the worked example, at desk and phone widths, in light and dark.

- D1: drafting (ASME Y14.2 line conventions, Y14.5 dimensions, numbered balloons, a datum symbol on the reference face).
- D2: shop plan (woodworking-magazine plans: faces toned by orientation, parts lettered as in the cut list, dimensions in the dimension color), on D1's line conventions.
- D3: action (assembly-instruction style after Agrawala et al. 2003: the part being worked on strong, everything else in light line, parts named, stakes on the site layout).

It also sets what all three share (numbers only from core, drawn for the width shown, angles with a square line and arc, long parts broken, never color alone, a generated text label), asks how drawings name parts and what Building mode draws, and gives the line, text, and symbol standard for the suggested choices. The drawings were generated by a scratch script from the template spec's formulas and the snapshot; core produces placements and drawing primitives in M5 (#49).

### Choices

The owner took the suggested option for each (October 2026).

| Question | Chosen | Rejected, and why |
|---|---|---|
| Diagram language | D2, shop plan: faces toned by which way they point (three steps, about 12 in lightness), parts lettered as in the cut list, dimensions in the dimension color with arrows and extension lines, on D1's ASME line conventions (hidden, center, phantom, break). The most readable at a glance on the laptop, the solid faces hold up at arm's length in the garage, and the tones print as grays. Ink on the darkest face tone measures 8.8:1 light and 7.0:1 dark. | D1, drafting: the clearest on paper, but thin lines fade under glare, white faces give no sense of which side of a leg is showing, a woodworker does not read a datum triangle, and it looks like the CAD output #39 turned down (L-C). Its line conventions are kept. D3, action: the best for a single build step, which is why it becomes Building mode's drawing, but weak as the plan's reference drawings (no dimensions on the assembled view, a whole leg drawn as a sliver), and its light context line falls to 3.0:1 light and 1.9:1 dark under 20% glare. |
| How drawings name parts | Letters matching the cut list (A to E for the swing set), one per part, shared by both instances of a pair, in the cut list's first column and on every drawing. Core assigns them (#66). | Item numbers in balloons: numbers sit beside lengths and quantities everywhere in Kerf, so "2" could read as a count. Names written out: "Back leg" takes about 70 px, a third of a phone drawing's width. |
| Drawings in Building mode | Action steps in D2's language: only what the step adds, pulled away from where it goes with a motion arrow; everything already built in D2's face tones and ink, not a light line, so it holds up under glare; the step's part tinted and outlined heavily. Agrawala et al. (2003) found people assembled faster and with fewer errors from action diagrams. Needs each step's parts (#52). | The exploded view with the step's parts highlighted: nothing new to build, but every step shows every part and the reader has to work out what changed. |

The drawing standard M5 builds to (line roles, screen and print widths, patterns, color roles, face tones, text sizes, letters, reference face marks, cut details, site layout) is the "Chosen" section of `diagrams.html`. Drawing primitives carry a line role, not a color or width (#49). The ASME print widths come from published summaries and should be checked against the standard before M5 fixes them. The D2 face tones in dark mode need their own values, since mixing toward the ink lightens instead of darkening; #45 sets them as tokens with the rest of C1.

## Stage 4: color (#43)

`color.html` proposes six rules for what color may say (margins have no color; no red or green near structural results; flags amber with icon and label; input needed is not an error; no secondary text in the shop modes; never color alone), and three palettes built in OKLCH and mapped into sRGB:

- C1: graphite and chalk line (warm paper, graphite text, one blue).
- C2: layout blue (cool blue; a blueprint in dark).
- C3: high-visibility (black and white, safety orange, caution yellow).

Each is shown in light and dark on the plan, a shop step, and a diagram sketch, with every pairing measured (WCAG 2.2 ratio, APCA for reference, and contrast under 20% glare), grayscale lightness differences, and color-blindness separation (Machado 2009 matrices). All three meet AA for every pairing in both themes. The page simulates grayscale print, deuteranopia, protanopia, and glare. It also asks how light and dark are chosen. Contrast was measured with Color.js in a scratch folder; the measured values are the CSS in `color.html`, and #45 will add a contrast test for the chosen tokens.

### Choices

The owner took the suggested option for each (October 2026).

| Question | Chosen | Rejected, and why |
|---|---|---|
| Palette | C1, graphite and chalk line: warm paper, graphite text, one chalk-line blue accent, amber flags, crimson errors beside form fields only. It keeps the screen calm so the few things that need attention stand out, and both themes hold up under glare and in grayscale. | C2, layout blue: the most evocative dark theme, a blueprint, but the weakest in grayscale and its accent is too close to its text. C3, high-visibility: the highest contrast and the most resistant to glare, but yellow and black is the ANSI caution sign, so every flag would look like a hazard warning, which pushes toward a verdict; orange for "done" borrows a hazard color; and pure white on near-black halos for people with astigmatism. Its glare lesson is kept as rule 5. |
| Light and dark | Follow the device's own setting, including its sunset schedule. Print is always light. | Always dark in the shop modes: works against the research for small text (NN/g), and the garage is not always dim. A switch in the app: a per-device setting would need storing on the server (0005), a new requirement for little gain. |
| Rules for color | The six rules as written: margins have no color; no red or green near structural results; flags amber with an icon and the label "Expert check"; input needed is a dashed accent outline, not an error; no secondary text in the shop modes; never color alone. | None proposed. |

The C1 values, in OKLCH, are in `color.html` (the `pal-C1-light` and `pal-C1-dark` classes) with every pairing measured. #45 turns them into tokens and adds a contrast test, so the measured ratios stay checked in code. Diagram ink roles (part, highlighted part, hidden line, dimension, clearance zone) carry into #44.

## Stage 3: typography (#42)

`typography.html` measures each candidate typeface from its font files (digit height, tabular figures, fractions feature, weights, Latin `woff2` size) and derives its shop read and glance sizes from #41's distances. Three directions, each set in its real face at its real size, with a blur and dimming test for judging legibility:

- T2: Atkinson Hyperlegible Next and Mono (Braille Institute, designed for low vision).
- T3: B612 and B612 Mono (Airbus, designed for cockpit displays).
- T1: the system font (SF Pro on Apple devices).

It also compares fraction setting (full-size slash, diagonal, enlarged), proposes a desk type scale and shop sizes, sets rules for each kind of number, and asks permission to self-host the font files. Inter, IBM Plex, and Overpass were considered and set aside.

### Choices

The owner took the suggested option for each (October 2026).

| Question | Chosen | Rejected, and why |
|---|---|---|
| Typeface | T2: Atkinson Hyperlegible Next for text and numbers, with tabular figures where numbers align; Atkinson Hyperlegible Mono for formulas. Recorded in decision 0015. | T3, B612: the tallest digits and an instrument-like voice, but only two weights, so hierarchy would rest on size alone, and wide letters make method text long. The close second. T1, the system font: Apple's license keeps SF Pro to Apple devices, so print would change face by computer, and it is the generic choice. |
| Fractions | Full-size slash, as core formats them (138-3/8"). | Diagonal fractions: digits about half height, about 10 arc-minutes at glance distance and about 6 px in a desk table, so 3/8 and 5/8 blur together. Enlarged fractions: still under the 16-minute minimum at glance distance, and core would have to return a length's parts, a snapshot shape change. |
| Font hosting | Self-host the two variable fonts, subset to Latin, as `woff2` in `apps/web` with the OFL license (about 45 KB). Files land with #45. | An npm package: a dependency for two static files. A Google Fonts link: a third-party request on every load, and no font if it fails. |
| Margin sign | Keep "margin 1.1x", matching AGENTS.md, the tests, and core's `formatMargin`. | The multiplication sign: typographically correct, but changes established wording for no gain in clarity. |

Sizes, from the face's measured digit height (0.694):

| Role | Size |
|---|---|
| Desk scale (ratio 1.2 from 17 px) | 14, 17, 20, 24, 29 px |
| Shop read (16 arc-minutes at 0.5 m) | 20 px |
| Shop glance, the length to cut to (20 arc-minutes at 1.0 m) | 51 px bold |
| Saw setting, boxed | 32 px bold |
| Edge angle, labeled "to the edge" | 20 px |
| Print body | 10.5 pt, 8 pt minimum |

Line height 1.5 for running text, 1.3 in tables, 1.1 for headings, 1.0 for glance numbers.

Rules for numbers:

- Every length and angle comes from core's formatters, unchanged.
- Tabular figures in tables, steps, and lists; proportional in sentences.
- Straight inch and foot marks, as core outputs them.
- A length never breaks across lines. Browsers break at the hyphen, which splits 138 from 3/8, so displayed lengths are unbreakable.
- The saw setting and the angle to the edge are never the same size: the setting larger, bold, and boxed; the edge angle smaller and labeled.
- Columns of lengths are right-aligned, so inch marks line up.
- Formulas in the Mono, never wrapped.

No new requirements for core, the snapshot, or the API.

## Stage 2: layout and grid (#41)

`layout.html` starts from a measurement: the character height needed at each viewing distance, from display legibility guidance (16 arc-minutes minimum, 20 optimal). It proposes a read distance (0.5 m) and a glance distance (1.0 m) for the shop modes, and two densities chosen by mode: desk and shop.

Three spatial systems, each drawn on the laptop plan and a phone build step:

- A: modular columns (4, 8, 12) with breakpoints at 600, 840, and 1280.
- B: content-out layout primitives (Stack, Sidebar, Switcher, Cluster, Center) with a fluid spacing scale.
- C: drawing sheets (US Letter, 6 columns, a title block) on screen and paper.

It also covers the cut list on a phone (stacked rows, a sideways-scrolling table, or priority columns), the structural working, diagrams, and paper size. No new requirements for core, the snapshot, or the API.

### Choices

The owner took the suggestions for distances, the cut list, and paper (October 2026). For the grid, the owner asked whether A's columns could be kept where they help and ignored where they do not; they can, so the choice combines A and B.

| Question | Chosen | Rejected, and why |
|---|---|---|
| Grid | A page column grid with content-out components. The page container is a CSS grid with named lines: 4 columns below 600 px, 8 from 600, 12 from 840, content up to 1200 px, margins and gutters from the fluid spacing scale. Components are built from layout primitives (Stack, Sidebar, Switcher, Cluster, Center) and respond to their own width with container queries, never to page breakpoints. Components that should align to the page columns use `subgrid`. Printed pages use C's 6-column sheet grid and open each section with a title block. | A alone: components tied to page breakpoints need a rule for every place they appear. B alone: no shared columns, so consistency would rest on spacing alone. C on screen: page-sized sheets do not suit a scrolling phone, and browsers cannot paginate content to fixed sheets. |
| Viewing distances | Read distance 0.5 m (phone in hand) for instructions and notes; glance distance 1.0 m (propped across the bench) for the numbers you cut to. Character height 16 arc-minutes for reading, 20 for glancing. The tablet on a sawhorse (1.5 m) is a tablet-only case. | The 0.75 m case remains in the table for reference. |
| Density | Two densities chosen by mode: desk for the plan and editor, shop inside Shopping and Building, with controls at least 56 px tall in shop density. | Density by screen width: a phone reading the plan on the couch would get shop sizes. |
| Cut list on a phone | Stacked rows, every value visible, the length largest; a table from about 640 px of container width. Building mode uses the cut card instead. | A sideways-scrolling table hides the end cuts behind an easy accidental gesture. Priority columns hide the angle, the value most likely to cause a recut. |
| Paper | US Letter portrait with 1/2" margins; landscape Letter pages for the isometric, exploded, and site layout views (named pages). Checks, cut details, and steps do not split across pages when they fit on one. Everything expanded in print. | Tabloid and A4 remain possible later; only page size and diagram scale would change. |

Sizes in the distance table assume a digit is 0.7 of the font size; #42 redoes them for the chosen typeface.

## Stage 1: information architecture (#40)

`information-architecture.html` sets out three structures, each with a site map and navigation for phone, tablet, laptop, and print:

- IA-1: Plan, Shop, and Build as tabs inside each project.
- IA-2: the project is the plan document; Shopping and Building are full-screen modes launched from it, with a Resume card on the projects list.
- IA-3: Plan, Shop, Build, and Tools as the app's top level, working on a current project.

It also proposes two section orders for the plan (A, structural review near the top; B, build order with the review as an appendix), a common layout for cutting and assembly steps, and requirements R22 to R27. Its last section redraws the key #39 screens on the chosen structure.

### Choices

The owner took the suggested option for each (October 2026).

| Question | Chosen | Rejected, and why |
|---|---|---|
| Structure | IA-2: the project is the plan document. Shopping and Building are full-screen modes launched from cards in its summary, each under a bar with the mode's name and Exit. A Resume card on the projects list goes straight to the current step. | IA-1, tabs inside the project: two layers of navigation on the phone, three unequal tasks shown as peers, and a Build tab that looks like the others, so its mode is easy to forget. Kept as the fallback if full-screen modes feel heavy once built. IA-3, activities at the top level: Shop and Build depend on a "current project" set elsewhere, a hidden state that invites mode slips, and planning, the laptop's main job, sits a level down. |
| Section order | A: summary, diagrams, structural review, cut list, boards, shopping list, build steps, parameters and inputs. This is also the print order and the contents list. | B, build order with the structural review as an appendix: margins and the checklist become easy to skip, and the summary would carry the flags alone. |
| Build step | One layout for every step: where you are, what to do, the numbers, the drawing, the method, the flags, then Back and Done. A cutting step is one board; an assembly step is one joint or subassembly. Steps have phases for the step list. | None proposed. |

Rules that hold across the structure:

- Planning screens change parameters only; shop modes change progress only.
- Status follows progress: In progress when shopping or building starts, Built when the last step is done.
- Regenerating a project with saved progress says how much would reset before it runs.
- Printing any view of a project prints the plan in section order A.

Navigation by device:

| Device | Navigation |
|---|---|
| Phone | Slim header with Projects and Tools. A mode fills the screen and has only Exit and its own step controls. |
| Tablet | The plan with a contents sidebar. Building in landscape puts the step beside its diagram. |
| Laptop | Header with Projects and Tools; the plan with a contents sidebar; Edit opens the split screen. |
| Print | The plan document. |

Issues: #61 (the modes, their routes, the Resume card, and status, R22, R25, R26, M7). R23 (step phases) was added to #52 and R24 (the regenerate warning) to #57. R27 (a stored current project) is not needed with IA-2.

## Stage 0: wireframes (#39)

`wireframes.html` shows three directions for each place Kerf is used, with every number taken from the worked example in `packages/core/src/templates/swing-set-a-frame/snapshots/v2.json`:

- Laptop, planning: L-A split editor, L-B plan document, L-C drawing workspace.
- Phone at the store: S-A checklist by aisle, S-B board cards, S-C one screen.
- Phone or tablet in the garage: G-A one step at a time, G-B cut station, G-C board by board on a tablet.

It also sets out five open questions with alternatives (live preview, saved progress, linking parts across views, grouping cuts, connection drops), the precedents each direction follows, and 21 requirements marked met or not met.

### Requirements with issues

These hold whichever direction is chosen:

| Requirements | Issue | Milestone |
|---|---|---|
| R5, R6: part instances and 3D placements | #49 | M5 |
| R7, R8: holes, hardware locations, reference faces, flush cut as data | #50 | M5 |
| R9: flags and checklist items name their parts | #51 | M6 |
| R14, R17: build steps arrive in the project response | #52 | M6 |
| R15: board selection guidance per part role | #53 | M6 |
| R21: keep the screen awake on shop views | #54 | M7 |

R20 (print pages) is already M5 scope. The choices below added:

| Requirements | Issue | Milestone |
|---|---|---|
| R12, R13: preview route for the edit screen | #56 | M5 |
| R4, R16: saved progress, writes queued through a drop | #57 | M7 |
| Q4 a: cutting steps go board by board | #58 | M6 |
| R19: store checklist grouped by aisle, with board cards | #59 | M7 |

#49 now requires part ids on drawing primitives (Q3 a). No choice changed a recorded decision.

### Choices

The owner took the suggested option for each (October 2026).

| Place or question | Chosen | Rejected, and why |
|---|---|---|
| Laptop, planning | L-B plan document for the project page, with L-A's split editor as the edit screen | L-A alone: a split screen does not print, and the structural working is cramped at half width. L-C: waits on M5, needs the most new data, cannot print, and reads as a CAD tool, which is a non-goal. Its part selection can come back inside L-B's diagrams, since Q3 a carries the ids. |
| Phone at the store | S-A checklist by aisle, each lumber row opening S-B's board card | S-B alone: seven cards fill three screens and hardware still needs a list. S-C: no record of what is in the cart and no help choosing boards. |
| Garage | G-A one step at a time; cutting steps go board by board (G-C); each piece opens G-B's cut card; on a tablet the step sits beside its diagram | G-B alone: no order and no assembly guidance. G-C alone: covers cutting only. |
| Q1 live preview | a, dry-run route on the server | b, core in the browser: changes hard rule 6 and ARCHITECTURE principle 2, and a tab left open across a deploy previews with an older template. c, no preview: each trial takes a save. |
| Q2 saved progress | a, on the server | b, on the device: conflicts with 0005 and Safari can clear it. c, none: a reload or a sleeping tab loses the place. |
| Q3 linking parts | a, ids on every drawing primitive, hardware location, flag, and step | b, per-part details only: rules out highlighting in assembled views. c, printed callouts: still wanted for paper, on top of a. |
| Q4 grouping cuts | a, by board in the shop, by part in the plan | b, by part everywhere: the board for each part is looked up by hand. c, by saw setting: mixes boards, so each is handled twice. |
| Q5 connection drops | a, queue ticks in memory, show what is not saved yet | b, a copy on the device: that is offline mode, a change to 0005. c, nothing: only fits with no saved progress. |

What this means for #40: the project has one reading order shared by screen and print (L-B), a separate edit screen with live output (L-A), and phone views for the store (Shop) and the garage (Build, with a cut card for each piece), all built from one project response.
