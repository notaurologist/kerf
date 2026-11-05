# 0008: Templates as versioned TypeScript functions

Status: Accepted (October 2026). Amended by 0019: templates are made in Claude Code, starting from the owner's pictures.

## Context
A template turns parameters into parts, hardware, operations, and 3D geometry (`DOMAIN.md`, data model). The options were TypeScript functions or a declarative format interpreted by the app. The swing set alone involves trigonometry for leg splay, brace angles, and bolt positions; a declarative format would need most of a programming language to express that.

## Decision
- Each template is a module in `packages/core/src/templates/<template-id>/` exporting a Zod schema for its parameters (types, ranges, defaults), validation rules for combinations, and a pure function from validated parameters to the template output.
- Each template has an integer version. Any change that would alter output for the same parameters increments it. Projects store the version they were generated with (`PRODUCT.md`, MVP feature 2). Output counts as the same when every number is within `sameNumber` of the other (1e-6, plus 1e-12 of values past a million) and everything else is equal (owner's decision, November 5, 2026, #706). The version report uses the same comparison, so it does not show last-bit differences as changes. See 0014 for why.
- Each template has hand-checked worked examples and fit tests (`DOMAIN.md`, Verification).

## Consequences
- Templates are type-checked and unit-tested like any other code.
- Adding a template means writing code, which is fine for a one-user app.
- A version bump needs a test showing which outputs changed, so the app can tell the owner what would differ for an existing project.
- Stored snapshots also record the shape they are stored in, which changes separately from this version; see 0014.
