# Frame analysis

Status: in progress, step 1 of 6 (November 5, 2026). Exploration #545, on `explore/frame-analysis`. Nothing in `apps/` imports `packages/frame`.

Every result this exploration prints is headed "Exploratory frame analysis, not a structural check" and lists its assumptions. It sits beside the sourced checks and replaces none of them (`PRODUCT.md` principle 2). Results read as forces, displacements, and margins under stated assumptions, never as verdicts (hard rule 2).

## The question

What does a whole-frame analysis of the swing set show that the per-member checks cannot? Specifically: how the swings' push is shared between the legs, crossbar, gusset, and beam; what each foot carries; and how far the frame sways along the beam, which Kerf has no answer for today.

It is also a way to learn the direct stiffness method, the basis of frame analysis software, on a structure Kerf already describes.

## Method

The direct stiffness method, written in `packages/frame` with no dependency.

1. **Element.** Each member is a plane frame element with two joints and three degrees of freedom at each: axial, transverse, and rotation. Its stiffness in local axes is the Euler–Bernoulli matrix in EA/L, 12EI/L³, 6EI/L², 4EI/L, and 2EI/L (`element.ts`, `localStiffness`).
2. **Releases.** A member pinned to a joint has the moment at that end released by static condensation. The released rotation is eliminated as one step of Gaussian elimination, which leaves 3EI/L³, 3EI/L², and 3EI/L for a member pinned at one end, and an axial-only member when both ends are released.
3. **Transformation.** Γ takes global end displacements to local ones, d' = Γ·d, and the element's global stiffness is k = Γᵀ·k'·Γ.
4. **Assembly.** Each element's global stiffness is added into the structure's at its joints' degrees of freedom.
5. **Supports.** A support holds some of a joint's degrees of freedom: fixed (x, y, rotation), pinned (x, y), roller (one translation), or any combination (`restraints`), for example a guided end. Held degrees of freedom are set aside and the free ones are solved. Prescribed settlements are not modeled.
6. **Solver.** A Cholesky factorization written in the package (`solve.ts`). A stable frame's stiffness matrix, with its supports applied, is positive definite. When a pivot vanishes (at or below 10⁻¹⁰ of its own diagonal term), the frame is a mechanism. The analysis then reports the joint and direction where it ran out of stiffness, and no numbers.
7. **Results.** Joint displacements (inches and radians) in global axes, support reactions (pounds and inch-pounds) in global axes, and each member's end forces in its local axes, f' = k'·Γ·d. Nothing is rounded; rounding belongs to whatever displays the results (hard rule 4).

A joint where every member's end is released and no support holds rotation has no stiffness in rotation. It is set aside and its rotation reported as `null`, since nothing there turns with the joint. A moment applied at such a joint is reported as a mechanism.

Loads are applied at joints only. Member loads (self-weight, distributed loads) are not needed for the swing set's load cases, which act at the beam. They would need fixed-end forces, and are left until a step needs them.

### Source

McGuire, Gallagher and Ziemian, *Matrix Structural Analysis*, 2nd edition (2000) is the reference text (#545). For step 1, the element stiffness matrix, the transformation, assembly, supports by partitioning, and condensation for releases are the standard forms that text presents.

**Verification status.** The text's full PDF (Bucknell Digital Commons, `digitalcommons.bucknell.edu/books/7`) could not be fetched from this environment: the server refused the request (HTTP 403), and the browser pane offers it only as a download. So the formulas have not yet been checked page by page against the printed text, and no equation numbers are quoted here. They are checked instead against closed-form results that are derived independently in the tests' comments:

- the element's terms for round values of E, A, I, and L;
- condensation giving 3EI/L³, 3EI/L², and 3EI/L for a member pinned at one end;
- a cantilever, a propped cantilever, a beam with an internal hinge, and a fixed-base portal frame (below).

Checking against the printed text, with chapter, section, and equation numbers recorded here, is still open for this step.

## Worked examples (step 1)

All use E = 1,000,000 psi and round dimensions so that each can be checked on paper. The working is in `packages/frame/src/analyze.test.ts`.

| Example | Closed form | Result |
|---|---|---|
| Cantilever, L = 100 in, I = 100 in⁴, 300 lb at the tip | PL³/3EI, PL²/2EI, PL | 1.0 in, 0.015 rad, 30,000 in-lb |
| The same cantilever standing as a leg | the same, through Γ | the same |
| Propped cantilever, L = 100 in, 1,600 lb at midspan | 5P/16, 3PL/16, 7PL³/768EI, PL²/32EI | 500 lb, 30,000 in-lb, 0.14583 in, 0.005 rad |
| The same, pinned by a member end release at a fixed support | as above | as above, no moment at the release |
| Two 50 in cantilevers joined by a hinge, 1,600 lb at the hinge | (P/2)(L/2)³/3EI | 1/3 in |
| Fixed-base portal, h = 100 in, L = 200 in, I_b/L = I_c/h, 1,000 lb lateral | Δ = Hh³(2 + 3k)/(12EI_c(1 + 6k)) from slope-deflection | 25/42 in sway, base moments 200,000/7 in-lb, beam end moments 150,000/7 in-lb |

The portal's closed form ignores axial shortening, so the test gives its members a large area and allows a relative difference of 10⁻⁶. The others agree to 10⁻⁹.

Mechanisms are tested too: a beam on two vertical rollers, a joint with no members, a portal whose bases and beam ends are all pinned, and a moment on a fully released joint.

## Assumptions

These hold for every result this exploration prints, and are listed with each one.

- Linear elastic, small displacements, Euler–Bernoulli members (plane sections stay plane, shear deformation ignored). No second-order (P-Δ) effects and no buckling of the whole frame.
- Members are prismatic, with E, A, and I from the section and grade the owner entered (step 2 onward).
- Bolted joints are run twice: pinned and rigid. The real joint lies between them. Step 3 looks for a sourced rotational stiffness from a bolt slip modulus.
- Feet on pads are pinned; the uplift case runs with the lifting foot released. Buried legs are fixed at grade, and the soil makes the real fixity lower.
- Loads are the quasi-static load cases the existing checks use. No dynamic or modal analysis.
- Out of scope: connection capacity, soil, sliding, and whole-frame buckling. They stay on the checklist.

## Plan of steps

Each step is blocked by the one before. Pull requests go into `explore/frame-analysis`.

1. #726 Package, 2D frame element, and solver, tested against hand-checked examples. *This step.*
2. #727 One A-frame in its plane from the template's placements and joints, pinned and rigid, checked against #467's foot reactions and #468's leg load in the worked example.
3. #728 Bolt slip source: NDS 2024's load/slip modulus and whether it may be used beyond group action, the textbook basis for a bolt group's rotational stiffness, and Eurocode 5 (EN 1995-1-1, 7.1) as a cross-check. A third joint case if the basis holds.
4. #729 3D frame element and the whole swing set, with sway along the beam for buried legs and for pads.
5. #730 A sweep over the template's parameters: where sway is largest and how far the joint cases differ.
6. #731 Write-up and an adoption proposal, if there is one to make.
