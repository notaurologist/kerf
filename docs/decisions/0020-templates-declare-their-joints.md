# 0020: Templates declare their parts' joints, and the joints give the geometry

Status: Accepted (owner, November 4, 2026, #543). Amends 0008.

## Context
A template used to work out by hand each part's length, end cuts, and every feature cut into it, from where the other parts stand. When those formulas went wrong, the part still looked right on its own: a mortise past a leg's face, a dado edge a hair below zero, a door frame wider than a board (#561 to #563). Fit checks (#570) and parameter sweeps (#571) now catch some of that after the fact.

The joint-model exploration (#543, `docs/explorations/joint-model.md`) tried the other way. Joints are declared between placed parts, and the joints give each part's length, end cuts, and features:
- trims to a plane
- bolted laps
- housed ends in dadoes
- mortise and tenon
- stub tenons in grooves
- floating panels
- slotted screws
- through tenons
- panels in face grooves
- through dovetails

It reached parity with both existing templates, and the sweeps found four bugs the hand-checked examples had missed.

A third template, the workbench, was then built joint-first as the deciding test (#576, #577), against measures set before the build:
- **Size:** about half the hand-written code per part and per feature.
- **Hand-derived formulas:** about 35 remain, nearly all positions and joint sizes. Every length, end cut, and feature came from the joints.
- **New joints:** four, each a small addition.
- **Bugs caught:** the fit checks and sweep caught template bugs the hand tests could not. The build also found seven generic gaps in core, each fixed on `main` first.

## Decision
- **Templates declare joints.** A template places its parts and declares the joints between them: where each part stands, and how big each joint is. Lengths, end cuts, and the features a joint cuts come from the joints, not from per-part formulas. Single-part features with no partner, such as tapers, tracks, finger recesses, and dog holes, stay template rules.
- **The joints live in core,** under `packages/core/src/joints/`. They are generic code (ARCHITECTURE principle 6), each with hand-checked tests and a mutation test.
- **Every template passes the fit checks and a parameter sweep,** in its own tests and in `templates/contract.test.ts`. This includes the overlap and through-hole checks (#618).
- **Every instance of a part comes out of its joints with the same features,** or the template is wrong. Templates check this as they build.
- **The existing templates move to joints:**
  - The record cabinet's output is unchanged to the last bit, so it keeps its version.
  - The swing set's trigonometry gives the same displayed numbers but different last bits in 33 values per plan, so its version is bumped (0008). Older plans then say a newer version exists, with no visible change (owner, November 4, 2026).
- **The workbench joins the app** as the third template, with its definition, form, starting questions, drawings, build steps, and snapshots built in core from its joint-first design.
- **Remove the exploration.** The `packages/model` package, its parity harness, and the `generateWith` seams go once both templates and the workbench are moved. `explore/joint-model` is kept, not merged.

## Consequences
- A new template is mostly placements and joint sizes. A joint it needs that core lacks is added to core first, as a generic change with its own tests.
- 0008 is otherwise unchanged: templates are versioned TypeScript, and output for the same parameters still bumps the version.
- 0019 is unchanged: templates are still made in Claude Code from the owner's pictures. The `kerf-template` skill gains a step to declare joints.
- The move is a series of pull requests to `main`, one step each. Until it's done, the exploration package stays on its branch.
