# 0012: Built-up beams in the MVP

Status: Accepted (October 2026). Reverses the "built-up beams" non-goal in `PRODUCT.md` v0.4.

## Context
The first review limited the MVP to a single solid beam, because a built-up beam (boards fastened face to face) needs its own design values and fastening rules. The owner's earlier swing set used a beam of two 2x6s, and that is a likely choice for the new one.

## Decision
- The swing-set template's beam can be one solid member, or two or three plies of 2x lumber fastened face to face.
- Geometry treats a built-up beam as one member whose width is the sum of the plies.
- Structural checks (M2) treat it as acting together only under the conditions the design source sets for built-up members, with the fastening between plies on the confirmation checklist. The rules come from the source, verified before implementation (`DOMAIN.md`, Structural checks).

## Consequences
- The cut list shows one part per ply, and the shopping list counts each ply.
- Every built-up beam gets an expert-check flag on how the plies are fastened together.
- M2 has more to verify and test: the built-up provisions and a worked example for a two-ply beam.
