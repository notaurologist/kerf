# 0013: Built-up beams are checked one ply at a time

Status: Accepted (October 2026). Carries out 0012.

## Context
Decision 0012 says a built-up beam is checked as one member only under the conditions the design source sets for built-up members. Reading the NDS 2024 for M2 showed that it has none for beams. It covers built-up columns (15.3), shear in built-up components with load-bearing connections (3.4.1.4), and time-dependent deformation of layered members (3.1.4). Its repetitive member factor (4.3.9) needs three or more members joined by load-distributing elements, which a two-ply beam is not. Forum discussion of whether C_r applies to built-up beams is divided and is not a design source.

For identical plies that deflect together, bending stress, shear stress, and deflection come out the same whether the beam is checked as one combined section or as n plies each carrying 1/n of the load. The difference is beam stability (C_L): one combined section is n times wider, so it is much less slender than a single ply.

## Decision
- A built-up member of n identical plies is checked as one ply carrying 1/n of every load, with that ply's own breadth for beam stability.
- The repetitive member factor is not applied to built-up beams unless a template states that NDS 4.3.9 is met.
- How the plies are fastened, and that loads reach every ply (for example, hangers bolted through the full width), go on the template's confirmation checklist.
- The owner chose this over treating the plies as one solid member (October 2026), since that would rest on an assumption the NDS does not support.

## Consequences
- Margins for built-up beams are lower than a combined-section calculation would give, mainly through C_L. For a two-ply 2x6 on a 96 in span, C_L is 0.89 for one ply against 0.99 for a solid 4x6 of the same depth.
- If a design source with built-up beam provisions is adopted later, a new record supersedes this one.
