# AGENTS.md

Kerf is a personal planning tool for woodworking projects. Pick a template, set its parameters, and it generates a cut list, shopping list, diagrams, build steps adapted to the owner's tools, and structural sanity checks. The first template is a two-swing A-frame swing set. One user; no accounts.

## Read before working

| Doc | Read when |
|---|---|
| `docs/PRODUCT.md` | Always, once per session. Scope, principles, non-goals. |
| `docs/DOMAIN.md` | Anything touching lumber, geometry, units, structural checks, flags, or user-facing copy. |
| `docs/ARCHITECTURE.md` | Any code change. |
| `docs/MILESTONES.md` | Picking up or scoping work. |
| `docs/decisions/` | Before changing a technology or pattern. Do not relitigate recorded decisions without asking. |

## Hard rules

1. **No AI-generated numbers.** Every dimension, angle, quantity, and structural result comes from template and check code in `packages/core` (0001).
2. **Margins, not verdicts.** Never write "safe," "unsafe," "pass," or "fail" in code, copy, or tests. Report "margin N.Nx under these assumptions."
3. **No hidden structural defaults.** Species and grade, rider weights, swing angle, dynamic factor, deflection limit, and hardware ratings are entered or confirmed by the user. Missing means "input needed."
4. **Exact until display.** Store lengths in decimal inches and angles in degrees, miter-saw convention (0° = square). Round to 1/16 only in core's display formatters, and never compute with rounded values.
5. **Source every safety-relevant claim and design value.** Record the source and edition in the data. Verify formulas and values against the source before implementing.
6. **Numbers in core, logic not only in the client.** The web app renders snapshots from the API and does not compute values it presents as authoritative.
7. **Parse at boundaries with Zod:** request input, stored JSON read back from Postgres, and reference data.
8. **Geometry and structural changes need hand-checked worked examples** in tests. A change that alters template output for the same parameters bumps the template version (0008).
9. **Every API route except login requires a session** (0007), with a test for it.
10. **Generic tool suggestions only.** No brands or products.
11. **No secrets** in code, tests, fixtures, or logs.
12. **Ask before** adding a dependency, changing a recorded decision, or expanding scope beyond the current milestone.

## Stack

pnpm workspaces · TypeScript (strict) · Node 24 · Hono · Zod · Postgres with Drizzle · React with Vite · SVG diagrams · Vitest · Biome · PGlite for database tests · Vercel and Neon for hosting

Versions are pinned exactly. Libraries like Hono and Drizzle change quickly: check the installed version's docs rather than relying on memory.

## Commands

Keep this list to commands that work today. None exist yet; M0 adds them.

## Conventions

- Small, focused changes. One milestone task per branch or pull request. Never commit directly to `main`.
- Tests alongside every change.
- Name things by domain terms from `DOMAIN.md` (part, stock, end cut, operation, method, flag, margin).
- No `any` without a comment explaining why.
- Update the relevant doc in the same change when behavior or decisions change.
- Prefer the correct approach over the quick one, without building ahead of the current milestone (`PRODUCT.md`, Engineering approach).

## Tracking work

Work is tracked in GitHub issues, grouped into milestones that match `docs/MILESTONES.md`.

- Pick up the lowest-numbered open issue in the earliest open milestone, skipping any that say "Blocked by #n" while #n is open. Issue bodies list docs to read and acceptance criteria.
- Issues labeled `decision` need the owner's call. Research and propose; do not decide.
- Reference the issue in the pull request with `Closes #n`.
- If work turns up a new task or question, open an issue for it instead of expanding the current pull request.
