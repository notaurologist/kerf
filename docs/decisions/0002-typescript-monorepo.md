# 0002: TypeScript monorepo with pnpm workspaces

Status: Accepted (October 2026)

## Context
The owner's rowing-conditions project uses a pnpm workspace with `apps/api`, `apps/web`, and `packages/core`, and it has worked well for agent-driven development. Kerf has the same shape: pure domain logic (geometry, structural checks) shared by an API and a web client.

## Decision
- One repository with pnpm workspaces: `apps/api`, `apps/web`, `packages/core`.
- TypeScript strict everywhere. Exact version pinning.
- Node 24 for the whole workspace, matching what the host supports (0006).
- Versions installed at M0 are recorded in their own decision record at that time.

## Consequences
- Template math and structural checks live in one package that both the API and the web app import.
- One toolchain, already familiar from rowing-conditions.
