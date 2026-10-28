# 0009: Knowledge base and design values as typed data in the repository

Status: Accepted (October 2026)

## Context
Kerf needs reference data that is not code: methods for each operation (tools, skills, setup, technique, common mistakes, flags), expert-check categories, skills, tool types, and NDS design values with adjustment factors. `DOMAIN.md` requires design values to be sourced and versioned, not constants in code. Options were a database table edited through the app, JSON or Markdown files, or TypeScript data modules.

## Decision
- Reference data lives in `packages/core/src/knowledge/` and `packages/core/src/design-values/` as TypeScript modules that export plain data checked with `satisfies` against types derived from Zod schemas.
- A test parses every entry with its Zod schema and checks references between entries (for example, every method's tool types and skills exist).
- Every design value and safety-relevant entry records its source and edition.
- Changes go through git like code. The database never stores reference data; projects store IDs that point into it.

## Consequences
- Type errors appear in the editor, and history and review come from git.
- Long method text is written as strings in TypeScript, which is less pleasant than Markdown. If it becomes a problem, method prose can move to Markdown files loaded at build time.
- Editing the knowledge base needs a deploy. For one user this is acceptable.
