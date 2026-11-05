# 0021: The shopping list buys the fewest feet a bounded search finds

Status: Accepted (owner, November 5, 2026, #677).

## Context
`planLumber` groups each stock's pieces into buyable boards by first-fit decreasing, then shortens each board to the shortest length that still holds its pieces. `PRODUCT.md` called this "simple grouping, not optimization" and listed cut optimization as a non-goal of the MVP.

The cut optimization exploration (#544, `docs/explorations/cut-optimization.md` on `explore/cut-optimization`) compared it with an exact method on 260 instances from all three templates: their examples and a seeded sweep of each. The exact method is a branch-and-bound over boards, pruned by a material bound and a linear relaxation solved by column generation. It is written by hand, with no dependency.

- First-fit decreasing buys 2.0% more lumber than the exact method overall. 253 of the 260 instances are proven optimal, and the 7 that are not are within 22 ft of their bounds.
- The saving is in board stock: the record cabinet's worked example goes from 100 ft to 94 ft of cherry, and the workbench's from 386 ft to 376 ft. The swing set's plans barely change.
- The exact plans buy slightly more boards (47 more over the 260 instances), shorter on average, and leave shorter offcuts.
- Swing set and record cabinet stocks solve in milliseconds. The largest workbench stocks can take seconds.

## Decision
- **`planLumber` plans each stock with the exact method,** minimizing total feet bought, with fewer boards as the tie-break. First-fit decreasing stays as the search's starting plan and its fallback.
- **The search stops at a work limit, not a time limit.** The limit counts work done (nodes, relaxation rounds, or knapsack calls), so the same parameters give the same plan on every machine and under any load. At the limit the best plan found so far is kept. The limit is measured before adoption, set so a workbench plan generates in well under a second.
- **If that limit loses most of the workbench saving,** the exact method is used only for stocks where the search finishes within it, and first-fit decreasing for the rest. The owner sees the measurement before this is settled.
- **The shopping list says what the plan is:** the fewest feet the search found under the stated kerf and trim, and whether that is proven for each line. It does not call a plan optimal where the search stopped early.
- **The code moves into core** as generic code under `packages/core`, with the exploration's hand-checked examples and oracle tests. `packages/cutting` stays on its branch for the report.

## Consequences
- Every template's version is bumped (0008), with new snapshot fixtures and catalog samples (0014), since the boards change for the same parameters.
- Boards are sorted into a stable cutting order, longest pieces first as today. Board IDs stay by line and position, so saved progress on a board survives where its line's boards are unchanged, and progress resets (#444) handle the rest.
- Plans buy shorter offcuts, so a miscut piece is less likely to have spare board to recut from. The shopping list notes this.
- `PRODUCT.md` no longer lists cut optimization as a non-goal, and `DOMAIN.md`'s buyable lengths describe the search.
- Store alternatives (#450) keep refitting with first-fit decreasing. Whether they use the exact method too is left open.

## Measured cost, November 5, 2026 (#698)

Measured with the planner in core, after it reached the shopping list. `packages/core/src/templates/planCost.test.ts` asserts each worked example's work exactly and times the slowest one.

- **Work:** the workbench's worked example spends 35,896,819 units of the 40,000,000 limit and proves its plan. The tallest bench spends the whole limit (40,000,362 units, the last step past it) and keeps the plan found by then. The record cabinet's worked example spends 4,353,072 units. Every swing set stock spends under 300.
- **Time, development machine** (Apple M1 Pro, Node 24): generating the tallest bench with nothing cached took 0.76 s with little else running, and 1.2 to 2.2 s while other test runs shared the machine. That is under a second, but not "well under" as the decision above set out.
- **Time, GitHub's runners:** the same took 1.46 s in the timing test on #711's CI run, about twice the development machine's quiet time. Every test passed there with the timeouts lowered from 30 s to 10 s (core), 15 s (web), and 20 s (API).
- **Production was not measured.** A Vercel function generating the tallest bench on a new instance pays the same search; how long it takes there is not known.

The timing test's budget is 3 s locally and 5 s on CI, so it catches a slowdown of several times, not a small one. Locally it failed at eight times the search's time and passed at four. Doubling the work the search charges fails the work assertions instead.

## One limit shared by every stock (#708)

`planLumber` gives the whole plan one work limit. Stocks are searched in turn, each with the work the ones before it left, and the searches for plans within the carry length get what is left after that (`outputs/shoppingList.ts`). So once a plan spends its limit, a stock's boards can depend on how hard the stocks searched before it were. Editing one stock (adding a piece, changing its length) can change another stock's boards, and a changed board resets its progress (#444) even though nothing about that stock changed. Below the limit this cannot happen: every search finishes and proves its plan, whatever it was given.

Measured November 5, 2026, by running every worked example and every draw of each template's sweep (800 per template) and recording each stock search's limit, work, and whether it proved its plan:

- The swing set and record cabinet never come near the limit. The most any of their plans spends is the record cabinet's worked example, 4,353,072 units.
- The workbench spends the whole limit in its tallest-bench worked example and in 61 of its 800 sweep draws. The workbench buys one stock of lumber, so each of those plans has one search, and it has the whole limit.
- No example or draw has a stock that stopped early because an earlier stock spent the work. The effect described above happens in none of them today.

The planner is unchanged. If a template comes to plan several stocks that each need much of the limit, giving each stock a floor of the limit is the fix to weigh then.

The work is in the Cut optimization adoption milestone: #684 (work limit), #685 (move into core), #686 (shopping list).
