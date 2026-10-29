# Design

Status: in progress. Stage 0 (#39) is decided; stage 1 (#40) is next.

The design milestone (`MILESTONES.md`, Design) runs in stages. Each stage explores two or three directions, critiques them against named principles and published precedents, and records the owner's choice here with the rejected directions and why. Later stages build only on recorded choices.

| Stage | Issue | Status | Review page |
|---|---|---|---|
| 0. Wireframes and the data they need | #39 | Decided October 2026 | `wireframes.html` |
| 1. Information architecture | #40 | Next | |
| 2. Layout and grid | #41 | Blocked by #40 | |
| 3. Typography | #42 | Blocked by #41 | |
| 4. Color | #43 | Blocked by #42 | |
| 5. Diagram language | #44 | Blocked by #43 | |
| 6. Design system | #45 | Blocked by #44 | |

Review pages are standalone HTML. Open one in a browser from the repository, or use the private link given in the pull request, which works on a phone.

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
