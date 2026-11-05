# Cut optimization

Status: done, adoption proposed (November 4, 2026). Issue #544, steps #662 to #665. Code in `packages/cutting` on `explore/cut-optimization`; nothing in `apps/` imports it.

## Question

How far is the shopping list's grouping from the fewest feet of lumber that could hold the same pieces, and is an exact method worth adopting?

## The problem

Each stock is its own one-dimensional cutting-stock problem with several stock lengths. An instance is one stock's pieces, the lengths it is sold in, the saw kerf, and the end trim, exactly as `planLumber` in core groups them: a panel's boards and a strip glue-up's boards are pieces of their board stock, and every other part is a piece of its own stock (`instancesFromParts`).

A board of length *L* holds a set of pieces when 2·trim + Σ(piece + kerf) ≤ *L*. Kerf is charged once per piece, as `planLumber` charges it. Pieces are never joined end to end (DOMAIN.md, Buyable lengths).

## Objective (owner, #544)

Fewest total feet bought, ties broken by fewest boards. Prices are not modelled: they vary by store and week, and the owner chose not to add them as inputs.

## Instances

- Every template's worked examples (`examples` on each definition).
- A seeded sweep of each template's parameters, drawn as core's sweep tests draw them. Those draws are private to core's tests, so `sources.ts` copies them; a draw that drifts from core's still gives valid instances, only different ones.
- Instances with the same lengths, allowances, and piece lengths are counted once.

With 200 draws per template and seed 544, the schemas and templates accept about 110 plans, giving 260 distinct instances.

## Checking plans

`planProblems` refuses a plan unless every piece is on exactly one board or is listed as fitting no length, every board is a buyable length, and every board's pieces, trim, and kerf fit it. `runMethods` refuses to report a plan the checker finds a problem with, so every number in the report comes from a checked plan.

## Baseline

`firstFitDecreasing` is today's grouping: pieces longest first into the longest length, each into the first open board with room, then each board shortened to the shortest length that holds it. A test compares it with `planLumber` board for board, pieces in order, on every example and 60 sweep draws per template.

## Steps

