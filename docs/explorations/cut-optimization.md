# Cut optimization

Status: in progress (November 2026). Issue #544, steps #662 to #665. Code in `packages/cutting` on `explore/cut-optimization`; nothing in `apps/` imports it.

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

## Report

`pnpm --filter @kerf/cutting report [draws per template]` writes `packages/cutting/report.md`: totals per method, then every instance. Times are from one run on the machine that wrote it.

## Results so far

A throwaway search before this package existed, stopped at 5 seconds per stock, found the grouping already optimal on the swing set examples and 2 to 4 ft over the best plan found on the record cabinet and workbench examples (#544). The lower bounds in step 2 will say how close it is in general.
