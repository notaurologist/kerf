# Cut optimization

Status: in progress (November 2026). Steps 1 to 3 done. Issue #544, steps #662 to #665. Code in `packages/cutting` on `explore/cut-optimization`; nothing in `apps/` imports it.

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
- **Linear relaxation** (`relaxation`): the cutting-stock linear program by column generation (Gilmore and Gomory, 1961 and 1963). Minimize the feet of the boards cut, Σ feet(p)·x(p), subject to Σ counts(p, i)·x(p) ≥ demand(i) for each piece length i. It starts from one single-length pattern per piece length and solves the dual, max Σ demand(i)·price(i) subject to Σ counts(p, i)·price(i) ≤ feet(p), whose slack basis is a feasible start, so the simplex (`simplex.ts`, Bland's rule) needs no first phase. For each buyable length a bounded knapsack finds the pattern worth most at the current prices. A pattern worth more than its feet enters; when none does, the prices are optimal. The knapsack (`knapsack.ts`) keeps the (weight, value) pairs no other beats on both, so piece lengths in fractions of an inch stay exact (hard rule 4).

Tests check both bounds on hand-worked examples and, on every benchmark instance from the examples and 30 draws per template, that neither bound exceeds the baseline's feet, that the relaxation's boards cover every piece at its stated cost, that no pattern is worth more than its feet at the final prices, and that the prices value the pieces at the relaxation's optimum (strong duality).

## Exact method

`solveExact` is branch-and-bound over boards. A node holds the pieces still to place, counted by length. It branches on the longest length left: some board must hold one of those pieces, so it tries every board that does, cut from the shortest buyable length that holds it, with no remaining piece that would still fit on it. Skipping boards with room for another piece loses no plan, since that piece could move there from its own board at no cost. A node is pruned when its feet so far plus a lower bound on what is left cannot beat the best plan by at least one step: the material bound first, as it is cheap, then the relaxation of what is left. Every residual relaxation starts from the root's patterns, which took one workbench node from about 400 ms to a few rounds. Nodes with the same pieces left, reached again at no fewer feet, are skipped. The search starts from the baseline's plan and stops when a plan meets the root's bound or the time limit runs out.

Branch-and-price was the alternative: branching inside column generation (Vance, Barnhart, Johnson and Nemhauser, 1994). It needs branching rules the knapsack can respect. With at most a few hundred pieces in a few dozen lengths, branching on boards is simpler, and the residual relaxations prune just as hard.

The search proves the fewest feet. Among plans with the same feet it keeps the one with fewest boards it has found, but does not search for fewer boards at the same feet.

## Report

`pnpm --filter @kerf/cutting report [draws per template]` writes `packages/cutting/report.md`: totals per method with each method's feet over the best bound, the open instances (a method over the best bound), then every instance. Times are from one run on the machine that wrote it.

## Results so far

A throwaway search before this package existed, stopped at 5 seconds per stock, found the grouping already optimal on the swing set examples and 2 to 4 ft over the best plan found on the record cabinet and workbench examples (#544).

With the bounds, on 260 instances (200 draws per template, seed 544):

| | Feet |
|---|---|
| Best lower bound, total | 17,760 |
| First-fit decreasing, total | 18,137 |
| Over the bound | 377 (2.1%) |

The baseline meets the bound on 186 instances and is over it on 74. The material bound is never above the relaxation on these instances.

With the exact method, 5 seconds per instance:

| Template | Instances | Baseline (ft) | Exact (ft) | Best bound (ft) | Baseline beaten | Stopped |
|---|---|---|---|---|---|---|
| Swing set | 154 | 3,912 | 3,892 | 3,892 | 5 | 0 |
| Record cabinet | 84 | 3,683 | 3,560 | 3,560 | 47 | 0 |
| Workbench | 22 | 10,542 | 10,348 | 10,308 | 18 | 11 |
| All | 260 | 18,137 | 17,800 | 17,760 | 70 | 11 |

- The search proves 249 of 260 instances. On every one of them the best plan meets the relaxation's bound rounded up to a whole step, so on these instances the relaxation was never loose. The 11 it stopped on are all large workbench instances (170 to 250 pieces), and together they are within 40 ft of their bounds.
- Today's grouping buys 337 ft more than the exact method, 1.9%: 0.5% on the swing set, 3.5% on the record cabinet, and 1.9% on the workbench.
- The exact plans use 49 more boards in all (1,928 against 1,879). They buy shorter boards and fill them better.
- The baseline takes under 10 ms for all 260 instances. The exact method takes about 75 s in all, nearly all of it on the 11 instances it stopped on and on root relaxations of the larger workbench instances.