1. Package, checker, baseline, and report (#662).
2. Lower bounds: a material bound, then the linear relaxation by column generation (Gilmore and Gomory, 1961 and 1963), with a simplex and a knapsack written in the package (#663).
3. An exact method that proves the fewest feet or reports its gap (#664).
4. Write-up and adoption proposal (#665).

## Lower bounds

Every buyable length is a whole number of feet, so a plan's total is a multiple of the lengths' greatest common divisor (2 ft for 8, 10, 12, 14, 16), and each bound rounds up to the next multiple.

- **Material** (`materialBound`): the least total of lengths whose room after trim covers every piece and its kerf, ignoring how pieces divide among boards. A small dynamic program over total feet.
- **Linear relaxation** (`relaxation`): the cutting-stock linear program by column generation (Gilmore and Gomory, 1961 and 1963). Minimize the feet of the boards cut, Σ feet(p)·x(p), subject to Σ counts(p, i)·x(p) ≥ demand(i) for each piece length i. It starts from one single-length pattern per piece length and solves the dual, max Σ demand(i)·price(i) subject to Σ counts(p, i)·price(i) ≤ feet(p), whose slack basis is a feasible start, so the simplex (`simplex.ts`, Bland's rule) needs no first phase. For each buyable length a bounded knapsack finds the pattern worth most at the current prices. A pattern worth more than its feet enters; when none does, the prices are optimal. The knapsack (`knapsack.ts`) is a branch-and-bound over counts, most value per inch first, cut by the fractional bound (Horowitz and Sahni, 1974; Martello and Toth, 1990). It works on the weights as given, so piece lengths in fractions of an inch stay exact (hard rule 4). A dynamic program over (weight, value) pairs came first and was exact too, but with many short pieces it kept tens of thousands of pairs: about 470 ms a call on one workbench instance, against 8 ms for the branch-and-bound, which took that instance's root relaxation from 27 s to 0.4 s. A test checks the knapsack against trying every count on 300 random cases.

Tests check both bounds on hand-worked examples and, on every benchmark instance from the examples and 30 draws per template, that neither bound exceeds the baseline's feet, that the relaxation's boards cover every piece at its stated cost, that no pattern is worth more than its feet at the final prices, and that the prices value the pieces at the relaxation's optimum (strong duality).

## Exact method

`solveExact` is branch-and-bound over boards. A node holds the pieces still to place, counted by length. It branches on the longest length left: some board must hold one of those pieces, so it tries every board that does, cut from the shortest buyable length that holds it, with no remaining piece that would still fit on it. Skipping boards with room for another piece loses no plan, since that piece could move there from its own board at no cost. A node is pruned when its feet so far plus a lower bound on what is left cannot beat the best plan by at least one step: the material bound first, as it is cheap, then the relaxation of what is left. Every residual relaxation starts from the root's patterns, which took one workbench node from about 400 ms to a few rounds. Nodes with the same pieces left, reached again at no fewer feet, are skipped. The search starts from the baseline's plan and stops when a plan meets the root's bound or its work limit runs out (Work limit, below).

Branch-and-price was the alternative: branching inside column generation (Vance, Barnhart, Johnson and Nemhauser, 1994). It needs branching rules the knapsack can respect. With at most a few hundred pieces in a few dozen lengths, branching on boards is simpler, and the residual relaxations prune just as hard.

The search proves the fewest feet. Among plans with the same feet it keeps the one with fewest boards it has found, but does not search for fewer boards at the same feet.

## Report

`pnpm --filter @kerf/cutting report [draws per template]` writes `packages/cutting/report.md`: totals per method with each method's feet over the best bound, the saving and time at each work limit, the open instances (a method over the best bound), then every instance. Times are from one run on the machine that wrote it.

## Results

A throwaway search before this package existed, stopped at 5 seconds per stock, found the grouping already optimal on the swing set examples and 2 to 4 ft over the best plan found on the record cabinet and workbench examples (#544).

With the bounds, on 260 instances (200 draws per template, seed 544):

| | Feet |
|---|---|
| Best lower bound, total | 17,760 |
| First-fit decreasing, total | 18,137 |
| Over the bound | 377 (2.1%) |

The baseline meets the bound on 186 instances and is over it on 74. The material bound is never above the relaxation on these instances.

With the exact method, 5 seconds per instance (before the work limit replaced the time limit):

| Template | Instances | Baseline (ft) | Exact (ft) | Best bound (ft) | Baseline beaten | Stopped |
|---|---|---|---|---|---|---|
| Swing set | 154 | 3,912 | 3,892 | 3,892 | 5 | 0 |
| Record cabinet | 84 | 3,683 | 3,560 | 3,560 | 47 | 0 |
| Workbench | 22 | 10,542 | 10,330 | 10,308 | 20 | 7 |
| All | 260 | 18,137 | 17,782 | 17,760 | 72 | 7 |

- The search proves 253 of 260 instances. On every one of them the best plan meets the relaxation's bound rounded up to a whole step, so on these instances the relaxation was never loose. The 7 it stopped on are large workbench instances (173 to 249 pieces), together within 22 ft of their bounds.
- Today's grouping buys 355 ft more than the exact method, 2.0%: 0.5% on the swing set, 3.5% on the record cabinet, and 2.1% on the workbench.
- The exact plans use 47 more boards in all (1,926 against 1,879): the same number on the swing set, 32 more on the record cabinet, and 15 more on the workbench. They buy shorter boards and fill them better.
- The baseline takes under 10 ms for all 260 instances. The exact method takes about 54 s in all: 35 s on the 7 instances it stopped on, and most of the rest on root relaxations of the other large workbench instances. 186 instances need no search, since the baseline already meets the bound.

On the worked examples, the plans the owner is most likely to build:

| Example | Stock | Today | Exact |
|---|---|---|---|
| Swing set, both examples | all | as exact | proven optimal already |
| Record cabinet | 13/16" x 5-1/2" cherry | 100 ft, 13 boards | 94 ft, 14 boards |
| Record cabinet, two bays, walnut | 1-1/16" x 5-1/2" | 44 ft, 6 boards | 42 ft, 7 boards |
| Workbench | 13/16" x 5-1/2" | 386 ft, 39 boards | 376 ft, 38 boards |
| Workbench, tallest | 13/16" x 5-1/2" | 476 ft, 48 boards | 470 ft, 50 boards (stopped) |

The gain is in board stock, where a project's many panel and strip boards leave room to pair pieces better. Dimension lumber for the swing set has few pieces per stock, and first-fit decreasing is almost always optimal there (5 of 154 instances beaten, 20 ft in all).

## Where the time went

- **The knapsack.** The first version (a dynamic program over (weight, value) pairs) was the whole cost on workbench instances. Replacing it with branch-and-bound cut one root relaxation from 27 s to 0.4 s.
- **Residual relaxations.** Each search node solves the relaxation of what is left, warm-started from the root's patterns. On most instances a node takes milliseconds. On the hardest workbench instances a node can take about a second, so one instance took 31 s to search 33 nodes.
- **Node budgets.** With no time limit, a budget of 50 nodes per instance saves 227 of the 355 ft, 200 nodes saves 329 ft, and 1,000 saves 349 ft. Swing set and record cabinet instances finish in under 30 ms at any of these budgets. Workbench instances take up to 31 s, because the per-node cost varies so much.
- **Proofs.** 186 of 260 instances need no search: the baseline already meets the bound. Of the 67 searched and proven, the median needs 14 nodes, and the largest, the record cabinet's worked example, needs 10,919 (0.2 s).

## Work limit (#684)

Decision 0021 adopts the exact method stopped at a work limit, so the same parameters give the same plan on any machine and under any load. `work.ts` counts the work and `solveExact` stops when it passes `workLimit`, keeping the best plan found. Nothing in the search reads the clock: a test runs a stopped workbench search three times, once with the clock jumping at random, and gets the same plan each time.

**What to count.** Counting each kind of work separately over the 260 instances, no single count tracked the time. Search nodes did not: one workbench instance spent 5.9 s on 4 nodes. Knapsack steps came closest alone. Three operations take nearly all the time, so the limit charges each in units of about the same time, from a least-squares fit of time to the three counts:

| Operation | Units |
|---|---|
| A step of the knapsack's branch-and-bound | 1 |
| A step of the enumeration of boards a node branches on | 20 |
| A simplex pivot | 1 per 25 tableau cells |
| A search node | 1 |

The fit predicts each of the 20 slowest instances' time to within 18%, and a unit took 20 to 40 ns on the machine that wrote the report. The weights only set how far a search gets before it stops; any weights give the same plan everywhere.

The fit also showed the board enumeration costing far more per step than it should: it sorted its boards with a comparator that recomputed each board's material on every comparison. Computing it once per board halved the time of the slowest workbench instances, with the same plans.

**Saving and time by limit**, from `report.md` (feet saved against first-fit decreasing; the slowest stock's time on one machine):

| Work limit | Workbench saved (ft) | All saved (ft) | Proven | Saved where proven | Slowest workbench stock | Slowest record cabinet stock |
|---|---|---|---|---|---|---|
| 3M | 0 | 141 | 237 of 260 | 137 | 52 ms | 104 ms |
| 10M | 74 | 217 | 239 | 149 | 185 ms | 134 ms |
| 20M | 112 | 255 | 241 | 175 | 389 ms | 135 ms |
| 30M | 162 | 305 | 244 | 201 | 586 ms | 132 ms |
| 100M | 198 | 341 | 249 | 259 | 1,845 ms | 130 ms |

The most any run of the exact method has saved on the workbench is 218 ft, with a limit of about 13 s on the slowest stock. The swing set saves its 20 ft and the record cabinet its 123 ft at 10M and above, so the limit only matters for the workbench. "Saved where proven" is the fallback in 0021, which uses the exact plan only where the search finishes. On the workbench it saves 58 ft at 30M, against 162 ft for keeping the best plan found, because most workbench stocks are not proven within a second.

**Chosen limit: 30M units** (owner, November 5, 2026, #689). The slowest workbench stock takes about 0.6 s on this machine, and the limit keeps 162 of the 218 ft on the workbench (74%), so the fallback does not apply. Below it the saving falls quickly: 20M keeps half, 10M a third. The owner kept 30M knowing two things:

- The workbench's worked example needs 35.9M units (about 0.57 s) to find and prove its 376 ft. At 30M it stops at today's 386 ft. A limit of 40M reaches it, with the slowest stock near 0.8 s, and saves 176 ft on the workbench.
- The times are from a development machine. The API runs on Vercel's functions, which may be slower, so a plan that takes 0.6 s here could take longer there. #685 and #686 can measure it there before release.

## What adopting it would take

Adopting means `planLumber` in core plans each stock with the exact method, keeping first-fit decreasing as its starting plan and fallback.

1. **The same plan on every machine.** Done in #684 (Work limit, above). A time limit gives different plans on different machines and loads, which would break stored snapshot fixtures (0014) and make a regeneration change a plan for no reason. The limit has to count work instead: nodes plus relaxation rounds (or knapsack calls), with the best plan found at the limit kept. A node budget alone does not bound the time, since one workbench node can cost a second.
2. **Time in the request.** Plans are generated in the API on each save and on each preview of proposed changes (`services/projects.ts`). Swing set and record cabinet stocks finish in milliseconds. The workbench's largest stocks would need the work limit set so a plan takes well under a second, which means accepting the best plan found rather than a proof on those. Measuring that limit is the first task of adoption; #684 set it at 30M units.
3. **A template version bump for each template** (0008), new snapshot fixtures, and new catalog samples, since the boards change for the same parameters.
4. **Cutting order and board IDs (#57, #58).** Boards come out in the search's order. They need sorting into a stable cutting order: longest pieces first, as today. Board IDs are by line and position, so saved progress on a board survives only where its line's boards are unchanged. Progress resets (#444) already handle the rest.
5. **Store alternatives (#450).** `lengthAlternatives` refits a line's pieces onto shorter lengths with first-fit decreasing. It can keep doing so. Whether it should use the exact method too is a smaller follow-up.
6. **More boards, shorter.** The exact plans buy 47 more boards over 260 instances, and leave shorter offcuts. A miscut piece is less likely to have a spare piece of board left to recut from. A note on the shopping list could say so. The objective could also add a small allowance per board, which the owner would set.
7. **Copy and docs.** `PRODUCT.md` lists cut optimization as a non-goal of the MVP and calls the shopping list "simple grouping, not optimization". Both would change, as would DOMAIN.md's Buyable lengths, and the shopping list's notes would say the plan buys the fewest feet the search found, proven or not.

### Proposal

Adopt it, for every stock, with a deterministic work limit and first-fit decreasing as the fallback. The saving is small overall (2%) but concentrated where lumber is dearest: 6% of the cherry on the record cabinet's worked example and 2.6% of the workbench's. The swing set's plans barely change. The work-limit measurement (item 2) comes first, and its result could change this proposal: if the limit that keeps workbench plans under a second loses most of the saving there, adopting it only for stocks where the search finishes is the fallback.

The alternative is to leave the shopping list as it is and offer the exact plan as a "uses N ft less" alternative under each line. That keeps today's plans stable, but shows two plans where one would do.

The owner decides in #677.

## Still open

- Branch-and-price, to see whether proofs on the largest workbench instances come within reach.
- Sheet goods: 2D guillotine cutting, if a plywood template arrives.
- Whether fewer boards at equal feet should be proven rather than only preferred.

