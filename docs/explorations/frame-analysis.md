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

McGuire, Gallagher and Ziemian, *Matrix Structural Analysis*, 2nd edition (2000), is the reference text (#545). Each formula in step 1 was checked against the printed page, with signs and the order of degrees of freedom read from page images, since the text layer drops minus signs in matrices. Page numbers are the printed ones.

| What | Where in the text | Code | Agrees |
|---|---|---|---|
| Sign convention: forces and translations along the axes, moments and rotations counterclockwise | Section 4.5.4, p. 72 | `model.ts`, `element.ts` | Yes |
| Axial member | Eq. 4.26b, Section 4.5.1, p. 67 | `localStiffness` | Yes |
| Beam bent about z: v₁, θ₁, v₂, θ₂ terms and signs | Eq. 4.32, Section 4.5.3, p. 70 | `localStiffness` | Yes |
| Complete element: the u, v, θz rows and columns of the 12 by 12 matrix, in that order at each end | Eq. 4.34, Figure 4.11, Section 4.5.5, p. 73 | `localStiffness` | Yes, term for term |
| Local from global, d' = Γ·d; k = Γᵀ·k'·Γ | Eqs. 5.11 and 5.16, Section 5.1.2, p. 98 | `transformation`, `element` | Yes |
| Γ for a member in the x-y plane | Example 5.2, p. 102 | `transformation` | Yes |
| Global [k] of a vertical and a sloped member, printed numerically | Example 5.3, p. 103 | `element.test.ts` reproduces both | Yes, to the printed digits (see below) |
| Assembly | Section 3.1, Eqs. 3.2 to 3.5, p. 33 | `analyze` | Yes |
| Supports by partitioning; reactions from K_sf·Δ_f | Section 3.2, Eqs. 3.7 to 3.9 and 3.8b, p. 41 | `analyze` | Yes; see the note on reactions |
| A singular matrix means rigid-body motion | Example 3.4, part 3, p. 44 | `solve.ts`, `analyze` | Yes |
| Static condensation | Section 13.1, Eq. 13.5, p. 376 | `condense` | Yes |
| Member end releases; a pin at end 2 | Section 13.5.1, Eqs. 13.33 and 13.34, p. 398 | `condense` | Yes: the condensation test gives Eq. 13.33 term for term |
| Cholesky factorization | Section 11.2.2, Eqs. 11.14 and 11.15, pp. 307 and 308 | `solveSymmetric` | Yes |

Notes:

- **Example 5.3.** One printed entry, 17.381 for 6EI/L²·cos φ of member bc, is 18.75 × 0.927, with cos φ rounded to three places from the figure's 7.416 m over 8 m. The exact value is 17.3817. The test allows one unit in the last printed digit for that reason.
- **Condensation.** `condense` eliminates the released rotations one at a time. Each step is one step of Gaussian elimination, which gives the same matrix as eliminating them together by Eq. 13.5 or Eq. 13.34.
- **Reactions.** Eq. 3.8b gives the total force at the supported degrees of freedom, K_sf·Δ_f. The text treats it as the reaction because it applies no load at a support. `analyze` subtracts any load applied at a supported joint from that total, so a reaction is only what the support supplies.
- **Not from the text.** Two behaviors are this package's own choices, so no page covers them. A joint whose rotation is held by neither a member nor a support has that rotation set aside and reported as `null`. A pivot at or below 10⁻¹⁰ of its own diagonal term is read as a mechanism. Section 11.2.2 says only that the matrix must be positive definite.

The closed-form examples below check the same formulas a second way.

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
