# 0010: Local pre-push checks, free CI, Vitest, Biome, and PGlite

Status: Accepted (October 2026)

## Context
The owner uses free tiers only. GitHub Actions on standard runners is free for public repositories, and this repository is public. rowing-conditions settled the same questions in its decisions 0009, 0015, and 0016.

## Decision
- **Vitest** for tests in every package. **Biome** for linting and formatting.
- Every test must make at least one assertion (`expect.requireAssertions`, set in each package's Vitest config), so a check inside a loop over nothing fails instead of passing empty. The root config cannot set it for them: a project named by its folder keeps only its own config's settings, and an inline project that inherits the root's cannot also load its package's config, which the web app needs for its Vite plugins. `apps/api/test/vitestConfigs.test.ts` checks that every workspace package has a config with the shared settings.
- `pnpm check` runs lint, typecheck, knip (unused files, exports, and dependencies; owner's approval October 2026, #224), and tests. A git pre-push hook (`.githooks/pre-push`) runs it; `pnpm install` turns the hook on through the root `prepare` script.
- **GitHub Actions** runs `pnpm check` on pull requests and pushes to `main`, as long as it stays free.
- CI also builds the web app and checks that the policy in `vercel.json` allows each inline script in the built `index.html` by its hash, fails when `schema.ts` has changes with no committed migration, and fails when a snapshot fixture hash the base commit records was changed or removed (0014). Changes that touch only Markdown or `docs/` skip CI's checks, and Biome does not check them.
- **Main requires CI on an up-to-date branch** (owner's decision, November 2026, #696). Branch protection on `main` requires the `check` job to pass, with "require branches to be up to date before merging", so a pull request merges only after its checks pass on top of the latest main. Two pull requests that each passed against an older main had merged into a main that failed CI (#693, #694). A merge queue would do the same with less waiting, but GitHub offers it only for repositories owned by an organization, and Kerf's belongs to a personal account.
- **The job always starts.** A required check that never starts leaves a pull request waiting, so the workflow has no `paths` filter. Its first step runs `apps/api/scripts/ci-changes.ts`, which lists the files changed since the base and runs the remaining steps only when one is outside `CHECKED_PATHS`'s exclusions (`apps/api/test/ciPaths.ts`), so a docs-only change passes without running them. A test checks that the workflow has no `paths` filter and that every step after the decision is gated by it.
- **A file a test reads runs CI when it changes.** Otherwise a pull request that edits only that file merges without CI and the next, unrelated pull request fails. `CHECKED_PATHS` lists the exclusions first and each doc a test reads again after them. Today that is `docs/design/system.md`, whose breakpoints table `styles.test.ts` checks the stylesheets against. Every package's Vitest config runs `apps/api/test/ciPaths.setup.ts`, which records the files each test file reads through `fs` and fails it when `CHECKED_PATHS` skips one (#433), and adds `ciPaths.plugin.ts`, which records files imported as JSON or `?raw`, since Vite reads those outside the test.
- Lint warnings fail `pnpm lint`, and focused or skipped tests (`.only`, `.skip`) are errors.
- Actions are pinned to commit SHAs, with the version in a comment. A newer push cancels a pull request's run in progress; runs on `main` always finish.
- Every dependency version is exact and `engineStrict` is set; a test checks each `package.json`.
- **Web interaction tests use happy-dom** (0017); the rest render to a string in Node.
- **Database tests use PGlite** in process, with the committed Drizzle migrations applied to a fresh database. A test compares the migrated database's tables, columns, types, nullability, and defaults with `schema.ts`, since CI's migration check compares `schema.ts` only with drizzle's snapshot. Docker Compose Postgres 18 is for local development only.

## Consequences
- After one pull request merges, the others need updating from main and another CI run before they can merge.
- `pnpm check` runs anywhere with no Docker.
- Making the repository private would make Actions minutes metered; raise it with the owner first.
- Behavior that differs between PGlite and server Postgres gets a manual check against Docker Postgres.
