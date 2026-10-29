# Design

Status: in progress. Stage 0 (#39) is waiting on the owner's choices.

The design milestone (`MILESTONES.md`, Design) runs in stages. Each stage explores two or three directions, critiques them against named principles and published precedents, and records the owner's choice here with the rejected directions and why. Later stages build only on recorded choices.

| Stage | Issue | Status | Review page |
|---|---|---|---|
| 0. Wireframes and the data they need | #39 | Waiting on the owner | `wireframes.html` |
| 1. Information architecture | #40 | Blocked by #39 | |
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

R20 (print pages) is already M5 scope. R4, R12, R13, R16, and R19 depend on the open questions and get issues once they are answered. Options that change a recorded decision (Q1 b changes hard rule 6 and ARCHITECTURE principle 2; Q2 b and Q5 b change 0005) would get a decision issue for the owner.

### Choices

Not yet made.
