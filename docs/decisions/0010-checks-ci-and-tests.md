# 0010: Local pre-push checks, free CI, Vitest, Biome, and PGlite

Status: Accepted (October 2026)

## Context
The owner uses free tiers only. GitHub Actions on standard runners is free for public repositories, and this repository is public. rowing-conditions settled the same questions in its decisions 0009, 0015, and 0016.

## Decision
- **Vitest** for tests in every package. **Biome** for linting and formatting.
- Every test must make at least one assertion (`expect.requireAssertions`, set in each package's Vitest config), so a check inside a loop over nothing fails instead of passing empty.
- `pnpm check` runs lint, typecheck, and tests. A git pre-push hook (`.githooks/pre-push`) runs it; `pnpm install` turns the hook on through the root `prepare` script.
- **GitHub Actions** runs `pnpm check` on pull requests and pushes to `main`, as long as it stays free.
- **Database tests use PGlite** in process, with the committed Drizzle migrations applied to a fresh database. Docker Compose Postgres 18 is for local development only.

## Consequences
- `pnpm check` runs anywhere with no Docker.
- Making the repository private would make Actions minutes metered; raise it with the owner first.
- Behavior that differs between PGlite and server Postgres gets a manual check against Docker Postgres.
