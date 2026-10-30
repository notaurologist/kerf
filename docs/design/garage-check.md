# The garage check

Status: In use. Run whenever it is useful; no run gates other work.

A short, repeatable test of Kerf where it is used: on the laptop at the desk, on paper from the owner's printer, on a phone in the garage, and on a phone at the store. Each run uses the same tasks, settings, and record, so a later run can be compared with an earlier one. The design milestone's acceptance asks for screens "checked on a real phone in the garage, on the laptop, and on a printed page" (`MILESTONES.md`, Design). This page says how.

The check is one source of fixes among several, not a gate. Development does not wait on a run: real use in the garage and at the store will keep turning up changes, and each goes straight to an issue the same way a run's misses do. Run the check when it helps: after a change to a shop screen, before a build, or when something feels off and a fair comparison with an earlier run would show whether it got worse.

## Why this shape

- **Small, repeated rounds.** Nielsen found that a test with about five people finds most usability problems, and that three small rounds with fixes between them do more than one large test (Nielsen 2000). Kerf has one user, so each round is the owner, with one other person where a task allows. The rounds are repeated: fix what a round finds, then run the same tasks again.
- **In the real place.** A field test puts the product in its normal setting. It shows what a lab misses: noise, interruptions, and the way people work around problems (Farrell and Fessenden 2024). That is why the setting is part of the record.
- **Tasks, not tours.** Each task is a goal said in the shop's words ("Read the length to cut for the front leg"). It is never a path through the screens. Each has a stated result that counts as done.
- **Word labels for how a task went.** Use complete, minor issue, major issue, or failed. Do not use numbers, which invite averaging labels that are only ordered (Nielsen and Budiu 2001).
- **Severity for each problem.** Use Nielsen's 0 to 4 scale. It judges how often the problem happens, how hard it is to get past, and whether it keeps coming back (Nielsen 1994).
- **The figures the design used.**
  - Read distance is 0.5 m and glance distance 1.0 m, with characters of 16 and 20 arc-minutes (Stage 2, #41).
  - Contrast was checked under 20% glare (Stage 4, #43).
  - Shop controls are at least 56 px tall, above WCAG 2.2's 44 px enhanced target size (#41).
  - The check tests these in the real setting: a number that passes on paper but cannot be read across the bench is a miss.

### Limits

The owner designed most of what is tested and knows where everything is, which hides problems a newcomer would have. To offset some of that:
- Say each task from the sheet, without looking at the screen first.
- Do not practice the tasks.
- Ask another person to do the store tasks and the glance tasks where possible: the experienced builder from M7's plan review, or anyone who has not used Kerf.

One user still finds fewer problems than five (Nielsen 2000), so a clean run is not proof that nothing is wrong.

## Before a run

- **Build:** the deployed app at its current commit. Write the commit down.
- **Project:** a swing-set project made from the worked example (`docs/templates/swing-set-a-frame.md`), saved with no progress. Use the same parameters every run so the numbers do not change between runs.
- **Devices:** the owner's phone, the laptop, the printer. A tablet too, if one is used in the shop.
- **In the garage:**
  - A tape measure to set 1 m from the bench edge to your eyes.
  - The work gloves you wear to cut.
  - A little sawdust or a dry, dusty hand.
  - A way to prop the phone on the bench at 1 m.
- **A timer:** a phone stopwatch on another device, or a helper.
- **The record:** a copy of the results table below, one row per task.

## Tasks

Do them in order. Say each task aloud as written, then do it. Stop the timer when the "Done when" result is reached or you give up. A task needs the stated result to count as complete.

### At the desk (laptop, read distance)

| ID | Task | Done when |
|---|---|---|
| D1 | Find the plan's lowest structural margin, and say what it depends on. | You say the margin, which check it is, and one assumption it rests on. |
| D2 | Make the beam 12" longer. Before saving, say which numbers change. | You name at least the beam length and the shopping list's beam board from the preview, then leave without saving. |
| D3 | Print the whole plan. | It prints in section order with a title block on each page. No cut detail or check splits across pages, and every "Show the working" is open. |

### On paper (the printed plan from D3)

| ID | Task | Done when |
|---|---|---|
| P1 | Find the front leg in the exploded view by its cut-list letter. | You point to it in under a minute. |
| P2 | Read the back leg's length, its top cut setting, and the beam's offcut on paper, and compare each with the screen. | All three match the screen exactly. |
| P3 | Find the clearance zone in front of the swings and its source. | You read its depth and name its source. |

### In the garage (phone propped at 1 m, gloves on)

| ID | Task | Done when |
|---|---|---|
| G1 | Open Building from the plan and go to the step that cuts the front legs. | You reach it without help. |
| G2 | From 1 m, without leaning in, read the length to cut for the front leg. | You read it right the first time. |
| G3 | Find the saw setting for the front leg's top cut, and the face it is measured from. | You say the setting, not the edge angle, and the reference face. |
| G4 | With gloves on, open the front leg's cut card, mark the piece cut, then go back to the step. | No wrong taps, and the piece shows as cut. |
| G5 | Mark the step done and move to the next one; then undo it. | The step is done, the next step opens, and going back and marking it not done works. |
| G6 | Leave the phone in Building, untouched, for 5 minutes. | The screen is still on. |
| G7 | Turn on airplane mode, mark a piece cut, then turn it off. | The tick shows "not yet sent" while offline and saves when back online. The same step on the laptop shows the piece cut. |
| G8 | On the step that bolts the legs to the beam, say what the drawing adds and where it goes. | You name the beam and point to where it sits on the frames. |
| G9 | Repeat G2 with the garage door open in daylight, or under the brightest shop light. | You read it right the first time. |

### At the store (phone in one hand)

| ID | Task | Done when |
|---|---|---|
| S1 | Open Shopping from the projects list's Resume card. | The shopping list opens. |
| S2 | Open the 4x4 board card and say what to look for in a leg board. | You name two of the checks it lists. |
| S3 | With one hand, mark the 4x4 line bought. | It is ticked with no wrong taps. |
| S4 | Find the locking nuts and say how many to buy. | You read the count from the Bolts and fittings group. |

Every task can be run now; Shopping and Building exist. A run in a desktop browser's phone view is useful for catching layout and flow problems early, but it cannot stand in for the garage tasks (G2, G3, G9: distance and light) or the real-device ones (G6, G7, S3: screen sleep, airplane mode, one hand), so a run says where it was done.

## What to record

### The setting, once per run

- Date and time.
- App commit.
- Phone, its OS, browser, and brightness setting, and the same for the tablet if used.
- Laptop and browser.
- The printer and paper.
- In the garage: the light (overhead on or off, door open or shut, sun or overcast), the gloves worn, and whether the screen was dusty.
- At the store: which store, and how full your other hand was.
- Who did each task, if not the owner.

### Each task

| Field | What to write |
|---|---|
| Result | Complete, minor issue, major issue, or failed (Nielsen and Budiu 2001). |
| Time | Seconds to the result, or to giving up. |
| What happened | What you did, in a sentence, especially any wrong turn, squint, wrong tap, or reread. |
| Problems | Each problem seen, with its severity: 0 not a problem, 1 cosmetic, 2 minor, 3 major, 4 catastrophe (Nielsen 1994). |
| Issue | The issue opened for it. |

### After the run

- Open an issue for every task that was not complete and every problem rated 2 or higher, labeled with the task ID. Collect the problems rated 1 into one issue.
- Do not fix anything during a run. Finish the tasks, then fix, then run again.
- Add the run to the results below, beside the earlier runs, so the same task can be compared across runs.

## Results

Copy the table for each run, under a heading with the run's date, commit, and where it was done.

### Dry run, 30 October 2026, `bfb4f61`, desktop browser only

Done by Claude in the in-app browser's phone view (375 × 812) and a narrow desktop pane, on a local copy of the app with the worked example and every structural input entered. A browser can't test distance, light, gloves, one hand, a real phone's sleep, or paper, so those tasks are marked not run. Taps were made with a mouse; the offline tick was simulated by making the page's requests fail.

| Task | Result | Time | What happened | Problems (severity) | Issue |
|---|---|---|---|---|---|
| D1 | Minor issue | not timed | Found bending at 1.1x, the lowest, by reading all four checks in the structural review. | The plan has no summary of the lowest margin (1). | #119, #136 |
| D2 | Complete | not timed | The preview showed the beam at 132" (was 120") and bending dropping to 0.9x; the lumber is unchanged, since 132" still fits the 12' board. In the narrow pane the preview sits below the form. | | |
| D3 | Not run | | Needs the printer. | | |
| P1 to P3 | Not run | | Need the printed plan. | | |
| G1 | Minor issue | not timed | The step list names boards, not parts, so finding the front legs' step meant guessing which 4x4 board. | Step titles don't name their parts (2). | #131 |
| G2 | Not run | | Needs 1 m in the garage. The glance size was chosen for 20 arc-minutes at 1 m (Stage 3). | | |
| G3 | Minor issue | not timed | The saw setting is boxed and clear. The reference face is only in the note under the drawing, at the bottom. | Reference face far from the end cuts; ends headed "End 1" and "End 2", not "Top" and "Foot" (2). | #132 |
| G4 | Complete | not timed | Ticked the piece on the cut card and went back; the step showed it cut and the server had it. | "Back to the step" only at the bottom of the card (1). | #136 |
| G5 | Complete | not timed | Done, next, then Back, then Mark not done all worked. | "Mark not done" is link-sized, under the 56 px shop controls (2). On a phone the board drawing is after all the method text (2). | #133, #134 |
| G6 | Not run | | Needs a real phone left alone for 5 minutes. | | |
| G7 | Complete | not timed | Simulated: the tick showed "On this phone, not yet sent" and the notice, then saved when requests worked again. Needs a real airplane-mode run. | | |
| G8 | Minor issue | not timed | The beam step's action drawing is clear, but on a phone it starts about 1,450 px down a 1,925 px page. | Drawing far below the step's title (2). | #134 |
| G9 | Not run | | Needs daylight or the brightest shop light. | | |
| S1 | Minor issue | not timed | The Resume card opened Shopping. With two front-leg pieces ticked as cut, it still said "Resume shopping" and "Building: 11 steps, not started". | Cut pieces don't count as building progress (2). | #135 |
| S2 | Complete | not timed | The 4x4 card's guidance named the leg boards and what to check. It comes after all four board cards. | Long scroll to the guidance (1). | #136 |
| S3 | Not run | | Needs one hand at the store; the tick itself works. | | |
| S4 | Complete | not timed | 18 locking nuts, under Bolts and fittings. | | |

## Sources

Checked October 2026.

- Nielsen, J. (2000). [Why You Only Need to Test with 5 Users](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/). Nielsen Norman Group. About five users find most problems (N(1 − (1 − L)^n), L ≈ 31%); three small rounds with fixes between beat one large test; one user is risky.
- Nielsen, J. (1994). [Severity Ratings for Usability Problems](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/). Nielsen Norman Group. The 0 to 4 scale; severity combines frequency, impact, and persistence.
- Nielsen, J., and Budiu, R. (2001, reviewed 2021). [Success Rate: The Simplest Usability Metric](https://www.nngroup.com/articles/success-rate-the-simplest-usability-metric/). Nielsen Norman Group. Task success, with partial success given as word labels rather than averaged numbers.
- Farrell, S., and Fessenden, T. (2024). [Field Studies](https://www.nngroup.com/articles/field-studies/). Nielsen Norman Group. Testing in the real setting; plan the questions so observations are consistent; context such as noise and distraction matters.
- Stage 2 (#41), Stage 4 (#43), and Stage 0's G-A wireframe in `README.md`: the read and glance distances, glare contrast, and target sizes the tasks test.
