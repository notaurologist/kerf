# 0014: Stored projects stay readable: snapshot shape versions, upgrades, and release migrations

Status: Accepted (October 2026)

## Context
Projects store their generated snapshot (`ARCHITECTURE.md`, project snapshots), so a plan never changes underneath it when a template changes (0008). The first M3 design kept only the current schemas: once a template changed the shape of what it stores, older snapshots could not be read until regenerated, which would replace their numbers. The owner asked that old designs keep working, and that migrations and backfills run as part of every release rather than by hand.

## Decision
- **Two version numbers per template.** `version` (0008) changes when the output for the same parameters changes, whether a number or anything else stored with it, such as a source added to the structural working (owner's decision, October 2026, #36). `snapshotVersion` changes when the shape of the stored snapshot changes: fields added, removed, renamed, or restructured, including parameters and structural inputs. Each snapshot records both.
- **Upgrades, one per shape step.** A template's `snapshotUpgrades[n]` turns a shape-n snapshot into shape n + 1. Reading a snapshot applies the upgrades in order, then parses it with the current schemas. Upgrades only restructure what is stored; they never call the template to recompute. A field that older versions did not produce is optional in the new shape, or derived from data the snapshot already holds. So an old plan keeps exactly the numbers it was made with, and the version report (0008) still shows what regenerating would change.
- **Fixtures that are never rewritten.** Each template commits `snapshots/v<n>.json` for every shape version: its worked examples as stored in that shape. Tests read every fixture through the upgrades, check the current fixture reads back exactly, and compare the shape of freshly generated snapshots with the current fixture. Changing what a template stores without a new shape version, an upgrade, and a new fixture fails `pnpm check`.
- **A release step.** `pnpm db:migrate` (`apps/api/scripts/release.ts`) applies the committed Drizzle migrations and then rewrites every snapshot stored in an older shape in the current one (the backfill). Vercel runs it in every production build of the API service; preview builds skip it. It uses Neon's direct connection (`DATABASE_URL_UNPOOLED`) when set. If any stored snapshot cannot be read, it fails the build, so code that cannot read existing projects does not go live.
- **Migrations are compatible with the code still running.** The release runs before the new code serves requests, so a migration must not break the previous deploy: add before using, and remove only what the previous deploy no longer reads.
- Parameters and structural inputs live only in the snapshot, so upgrades keep one copy current. The `projects` columns that duplicated them are dropped (migration 0001).

## Consequences
- Upgrades accumulate. They are small pure functions over JSON with a fixture each, which is cheaper than losing old plans.
- A backfill that fails partway leaves some rows in the old shape; reads upgrade them anyway, and the next release finishes the job.
- A production build needs database access. If the release fails, the deploy fails and the previous deploy keeps serving.
- Rolling back code past a shape change leaves snapshots in a newer shape than the old code reads. It reports them as `newer-snapshot` instead of guessing; roll forward instead.
