# 0010: Local pre-push checks, free CI, Vitest, Biome, and PGlite

Status: Accepted (October 2026)

## Context
The owner uses free tiers only. GitHub Actions on standard runners is free for public repositories, and this repository is public. rowing-conditions settled the same questions in its decisions 0009, 0015, and 0016.

## Decision
- **Vitest** for tests in every package. **Biome** for linting and formatting.
- Every test must make at least one assertion (`expect.requireAssertions`, set in each package's Vitest config), so a check inside a loop over nothing fails instead of passing empty.
- `pnpm check` runs lint, typecheck, and tests. A git pre-push hook (`.githooks/pre-push`) runs it; `pnpm install` turns the hook on through the root `prepare` script.
- **GitHub Actions** runs `pnpm check` on pull requests and pushes to `main`, as long as it stays free.
- CI also builds the web app and fails when `schema.ts` has changes with no committed migration. Changes that touch only Markdown or `docs/` skip CI, and Biome does not check them.
- Lint warnings fail `pnpm lint`, and focused or skipped tests (`.only`, `.skip`) are errors.
- Actions are pinned to commit SHAs, with the version in a comment. A newer push cancels a pull request's run in progress; runs on `main` always finish.
- Every dependency version is exact and `engineStrict` is set; a test checks each `package.json`.
- **Web interaction tests use happy-dom** (0017); the rest render to a string in Node.
- **Database tests use PGlite** in process, with the committed Drizzle migrations applied to a fresh database. Docker Compose Postgres 18 is for local development only.

## Consequences
- `pnpm check` runs anywhere with no Docker.
- Making the repository private would make Actions minutes metered; raise it with the owner first.
- Behavior that differs between PGlite and server Postgres gets a manual check against Docker Postgres.
