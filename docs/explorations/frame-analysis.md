# Frame analysis

Status: in progress, step 3 of 6 (November 5, 2026). Exploration #545, on `explore/frame-analysis`. Nothing in `apps/` imports `packages/frame`. From step 2, `packages/frame` depends on `@kerf/core` for the swing set's plan, design values, and loads.

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
- **Crossbar and gusset** joints are at the centroid of each joint's bolts, which lies on the leg's centerline at the middle of the board's depth, since each bolt is in the middle of an equal strip. A joint's bolts act together there: this is where a bolt group's pin acts, or a rotational spring would (step 3 adds none; see below).
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

## Bolt slip and joint stiffness (step 3)

The owner asked for a rotational stiffness at each bolted joint if its basis could be verified (#545, question 2). The result: no spring is added. Each piece of the basis exists on its own, but NDS gives its slip modulus only for the group action factor, and the one free source for Eurocode 5's says a bolt's hole clearance must be added to the slip separately. The swing set's holes are 1/16" over the bolt, and that clearance is ten to fifty times the elastic slip at the loads step 2 computes. A linear spring from zero rotation does not describe these joints. Pinned and rigid stay as the two cases. What was found is below, so the owner can decide whether a textbook or Eurocode value is enough for some other use.

### What each source says

**NDS 2024: the load/slip modulus γ.** 11.3.6.1, Eq. 11.3-1, p. 74 (free view-only copy, Chapter 11). γ is defined there as the "load/slip modulus for a connection, lbs/in.", and for dowel-type fasteners in wood-to-wood connections γ = (180,000)(D^1.5), with D the fastener's diameter in inches; (270,000)(D^1.5) for wood to metal. The notation list (Chapter 1, p. 9) defines γ the same way. It appears nowhere else in the free chapters: a search of Chapters 1, 3, 11, and 12 and the Appendix for slip, stiffness, rotation, and γ finds only the group action factor and the notation entry. So NDS gives γ only to compute C_g, the share of load among fasteners in a row. It neither allows nor forbids using it for a joint's stiffness or rotation, does not say whether it is per shear plane, and does not mention hole clearance in the definition. The NDS Commentary, which might say where γ comes from, is not in the free copy and was not read.

**Rotational stiffness of a fastener group.** Swedish Wood, *Design of timber structures*, Volume 1, Edition 3:2022, Section 4.15.1, p. 112 (free from Swedish Wood). For a moment-resisting joint it assumes a linear force-slip relation, F_mi = K·α·r_i, with K the slip modulus of one connector, α the joint's rotation, and r_i each fastener's distance from the group's centre of gravity, and sets the moment equal to the sum of the fasteners' moments: M = K·α·Σr_i². The book uses this for load distribution among the fasteners. Its rotational stiffness, k_θ = M/α = K·Σr_i², is one line from the printed equation, not printed itself. The members are taken as rigid bodies turning about the group's centroid (its Figure 4.35), which the book shows but does not state as an assumption.

**Putting a rotational spring in a frame element.** McGuire, Gallagher and Ziemian, 2nd edition, Section 13.5.1, pp. 394–397: a linear rotational spring at each end of an element, M = k·θ_r (Eq. 13.30), gives the element stiffness of Eq. 13.31, derived by condensation in Example 13.7. That is how `packages/frame` would take a spring if one were added. The book leaves the value of k to the reader: determining a connection's moment-rotation curve is, in its words, "not within the purview of this text", and it takes k as "an empirically determined initial stiffness" (p. 394).

**Eurocode 5, cross-check.** EN 1995-1-1 is a paid standard and was not read. Swedish Wood reproduces its Table 7.1 in *Design of timber structures*, Volume 2, Edition 3:2022, Section 9.2, Table 9.2, p. 33, citing EN 1995-1-1:2004, 7.1, and repeats it in Volume 1, Section 4.16, Eq. 4.35, p. 114. For dowels, bolts, screws, and pre-drilled nails, the slip modulus per shear plane and per fastener is K_ser = ρ_m^1.5·d/23 N/mm, with ρ_m the mean density in kg/m³ and d the diameter in mm. A footnote on bolts says the clearance is to be added separately to the fastener's slip. Volume 2's Table 3.3 (Section 3.4.1, p. 10, citing EN 338:2016) gives ρ_mean = 420 kg/m³ for strength class C24 and 480 for C40.

### The numbers, for a 1/2" bolt

Hand computed (1 lb/in = 4.4482216 N / 25.4 mm = 0.175127 N/mm):

| | Value |
|---|---|
| NDS γ, wood to wood, D = 0.5 | 180,000 × 0.5^1.5 = 63,640 lb/in (11,145 N/mm) |
| EC5 K_ser, d = 12.7 mm, ρ_m = 420 (C24) | 420^1.5 × 12.7 / 23 = 4,753 N/mm (27,139 lb/in) |
| EC5 K_ser, ρ_m = 480 (C40) | 5,807 N/mm (33,158 lb/in) |
| γ over K_ser | 2.34 (C24), 1.92 (C40) |
| ρ_m at which K_ser equals γ | (11,145 × 23 / 12.7)^(2/3) = 741 kg/m³ |

So NDS's γ is about twice Eurocode's K_ser for European softwood classes. The two are not directly comparable for the swing set: Southern Pine is not graded to EN 338, NDS gives specific gravity on an oven-dry basis rather than ρ_m, and no source read here converts one to the other, so no K_ser is given for Southern Pine.

With k_θ = K·Σr_i² for the worked example's two 1/2" bolts per joint (spec, Bolt layout: crossbar bolts 2.75 apart, gusset bolts 3.625 apart, so r = 1.375 and 1.8125):

| Joint | Σr_i² (in²) | k_θ from NDS γ (in-lb/rad) | k_θ from K_ser at C24 (in-lb/rad) |
|---|---|---|---|
| Crossbar to leg | 2 × 1.375² = 3.781 | 240,640 | 102,620 |
| Gusset to leg | 2 × 1.8125² = 6.570 | 418,130 | 178,310 |

These would be the springs if the basis held. They are recorded so the owner can see the size of the choice, not used in any result.

### Why the basis does not hold for these joints

- **NDS does not extend γ beyond C_g.** Its only use is inside the group action factor. Using it for rotation is an extrapolation NDS does not make.
- **The clearance.** Every bolt hole is 1/16" over its bolt (template version 9; NDS 2024 12.1.3.2, as the spec cites it), so a bolt can move up to 1/16" across its hole before it bears. Eurocode 5, through Swedish Wood, says this clearance is added to the slip separately, and none of the sources read gives a way to do that in a frame. In step 2's push case on pads with the lifting foot released, the crossbar carries about 155 lb, 78 lb per bolt; its elastic slip is 78 / 63,640 = 0.0012 in by γ, or 78 / 27,139 = 0.0029 in by K_ser at C24. Both are ten to fifty times smaller than the 1/32" to 1/16" of clearance. A joint turning about its bolt group would turn freely through about 1/32 / 1.375 = 0.023 rad to 1/16 / 1.375 = 0.045 rad at the crossbar before both bolts bear. A linear spring from zero describes none of that.
- **Tightening.** The plan tightens every bolt with a locknut (CPSC), so the faces are clamped and friction carries some moment before the bolts slip. No source read gives a value for it, and NDS 11.1.5 (p. 70), which bases its design values on the members' faces being brought into contact, does not give one either.

### Options for the owner

1. Keep pinned and rigid, as now. The real joint lies between them; with the clearance, it starts nearer pinned.
2. A spring from Eurocode 5's K_ser through Σr_i², as Swedish Wood's derivation allows, with the clearance taken up first. This needs EN 1995-1-1 itself to be read (paid), a density for Southern Pine on Eurocode's basis, and a nonlinear analysis (a gap, then the spring), which McGuire describes as an incremental analysis (Section 13.5.1, Eq. 13.30a, p. 397). That is beyond this exploration's linear scope.
3. A spring from NDS γ through Σr_i², stated as an extrapolation of a group action modulus and ignoring the clearance. It would give a third number with no source behind its use.

The recommendation is option 1. Option 3 would be a number presented with a source that does not support it.

### Verified, and not

- Verified against the printed source, with page: NDS 2024 11.3.6.1, Eq. 11.3-1, p. 74, and the notation entry for γ, p. 9 (read in AWC's free view-only copy); Swedish Wood Volume 1, Edition 3:2022, 4.15.1, p. 112 (M = K·α·Σr_i², read from the page image) and 4.16, p. 114; Swedish Wood Volume 2, Edition 3:2022, Table 9.2 and its clearance footnote, p. 33, and Table 3.3's ρ_mean, p. 10 (both read from page images); McGuire et al., 13.5.1, pp. 394–397.
- Not verified: EN 1995-1-1 itself (paid; K_ser and its clearance footnote are as Swedish Wood reproduces them, a secondary source); the NDS Commentary on γ; NDS 12.1.3.2's oversize holes, taken from the template spec, where it was verified for version 9; whether NDS's γ is per shear plane.
- Hand computed, not from code: the table of γ, K_ser, and k_θ above, and the slip and clearance rotations. No code changed in this step, so nothing printed by the scripts depends on them.

## Assumptions

These hold for every result this exploration prints, and are listed with each one.

- Linear elastic, small displacements, Euler–Bernoulli members (plane sections stay plane, shear deformation ignored). No second-order (P-Δ) effects and no buckling of the whole frame.
- Members are prismatic, with E, A, and I from the section and grade the owner entered (step 2 onward).
- Bolted joints are run twice: pinned and rigid. The real joint lies between them. Step 3 found no basis for a single rotational stiffness that covers the swing set's bolts in their oversize holes, so no third case is run.
- Feet on pads are pinned; the uplift case runs with the lifting foot released. Buried legs are fixed at grade, and the soil makes the real fixity lower.
- Loads are the quasi-static load cases the existing checks use. No dynamic or modal analysis.
- Out of scope: connection capacity, soil, sliding, and whole-frame buckling. They stay on the checklist.

## Plan of steps

Each step is blocked by the one before. Pull requests go into `explore/frame-analysis`.

1. #726 Package, 2D frame element, and solver, tested against hand-checked examples. Done.
2. #727 One A-frame in its plane from the template's placements and joints, pinned and rigid, checked against #467's foot reactions and #468's leg load in the worked example. Done.
3. #728 Bolt slip source: NDS 2024's load/slip modulus and whether it may be used beyond group action, the textbook basis for a bolt group's rotational stiffness, and Eurocode 5 (EN 1995-1-1, 7.1) as a cross-check. A third joint case if the basis holds. *This step:* the basis does not hold for these joints, so no spring is added.
4. #729 3D frame element and the whole swing set, with sway along the beam for buried legs and for pads.
5. #730 A sweep over the template's parameters: where sway is largest and how far the joint cases differ.
6. #731 Write-up and an adoption proposal, if there is one to make.
