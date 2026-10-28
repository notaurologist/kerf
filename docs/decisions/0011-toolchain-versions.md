# 0011: Toolchain versions at M0

Status: Accepted (October 2026)

## Context
M0 pins exact versions (0002). Several tools have had major releases recently, so agents relying on memory will reach for the wrong APIs. The versions match rowing-conditions where the two projects share a tool, so both stay on one known-good set.

## Decision
Pin these as installed on October 28, 2026. `package.json` files hold the exact versions; this record lists the ones that change how code is written.

| Tool | Version | Notes |
|---|---|---|
| Node | 24 (`.nvmrc`, `engines`) | Runs the API's TypeScript directly via type stripping. No `tsx` or build step for the API. The highest version Vercel Functions offer (0006). |
| pnpm | 12.15.0 (`packageManager`) | Enforces a minimum release age on new packages. Pin a release older than about a day rather than adding exclusions. |
| TypeScript | 7.0.2 | The native compiler. Used only for `tsc` typechecking; Vite and Node strip types themselves. |
| Vite | 8.3.5 | Rolldown-based. |
| `@vitejs/plugin-react` | 6.1.2 | |
| React | 19.3.1 | |
| Hono | 4.13.13 | |
| `@hono/node-server` | 2.1.5 | |
| Vitest | 5.0.5 | Root config lists each package as a project. |
| Biome | 2.6.3 | |

Added later with the milestone that needs them: Zod (M1), Drizzle, the Postgres driver, and PGlite (M3).

## Consequences
- TypeScript settings that follow from Node type stripping: `erasableSyntaxOnly` (no enums or parameter properties), `allowImportingTsExtensions`, and relative imports written with `.ts`.
- Workspace packages export their `src/*.ts` directly; there is no build step for `packages/core` or `apps/api`.
- Check each tool's docs for the installed major before relying on remembered APIs.
