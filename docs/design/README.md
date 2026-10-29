# Design

Status: in progress. Stages 0 to 2 are decided; stage 3 (#42) is next.

The design milestone (`MILESTONES.md`, Design) runs in stages. Each stage explores two or three directions, critiques them against named principles and published precedents, and records the owner's choice here with the rejected directions and why. Later stages build only on recorded choices.

| Stage | Issue | Status | Review page |
|---|---|---|---|
| 0. Wireframes and the data they need | #39 | Decided October 2026 | `wireframes.html` |
| 1. Information architecture | #40 | Decided October 2026 | `information-architecture.html` |
| 2. Layout and grid | #41 | Decided October 2026 | `layout.html` |
| 3. Typography | #42 | Next | |
| 4. Color | #43 | Blocked by #42 | |
| 5. Diagram language | #44 | Blocked by #43 | |
| 6. Design system | #45 | Blocked by #44 | |

Review pages are standalone HTML. Open one in a browser from the repository, or use the private link given in the pull request, which works on a phone.

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
