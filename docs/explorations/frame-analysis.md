# Frame analysis

Status: in progress, step 2 of 6 (November 5, 2026). Exploration #545, on `explore/frame-analysis`. Nothing in `apps/` imports `packages/frame`. From step 2, `packages/frame` depends on `@kerf/core` for the swing set's plan, design values, and loads.

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
| Rigid end offsets: [T] (forces at the joints from forces at the member's ends), displacements by [T]ᵀ, k = [T]·Γᵀ·k'·Γ·[T]ᵀ, and end forces k'·Γ·[T]ᵀ·Δ | Section 13.5.2, Eqs. 13.37 to 13.41 and Example 13.8, pp. 399–401 | `offsetTransformation`, `element`, `analyze` (step 2) | Yes, signs read from the page images; see the note on offsets |

Notes:

- **Example 5.3.** One printed entry, 17.381 for 6EI/L²·cos φ of member bc, is 18.75 × 0.927, with cos φ rounded to three places from the figure's 7.416 m over 8 m. The exact value is 17.3817. The test allows one unit in the last printed digit for that reason.
- **Condensation.** `condense` eliminates the released rotations one at a time. Each step is one step of Gaussian elimination, which gives the same matrix as eliminating them together by Eq. 13.5 or Eq. 13.34.
- **Reactions.** Eq. 3.8b gives the total force at the supported degrees of freedom, K_sf·Δ_f. The text treats it as the reaction because it applies no load at a support. `analyze` subtracts any load applied at a supported joint from that total, so a reaction is only what the support supplies.
- **Offsets.** Eq. 13.38 measures e_i from joint 1 to the member's start and e_j from the member's end to joint 2 (Example 13.8, p. 401, and its figures). `Member.offsets` measures both from the joint, so the end's row has the opposite signs to the book's. `element.test.ts` builds [T] as Eq. 13.38 prints it and checks the element's global stiffness against [T]·Γᵀ·k'·Γ·[T]ᵀ term for term. A release on an offset member acts at the member's end, not at the joint.
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

## One A-frame in its plane (step 2)

`aFrame.ts` builds one A-frame of the swing set from a generated plan, and `pnpm --filter @kerf/frame a-frame` prints it for the worked example, buried and on pads. Every case is headed "Exploratory frame analysis, not a structural check" and carries its assumptions.

### The model

Plane coordinates: x is the plan's y (front to back, front negative), y is the plan's z (up). Nothing is typed in: each point comes from the plan's placements and the holes its bolted laps drilled, and the ground heights from its geometry.

- **The beam** crosses the A-frame's plane, so in the plane it is its cross-section, taken as rigid. It is one joint, at the leg-to-beam bolt's center: halfway between the bolt's outer ends, at the beam's mid-depth.
- **Legs** run along their centerlines from the bolt's line to the ground, as continuous members with joints at the gusset and crossbar. Each leg's top is joined to the beam's joint by a rigid link from the point where the bolt's line crosses the leg's centerline (Section 13.5.2). The part of the leg above the bolt carries nothing and is left out.
- **Crossbar and gusset** joints are at the centroid of each joint's bolts, which lies on the leg's centerline at the middle of the board's depth, since each bolt is in the middle of an equal strip. A joint's bolts act together there: this is where a bolt group's pin or rotational spring (step 3) acts.
- **Gusset.** The beam rests on the gusset (spec, Structural model, Beam; #445), so the gusset is two members meeting under the beam's center, joined to the beam's joint by a rigid link to the middle of its depth. It is not bolted to the beam, so it turns with the beam in both joint cases.
- **Sections:** each member's depth in the plane and breadth across it, from its stock, on the gross section. E' = E·C_M·C_t·C_i, with E from Table 4B for the species and grade entered for that member, C_M = 0.9 for wet service and C_t = 1.0 as the beam checks apply them, and C_i = 0.95 when incised. The values and factors are core's (`designValues`), checked against NDS 2024 and its Supplement when they were added; they were not re-read for this step. The template asks for no species for the crossbar and gusset, so the script takes them as its own inputs, and a missing one is "input needed".
- **Joints.** Pinned: the legs' tops, the crossbar's ends, and the gusset's outer ends are released. Rigid: nothing is. The legs are continuous in both.
- **Feet.** Where each leg's centerline meets the ground (`geometry.back.groundZ`, `front.groundZ`). On pads: both pinned, and, for the two pushes, the lifting foot released (held up and down only) with the other pinned. Buried: both fixed at grade, the leg below grade left out.

### Loads

From core's uplift check (`upliftFeet`, exported for this step with no change to any output): each frame's share W_f of the riders by the beam's span between its supports, half the beam's weight D = w·L/2, and the chain angle φ where each foot lifts most. Chain tension C·W_f·(3·cos φ − 2·cos θ), with the dynamic factor C on the swing part only; F = T·sin φ fore and aft, T·cos φ + D down. They act at the hangers on the beam's underside and are carried to the beam's joint, 2.75 above in the worked example, with the moment F makes about it.

Three load cases for each frame: the bottom of the arc (φ = 0, the load #468's leg check uses), pushed toward the front at the φ where the back foot lifts most, and pushed toward the back at the φ where the front foot lifts most. Each runs with joints pinned and rigid, in every support case: 12 cases for buried legs, 20 on pads.

### Worked example

The spec's worked example with Southern Pine No.2 for every member, not incised, E' = 1,260,000 psi; beam moisture content 30%, θ = 60°, dynamic factor 2. The working is in `aFrame.test.ts`.

**Foot reactions where the frame is statically determinate (#467).** On pads with the lifting foot released, the frame has three reactions, and they are the uplift check's (spec, Structural model, example 4: riders 200 and 80 lb, w = 0.433798 lb/in):

| Foot | Uplift check | Frame, pinned | Frame, rigid |
|---|---|---|---|
| Left frame, back | 189.70 | 189.70 | 189.70 |
| Left frame, front | 176.63 | 176.63 | 176.63 |
| Right frame, back | 128.96 | 128.96 | 128.96 |
| Right frame, front | 120.03 | 120.03 | 120.03 |

They agree with core's C·S − D·c_v to 10⁻⁹ lb, and the pivot takes the whole push. With both feet pinned the frame is indeterminate: the lifting foot also takes part of the push, and the left back foot's uplift is 182.90 (pinned) and 182.96 (rigid).

**Leg axial load (#468).** At the bottom of the arc, #468's leg check takes P = (C·R_s + R_w)/(2·cos α), each frame's load shared by its legs along their axes. Below the crossbar the frame gives:

| Case | P (#468) | Back leg, pinned / rigid | Front leg, pinned / rigid |
|---|---|---|---|
| Buried, riders 150 and 150 | 333.10 | 333.05 / 332.95 | 332.97 / 332.82 |
| Pads, both feet pinned, riders 200 and 80 (left frame) | 364.21 | 364.22 / 364.17 | 364.23 / 364.14 |

The difference is under 0.1%. A leg's force at its foot is Ry·cos α plus the outward thrust times sin α, and #468's equals it when the reaction lies along the leg, thrust = Ry·tan α. In the frame the crossbar carries almost nothing under a vertical load (under 1 lb), so the reaction lies nearly along the leg: buried, the thrust is 113.65 lb against Ry·tan α = 113.94. What is left goes into small moments in the legs (10 in-lb at the foot pinned, 150 in-lb rigid). On sloped ground the front foot is lower, so the two legs differ slightly. Above the gusset each leg carries less (196 lb pinned, 170 lb rigid), since the beam bears on the gusset and the gusset's bolts carry part of its load into the legs below the top.

**The push, which #468 leaves out.** The leg check says its load leaves out the swing's push toward the front and back. In the frame, pushed toward the back at φ = 47.2°, the back leg below the crossbar carries 420.7 lb buried (pinned) against 333.10, 26% more, and on pads 474.7 lb with both feet pinned and 494.5 lb with the front foot released, 30% and 36% over 364.21. The other leg goes into tension, 150 to 220 lb. The push also bends the legs: up to 933 in-lb buried and 3,561 in-lb on pads with the lifting foot released, where the crossbar carries about 155 lb of compression.

**Pinned against rigid.** The gusset is bolted to both legs and bears under the beam, so even with every bolted joint pinned it holds the legs' tops: the two runs differ little at the feet. They differ in the legs' moments and in sway. Buried, pushed toward the back, the beam moves 0.0143 in (pinned) and 0.0100 in (rigid) along the frame's plane; on pads with both feet pinned, 0.021 and 0.012; with the lifting foot released, 0.209 and 0.151.

These numbers are for the stated inputs only, under the assumptions listed with each result, and are forces and displacements, not margins against any capacity.

### Verified, and not

- Verified against the printed text: Eqs. 13.37 to 13.41 and Example 13.8 (rigid offsets), with signs read from the page images of pp. 400 and 401; the step 1 formulas, unchanged.
- Verified by hand in the tests: the frame's geometry against the spec's worked example, the sections, the loads against example 4, the determinate reactions against example 4, the legs' load against example 5, and equilibrium of every case.
- Not re-verified in this step: Table 4B's E, the wet service and incising factors, the pendulum load, and the uplift check's statics. They are core's, each with its source, verified when it was added (#468, #467).
- Not from any source: the rigid beam cross-section, the bolt groups acting at their centroids, the gusset turning with the beam, and the foot positions are modeling choices, stated with each result.

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

1. #726 Package, 2D frame element, and solver, tested against hand-checked examples. Done.
2. #727 One A-frame in its plane from the template's placements and joints, pinned and rigid, checked against #467's foot reactions and #468's leg load in the worked example. *This step.*
3. #728 Bolt slip source: NDS 2024's load/slip modulus and whether it may be used beyond group action, the textbook basis for a bolt group's rotational stiffness, and Eurocode 5 (EN 1995-1-1, 7.1) as a cross-check. A third joint case if the basis holds.
4. #729 3D frame element and the whole swing set, with sway along the beam for buried legs and for pads.
5. #730 A sweep over the template's parameters: where sway is largest and how far the joint cases differ.
6. #731 Write-up and an adoption proposal, if there is one to make.
