# Frame analysis

Status: done (November 5, 2026); A and B adopted (November 6, 2026, decision 0022). Exploration #545, steps #726 to #731. Code in `packages/frame` on `explore/frame-analysis`, not merged. Nothing in `apps/` imports `packages/frame`. From step 2, `packages/frame` depends on `@kerf/core` for the swing set's plan, design values, and loads.

Every result this exploration prints is headed "Exploratory frame analysis, not a structural check" and lists its assumptions. It sits beside the sourced checks and replaces none of them (`PRODUCT.md` principle 2). Results read as forces, displacements, and margins under stated assumptions, never as verdicts (hard rule 2).

## The question

What does a whole-frame analysis of the swing set show that the per-member checks cannot? Specifically: how the swings' push is shared between the legs, crossbar, gusset, and beam; what each foot carries; and how far the frame sways along the beam, which Kerf has no answer for today.

It is also a way to learn the direct stiffness method, the basis of frame analysis software, on a structure Kerf already describes.

## Result

- Where the frame analysis and the per-member checks overlap, they agree: the legs' load at the bottom of the arc within 0.71% of #468's P with pinned joints, and the feet's uplift with #467's to 10⁻⁶ lb where the frame is determinate.
- The push toward the front and back, which #468's P leaves out, loads one leg 26% over P in the worked example, and up to 215.56% over it across the sweep at narrow splays. This holds with pinned and rigid joints alike.
- Along the beam, the frame's stiffness depends mostly on the joint assumption (pinned sways 1.36 to 4.13 times as far as rigid, buried), and on pads with pinned joints it is a mechanism. No source gives a load along the beam or a sway limit, so none of it becomes a margin.
- The proposal is to add the push to the leg check as statics, cross-checked against this analysis, and to give the checklist's racking item the reason found here; not to show the frame analysis in the app. See "What adopting it would take".

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

## The whole swing set in 3D (step 4)

`space/` adds a space frame element and analysis, and `swingSet.ts` builds both A-frames and the beam from a generated plan. `pnpm --filter @kerf/frame swing-set` prints it for the worked example, buried and on pads. Every case is headed "Exploratory frame analysis, not a structural check" and carries its assumptions.

### The space frame element

Six degrees of freedom at each end: u, v, w, θx, θy, θz (`space/element.ts`, `space/analyze.ts`). The analysis is step 1's with six degrees of freedom per joint: assembly, supports by partitioning, Cholesky, reactions, end forces, and a joint whose rotations nothing holds set aside.

| What | Where in the text | Code | Agrees |
|---|---|---|---|
| Torsion member, GJ/L | Eq. 4.27b, Section 4.5.2, p. 68 | `localStiffness3` | Yes |
| Beam bent about y, signs | Eq. 4.33, Section 4.5.4, p. 73 | `localStiffness3` | Yes, signs from the page image |
| Complete 12 by 12 element | Eq. 4.34, Figure 4.11, p. 73 | `localStiffness3` | Yes, term for term, signs from the page image. The text writes the torsion term as E·J/(2(1 + ν)L); wood is not isotropic, so G is entered on its own and the term is GJ/L, as in Eq. 4.27b |
| [γ]: rows are the local axes' direction cosines; rows orthogonal unit vectors | Eqs. 5.2 to 5.6, p. 96 | `rotation` | Yes |
| Γ: four [γ] on the diagonal; d' = Γ·d; k = Γᵀ·k'·Γ | Eqs. 5.7, 5.9, 5.11, 5.16, pp. 97–98 | `transformation`, `element3` | Yes |
| [γ] of an oblique member | Example 5.5, p. 107 | `element.test.ts` reproduces the printed [γ] to its four places, and [γχ]·[γρ] before the 30° turn | Yes, signs from the page image |
| Releases: k − k·G·(Gᵀ·k·G)⁻¹·Gᵀ·k, with G selecting the released moments; both moments at end 2 | Eqs. 13.34 to 13.36, Section 13.5.1, p. 398 | `release` | Yes: Eq. 13.36 gives 3EI/L terms about both axes, as Eq. 13.33 does about one |

Three things are this package's own, built from the text but not printed in it:

- **Orientation from a reference vector.** Local x runs along the member, local z is x × r, and local y is z × x, so local y lies in the plane of the member and the reference vector r. The text builds [γ] from successive rotations (Example 5.5). The test reproduces Example 5.5's printed [γ] with its local y as the reference, and the matrix before its 30° turn with the vertical as the reference.
- **Releases about any axis, and of a force.** The text's G columns are unit vectors on the local rotations. A column holding the direction cosines of any axis is the same as turning that end's axes so the axis is one of them (an orthogonal transformation, Eq. 5.16) and then condensing it (Eq. 13.5, p. 376). The same works for a force along an axis. A test releases a moment about an oblique axis and checks that the end carries no moment about it and still carries one across it.
- **Rigid offsets in 3D.** Eqs. 13.38 and 13.39 (p. 400) are printed for a plane frame. In 3D the end moves by u + θ × e for an offset e. In the x-y plane this is the printed form, and a test checks the 3D element against step 1's plane element with offsets and a release, term for term.

### Torsion: G and J

Wood Handbook, FPL-GTR-282 (2021), free from USDA Treesearch (62200).

- **J.** Eq. 9–11, p. 9–5: K = J ≈ h·b³/φ, with h the larger side and b the smaller, "for a rectangular cross section". φ is given only as a curve, Figure 9–9, p. 9–6. It was read from the page image against the figure's tick marks at b/h = 0, 0.1, … 1.0: 3.00, 3.14, 3.38, 3.66, 3.97, 4.32, 4.73, 5.20, 5.73, 6.32, 6.97. The curve's line is about 0.03 of φ thick at that size, so each reading is good to about ±0.05. `torsionConstant` interpolates between them in a straight line. The worked example's 4x4 has J = 3.5⁴/6.97 = 21.53 in⁴.
- **G.** Eq. 9–9, p. 9–5, takes G = √(G_LR·G_LT) for torsion, or E_L/16 when no measured G is available. Table 5–1, p. 5–2, gives G_LR/E_L and G_LT/E_L at about 12% moisture content. The Handbook names four major Southern Pine species, longleaf, shortleaf, loblolly, and slash (Chapter 2, p. 2–15), and Table 5–1 lists three of them: √(G_LR·G_LT)/E_L is 0.0815 for loblolly, 0.0653 for longleaf, and 0.0540 for slash. Shortleaf has no row. The script takes the lowest, slash, and also reports the sway with loblolly.
- **Applying the ratio.** The ratio is to E_L, the clear-wood modulus, which the Handbook says is about 10% above a bending E (Table 5–1, footnote a). The script multiplies it by the member's E' from Table 4B with wet service, which no source says to do. If anything this makes G low.

How much it matters: changing G from slash's ratio to loblolly's, half again as large, moves the sway along the beam by under 0.3%. The sway is carried by the legs bending across the frame and, with rigid joints, the beam bending in its vertical plane as a portal along the beam; torsion carries almost none of it.

### The model

Coordinates are the spec's: x along the beam from its left end, y front to back, z up. Each A-frame's points in its plane are step 2's (`frameGeometry`). Along the beam they come from the plan's placements: the legs' centerline at x = e + t/2 (13.75 and 106.25 in the worked example), the crossbar and gusset at the middle of their thickness on the outside face (11.25 and 108.75).

- **Beam.** A member along its centerline at the leg-to-beam bolts' height, between the frames' bolts, with joints at the hangers and halfway between the frames. The overhangs past the frames carry no load and are left out; their weight is in D, half the beam's weight at each frame, as in step 2. Its cross-section is rigid across its depth, so the legs' tops and the gusset's bearing join its axis by rigid links. A built-up beam's plies bend together about the strong axis (decision 0013) and are taken as separate boards across it and in torsion.
- **Legs, crossbar, gusset.** As step 2, with each member's section facing the way it does: the legs' and boards' depth in the frame's plane, the beam's depth vertical. The crossbar and gusset join each leg's centerline by a rigid link along their bolts, 2.5 in the worked example.
- **Joints, pinned.** The leg-to-beam bolt is a single bolt, so each leg turns freely on it in every direction. Step 2 let it turn in the frame's plane; along the beam this is the frame turning about the bolt's own axis, leaning against the beam. Each crossbar and gusset joint turns freely about its bolts' axis, which runs along the beam, so this is step 2's pin in the plane. Its two bolts, spread across the board, hold the faces together against the other two rotations. Releasing those too would let each leg spin about its own axis on pads.
- **Joints, rigid.** Nothing turns. The legs are continuous in both cases.
- **The gusset's bearing.** It carries the beam's weight, its push toward the front or back, and its turning in the frame's plane, as in step 2. It carries nothing along the beam and no moment about y or z: it is not fastened, and no friction is counted.
- **Where the beam bears, pinned.** The gusset is on the frame's outside face, so the beam bears on it 2.5 in along the beam from the bolt. A first run kept that position in both cases. Pinned on pads, it gave a finite sway nearly the same as rigid, because the beam held down at the bolt and up at the gusset forms a couple that stops the frame turning against the beam. That couple needs the bolt to bear up or down in its hole, which is 1/16" oversize; the spec takes the gusset as what the beam meets first (Structural model, Beam). The beam would have to turn about (1/32 to 1/16)/2.5 = 0.0125 to 0.025 rad before the bolt bears. So with pinned joints the bearing is taken in line with the bolt along the beam, and with rigid joints it stays where it is.
- **Feet.** As step 2, in 3D: buried legs fixed at grade; on pads pinned in all three directions by the anchors and free to turn; a lifting foot held only up and down, with no friction along or across.

### Loads

- **Along the beam: none is applied from a source.** The swing loads act in the A-frames' planes (spec, Structural model, Uplift at the feet). Neither the spec nor any source read for this exploration gives a load along the beam for a swing set: wind, a rider pushing on a leg, or a swing twisting on its chains. So the frame's stiffness along the beam is reported instead: how far each frame's top moves along the beam per pound applied along the beam at its middle, in inches per pound. Multiplying it by a load gives a sway. No sway limit is assumed.
- **The swing loads.** Step 2's three cases (the bottom of the arc, and pushed toward the front and the back at the φ where a foot lifts most), now applied at the four hangers as half of each swing's chain tension, with the moment the push makes about the beam's axis. The beam shares them between the frames. Half the beam's weight is at each frame's bolt.

### Worked example

Southern Pine No.2 for every member, not incised, E' = 1,260,000 psi, G = 0.0540·E' = 68,028 psi; beam moisture content 30%, θ = 60°, dynamic factor 2. The working is in `swingSet.test.ts`.

**Stiffness along the beam:**

| Feet | Joints | Sway per pound (in/lb) | Stiffness (lb/in) |
|---|---|---|---|
| Buried 24", fixed at grade | Pinned | 0.006076 | 164.6 |
| Buried 24", fixed at grade | Rigid | 0.001641 | 609.3 |
| On pads | Pinned | Mechanism along the beam | none |
| On pads | Rigid | 0.006501 | 153.8 |

Both frames' tops move together, to 10⁻⁶. With G from loblolly instead of slash: 0.006063, 0.001639, and 0.006485.

- **Hand check, buried and pinned.** Each leg's top turns freely on its bolt, so without the crossbars and gussets each leg is a flagpole fixed at grade and loaded square to it at the bolt's line: P·ℓ³/(3EI). ℓ runs along the leg from the ground to z = 98.75: 101.769 (back) and 108.613 (front). With EI = 15,756,563 lb-in², 3EI/ℓ³ is 44.847 and 36.892 lb/in, and the four legs give 163.478 lb/in, or 0.006117 in/lb. Adding members can only stiffen a frame, so the model's sway must be under this. It is 0.006076, 0.7% under: the crossbars and gussets couple the legs a little. Kerf's leg check takes the same buried leg as a flagpole along the beam (spec, Legs, Ke = 2.10), so the two agree on how the leg works.
- **Rigid joints, buried,** are 3.7 times as stiff: the beam and legs act as a portal along the beam.
- **On pads with pinned joints, the frame is a mechanism along the beam,** in every load case, and the analysis says so instead of giving numbers. Each A-frame can lean along the beam, turning about the line through its feet, while the beam slides along its length. Holding the beam along its length makes the frame stable, which is how the analysis tells this mechanism from any other. On level ground nothing strains at all. On the worked example's slope the line through the feet is not level, so leaning also turns the beam in plan and bends it sideways. A soft spring added along the beam measures what is left: 6.5×10⁻⁵ lb/in at 1" per foot, nine times that at 3" per foot, and under 10⁻⁶ on level ground (`swingSet.test.ts`). The solver reads all three as a mechanism. What holds the real frame along the beam is how tightly the bolts clamp, the anchors' grip on the legs, and any bracing along the beam. The model has no value for any of them, which is the checklist's "racking" item.
- **On pads with rigid joints** the frame is about as stiff as buried and pinned (153.8 against 164.6 lb/in): the rigid tops make up for the free feet.

**The swing loads move the frame along the beam, a little.** Buried, with pinned joints, they move it under 10⁻⁶ in, and no foot takes more than 0.7 lb along the beam. With rigid joints each frame's top moves 0.00015 in toward the beam's middle, and each buried foot takes 37 to 42 lb along the beam: the beam bends under the riders, its ends turn, and rigid joints carry that into the legs. On pads with rigid joints and riders 200 and 80 lb, the unequal riders turn the beam's ends unequally, and both tops move 0.039 in the same way along the beam at the bottom of the arc, with about 20 lb along the beam at each foot. None of this appears with pinned joints.

**In the frames' planes, against step 2.** Buried, riders 150 and 150 lb, bottom of the arc, joints pinned: each foot carries 313.06 lb (back) and 312.97 lb (front) up and an outward thrust of 113.63 lb, against step 2's 113.65 lb. With equal riders the set is symmetric about the beam's middle, so each frame carries exactly half. On pads with the lifting feet released and joints rigid, each frame is then determinate in its plane, and the lifting foot's pull matches core's uplift check, C·S − D·c_v, to 10⁻⁶ lb. With riders 200 and 80 lb the frames do not share the load as the uplift check does: it supports the beam at the middle of each gusset, 97.5 apart, while here the beam reaches each frame at its bolt and its gusset together. By the lever rule with supports at the bolts, 92.5 apart, the left frame's share of the riders is 165.95 lb against the uplift check's 164.62. The left back foot's pull is 191.51 lb here, against the uplift check's 189.70.

These numbers are for the stated inputs only, under the assumptions listed with each result, and are forces and displacements, not margins against any capacity.

### Verified, and not

- Verified against McGuire et al., 2nd edition, with page, signs read from page images where marked: Eq. 4.27b (p. 68), Eqs. 4.33 and 4.34 (p. 73, images), Eqs. 5.2 to 5.11 and 5.16 (pp. 96–98), Example 5.5 (p. 107, image), Eqs. 13.34 to 13.36 (p. 398, image).
- Verified against the Wood Handbook, FPL-GTR-282: Eqs. 9–9 and 9–11 (p. 9–5, read from the page image, since the text layer drops the fraction), Figure 9–9 (p. 9–6, read from the image as above), Table 5–1 and footnote a (p. 5–2), and the Southern Pine species (p. 2–15).
- Hand-checked in tests: Eq. 4.34 term for term; Example 5.5's [γ]; releases against Eq. 13.33's 3EI/L terms; an L-shaped space cantilever (bending in both members and twist in one: 1 + 1 + 15 = 17 in); step 1's portal standing in the x-z plane (25/42 in); every step 2 A-frame case run through the space analysis, which gives step 2's displacements, reactions, and member forces; the swing set's positions along the beam and its sections; the flagpole bound; and the uplift check where each frame is determinate.
- Not from any printed source: orientation from a reference vector, releases about any axis or of a force, and rigid offsets in 3D (each tested against the printed form it extends, above); φ between the readings of Figure 9–9; applying the Handbook's G/E_L to NDS's E'; and taking slash pine's ratio for the Southern Pine group, which also includes shortleaf with no row in Table 5–1.
- Modeling choices, stated with each result: which rotations a pinned joint frees; the bearing's position along the beam differing between pinned and rigid; no friction at the gusset or a lifting foot; the beam's overhangs left out; the beam's cross-section rigid; and the plies of a built-up beam separate across their strong axis and in torsion.
- Not re-verified in this step: Table 4B's E and its factors, the pendulum load, and the uplift check's statics, which are core's, as in step 2.

## A sweep over the template's parameters (step 5)

`sweep.ts` runs step 4's analysis on the template's worked examples and on core's seeded sweep of the swing set's parameters (`templates/sweep.ts`, the swing set's `sweep.ts`: 800 draws from seed 571), and `sweepReport.ts` writes what it finds. `pnpm --filter @kerf/frame sweep` writes the whole report to [`frame-analysis-sweep.md`](frame-analysis-sweep.md), headed "Exploratory frame analysis, not a structural check" with its assumptions. It runs in about three seconds. The tests run the examples and the first 160 draws.

Every number in this section is quoted from that report, which computes every count, range, median, and largest value from the run. Nothing below is entered by hand.

### How it runs

- **The draws are core's.** The script draws parameters exactly as core's sweep does, from the same seed in the same order, so draw n here is draw n in core's sweep digest. A test checks that the same draws are accepted and made. Every sweep draw carries the worked example's structural inputs, since core's sweep draws parameters only: Southern Pine No.2, riders 150 and 150 lb, θ = 60°, dynamic factor 2, beam moisture content 30%.
- **What only the frame needs.** The crossbar and gusset take the legs' species, grade, and incising, since core asks for none. G is slash pine's ratio, as in step 4.
- **Every instance is counted.** An instance the analysis cannot handle is reported by its reason: the parameter schema rejects it, the template refuses it, an input is needed, or the analysis is not computed. Nothing is dropped.
- **Pinned on pads is the mechanism.** With pinned joints on pads, every case is reported as the mechanism along the beam (step 4; the owner's decision on #735), with no numbers. See below for the instances where the solver returned numbers anyway.
- **Tolerances, fixed before the run.** A leg's axial load differs from core's P when they are more than 1% apart. A foot's pull differs from core's uplift when they are more than the larger of 1% of core's value and 1 lb apart. Step 2 found the legs within 0.1% and step 4 found the uplift within 1% for the worked example, so 1% is ten times step 2's agreement. The 1 lb floor keeps a foot that is barely lifting from reading as a large relative difference.

### What it found

The sweep was first run on template version 40, when core's sweep drew stock sizes the template does not offer and its schema rejected 409 of 800 draws. #738 made the sweep draw only accepted sizes (template version 41), and the numbers below are from the rerun on version 41.

**Instances.** Of 803 (3 examples and 800 draws), 243 are analyzed: 181 buried and 62 on pads. The parameter schema now rejects none. The template refuses 414, mostly for seat clearances, hangers outside the span, and footprints no splay between 5° and 35° can give. 145 are not computed, because Table 4B has no row for 6x6 legs (92) or a 6x6 beam (53) in Southern Pine No.2. One needs inputs: the worked example with no structural inputs.

**Sway along the beam, per pound.** Buried with pinned joints: 0.0007149 to 0.02293 in/lb, median 0.004839. With rigid joints, buried and on pads: 0.0002898 to 0.02708, median 0.002079. Sway grows most with beam height. With pinned joints its median rises from 0.001677 in/lb in the lowest quarter of heights (60.1 to 77.1 in) to 0.01164 in the highest (120.3 to 142.3 in). It also grows with splay (median 0.003817 to 0.005757 from the lowest quarter to the highest) and with crossbar height (0.002591 to 0.006955), though the sweep draws the crossbar's height below the beam's, so the two move together. Burial depth shows no steady trend: the quarters' medians are 0.00512, 0.004659, 0.004144, and 0.004967. With rigid joints, the largest five are all on pads.

**Spread between joint cases.** Buried, pinned joints sway 1.36 to 4.13 times as far as rigid, median 2.82. This is the range the real joints lie in. The joint cases differ less in the foot reactions: the largest pull on a foot changes by −11.41% to +95.70% from pinned to rigid, median +2.88%. They differ most in member forces: rigid joints lower the largest bending moment by 13.67% to 49.48% (median 39.20%) and raise the largest axial compression by 36.50% to 808.14% (median 269.54%).

**Where the largest member forces and reactions are.** The push toward the front and back sets most of them, and splay matters most. With pinned joints, the largest compressions are in the legs' lowest members at splays of 5.2° to 6.8°, up to 1,059.2 lb (draw 516), where the legs are close together at the base. The largest bending moment is in the beam at the bottom of the arc, in the longest beams. With rigid joints, the largest compressions (up to 6,116.0 lb, draw 475) are in the legs' top members, from the beam to the gusset. A one-off run of the same analysis on draw 302 (on version 40, where it was the largest; the report does not print it) shows why: with rigid joints, the moment the push makes about the beam's axis enters each frame as a couple between the leg's top and the gusset's bearing, a few inches apart, so the leg's top member and the gusset carry large and opposite axial forces. That is a consequence of taking the joints and the beam's cross-section as rigid, and it marks the rigid case as a bound.

**Legs against #468.** 424 comparisons at the bottom of the arc. Buried with pinned joints, every one of 181 is within tolerance: −0.27% to +0.71%, median +0.16%. With rigid joints, 88 of 181 buried and 13 of 62 on pads are over. They range from −18.82% to +8.79%, and most are lower than P. The lowest is still draw 435, the same draw on both versions: splay 35.0°, beam height 68.00 in, a 201.31 in beam. A one-off run on that draw (on version 40), not printed in the report, shows why: with rigid joints and fixed feet, the foot's reaction no longer lies along the leg, which P assumes. The crossbar and gusset take part of the outward thrust in tension, and the foot takes a moment. The leg then carries less axial force and more bending, which core's column check does not see.

**The push against #468's P.** New in the rerun: the report now compares each leg's lowest member, pushed toward the front and the back where a foot lifts most, with the same P (`sweep.ts`, `pushes`). No tolerance applies, since core does not compute this load. Each instance's largest:

| Joints | Instances | Smallest | Median | Largest |
|---|---|---|---|---|
| Pinned (buried only) | 181 | −37.45% | +13.08% | +215.56% |
| Rigid | 243 | −40.68% | +16.72% | +231.22% |

Splay decides it. Medians by quarter of splay (the quarters differ slightly because the rigid case includes the instances on pads):

| Quarter | Pinned: splay | Pinned: median | Rigid: splay | Rigid: median |
|---|---|---|---|---|
| Lowest | 5.2° to 13.4° | +85.87% | 5.2° to 13.6° | +107.44% |
| Second | 13.6° to 21.6° | +36.85% | 13.6° to 21.2° | +42.46% |
| Third | 21.7° to 27.6° | +1.10% | 21.3° to 27.6° | +5.23% |
| Highest | 27.7° to 35.0° | −24.73% | 27.7° to 35.0° | −24.62% |

Why, from the load formula rather than the report: the legs resist the push by axial force across the base, so the narrower the base, the more of it one leg takes. The push case's vertical load is also lower than at the bottom of the arc, since the rider is slower and the chain leans: (3·cos φ − 2·cos θ)·cos φ is 0.99 at φ = 40° and θ = 60°, against 2 at φ = 0. At wide splays the push adds little to the more loaded leg, and the lower vertical load leaves it under P. The worked example, at 20°, gives 420.37 lb buried with pinned joints, 26.20% over P and within 0.1% of step 2's 420.7. The largest is draw 516: splay 5.6°, 1,059.15 lb pinned and 1,111.71 lb rigid against P = 335.64 lb.

**Uplift against #467.** 248 comparisons on pads, all with rigid joints, since pinned on pads is the mechanism. 2 are over tolerance: draw 239 by −3.23 lb and draw 617 by −1.25 lb. Frame minus core ranges from −3.491 to +3.491 lb, median 0.000 lb. These are the share between frames that step 4 found: core supports the beam at the middle of each gusset, while the frame carries it at the bolt and the gusset together. The difference shows when the swings are not centered between the frames.

**Pinned on pads, the solver's threshold.** In 30 of 62 instances on pads (8 of 20 on version 40), the solver returned a stiffness along the beam with pinned joints instead of reading the mechanism: 0.0001111 to 0.02362 lb/in, against 36.93 to 720.6 lb/in for the same frames with rigid joints. Pinned over rigid, these are at most 0.00007587. See "The solver's mechanism threshold" below. The report lists them and uses them nowhere else.

These numbers are for the stated inputs only, under the assumptions listed with each result, and are forces, displacements, and stiffnesses, not margins against any capacity.

### Core changes

Two small exports, no change to any output: `legAxialLoad` is the leg check's P, moved out of `legColumn` so the sweep compares against the same function the check uses, and `pendulumFactor` and `EXAMPLES` are exported from the swing set's index. `seeded` is exported from `@kerf/core/sweeps`, so the script draws as core does.

### Verified, and not

- No new formula. The sweep uses step 4's analysis and core's P (`legAxialLoad`) and uplift (`upliftFeet`).
- Tested: every example and draw is counted once; the draws accepted and made match core's sweep; core's P for the worked example is 333.10 (example 5), and the buried, pinned leg is within 0.1% of it, as in step 2; the uplift matches core to 10⁻⁶ lb on the symmetric two-ply example on pads, where each frame is determinate; buried legs are stiffer along the beam with rigid joints in every draw; pinned on pads gives no numbers; the worked example's pushed leg is within 0.1% of step 2's 420.7 lb and 25% to 27% over P; each instance has both pushes in every support case that solves; the report is headed as exploratory, counts every instance, and uses no verdict words.
- Not in the report: the reasons given above for draws 302 and 435 come from one-off runs of the same analysis that print member forces and reactions the report does not keep. They explain the numbers and are not quoted as results.
- Not checked by hand: the sweep's values beyond the worked examples. They are the step 4 analysis on other parameters, and each case's equilibrium is tested in step 4.
- Modeling choices, stated in the report: the crossbar's and gusset's species from the legs'; pinned on pads reported as the mechanism even where the solver returns numbers; the tolerances.

## What the analysis shows that the checks do not

Kerf's structural review checks each member on its own and puts racking, connections, and tipping on the confirmation checklist (`PRODUCT.md` principle 2). The frame analysis agrees with the per-member checks where they overlap, and shows two things they do not.

**Where they overlap, they agree.** At the bottom of the arc, buried with pinned joints, the legs' axial load is within −0.27% to +0.71% of #468's P in all 181 buried instances. On pads, where each frame is determinate in its plane, the feet's pull matches #467's uplift to 10⁻⁶ lb on the symmetric example, and is within 3.491 lb across the sweep, where the frames share the beam slightly differently. The analysis found no error in either check.

**1. The push loads one leg more than #468's P, by an amount that depends on splay.** #468's leg check says its load leaves out the swing's push toward the front and back (spec, Legs). In the worked example, at 20° splay, the push loads the back leg 26% over P buried and 30% to 36% on pads (steps 2 and 5). Across the sweep, each instance's largest is −37.45% to +215.56% of P with pinned joints, median +13.08%. In the narrowest quarter of splays (5.2° to about 13.5°) the median is +85.87% (pinned) and +107.44% (rigid); in the widest (27.7° to 35.0°) no instance's push raises a leg's load over P. Both joint cases give the same picture, so it does not depend on the joint assumption. At narrow splays the leg check's column capacity is measured against a load that is about half (the median) to a third (the largest) of what one leg carries when the swings are pushing.

**2. The frame's stiffness along the beam.** Kerf has no answer for it today: the checklist carries racking, and the leg check on pads says no end condition applies along the beam. The analysis gives a stiffness per pound, since no source read gives a load along the beam:
- Buried with pinned joints, 0.0007149 to 0.02293 in/lb; with rigid joints, buried and on pads, 0.0002898 to 0.02708. Beam height drives it: the tallest quarter sways about seven times as far as the lowest (pinned medians 0.01164 against 0.001677 in/lb).
- On pads with pinned joints the frame is a mechanism along the beam: each A-frame can lean about the line through its feet. What holds it along the beam is the bolts' clamping, the anchors' grip on the legs, and any bracing along the beam, none of which the model has a value for. This is the checklist's racking item, now with a reason: with the bolts as pins, nothing in the frame's members holds it.
- On pads with rigid joints the frame is about as stiff as buried with pinned joints (153.8 against 164.6 lb/in in the worked example).

Smaller things it showed: with rigid joints, unequal riders move the frame along the beam a little (0.039 in in the worked example on pads), and the push's moment about the beam enters each frame as a large couple between the leg's top and the gusset (up to 6,116.0 lb of compression in a leg's top member). Both come from taking the joints and the beam's section as rigid.

## Where the assumptions make the numbers uncertain

In order of how much they move the results:

1. **Pinned against rigid joints.** This is the largest. Sway along the beam differs by 1.36 to 4.13 times between the cases, buried. On pads, pinned is a mechanism and rigid gives 36.93 to 720.6 lb/in, so the two cases do not bracket a usable number there at all. Member forces differ even more: rigid raises the largest compression by a median of 269.54% and lowers the largest moment by a median of 39.20%, largely from the rigid beam section and the bearing couple. Step 3 found no sourced rotational stiffness for bolts in 1/16" oversize holes, so nothing narrows this range. The results that hold in both cases are the foot reactions (largest pull, median +2.88% from pinned to rigid), the legs' load at the bottom of the arc with pinned joints, and the push's extra load on a leg.
2. **Feet.** Buried legs are fixed at grade, which overstates the stiffness: the soil lets the leg turn and move below grade, and the model has no soil input. The sway numbers for buried legs are lower bounds on the real sway under these joint cases, not estimates of it. Pads are pinned with no friction; a lifting foot is free.
3. **The bearing position.** With pinned joints the beam's bearing on the gusset is taken in line with the bolt (owner's decision on #735), because the bolt has to bear in its oversize hole before the couple forms. Taken at the gusset, pinned on pads gives a finite sway nearly the same as rigid (step 4). The model's answer along the beam on pads depends on that 1/32" to 1/16".
4. **Loads.** Quasi-static, at the chain angle where a foot lifts most. The push case's leg load was not searched over φ: the largest leg load may fall at a different angle, so the push numbers may understate it. No load along the beam is applied, and there is no sway limit, so the stiffness is not a margin.
5. **Section and material.** E' from Table 4B with wet service, on gross sections; G from slash pine's ratio, which moves the sway by under 0.3%; Euler–Bernoulli, no shear deformation, no P-Δ, and no whole-frame buckling. These are small next to items 1 and 2.

## The solver's mechanism threshold

`solveSymmetric` reads a pivot at or below 10⁻¹⁰ of its own diagonal term as a mechanism (Method, item 6). Pinned on pads, 30 of 62 instances came back with a tiny stiffness along the beam instead. On sloped ground the frame's lean about the line through its feet also turns the beam in plan and bends it sideways, so the stiffness left is real, but tiny: step 4 measured 6.5×10⁻⁵ lb/in at 1" per foot of slope. Whether its pivot falls above or below 10⁻¹⁰ depends on the geometry. So the threshold is doing something it was not chosen for. It was chosen to tell rounding error from stiffness, and here it is being asked to tell a tiny physical stiffness from none.

**Today's results do not depend on it.** Following the owner's decision on #735, every pinned-on-pads case is reported as the mechanism by the model's own rule (`leansOnPads` in `sweep.ts`), whatever the solver returns. The stiffness the solver returned is listed and used nowhere.

**Moving the threshold would not fix it.** The tiny stiffness grows with the slope squared (step 4), so for any threshold some slope puts an instance on each side. A larger threshold would also start reading real but soft frames as mechanisms, and the pivot's size next to its diagonal depends on how stiff the frame's other members are, not on how stiff it is along the beam.

**A test against the rigid case would be more robust.** Across the sweep, the stiffnesses the solver returned pinned on pads are at most 0.00007587 of the same frame's with rigid joints. Buried, where pinned joints are not a mechanism, the pinned stiffness is at least 0.2424 of the rigid one. Three and a half orders of magnitude separate the two groups. A rule such as "a stiffness along the beam under 10⁻³ of the rigid case's is reported as the mechanism" would classify every instance in the sweep the same way as the owner's rule, and would keep doing so if a later model (a joint spring, partial fixity at the feet) needed the analysis rather than a fixed rule to decide. The cutoff is a modeling choice, not a sourced value, and would be stated with each result.

**Proposal: no change now.** The fixed rule is correct for the models this exploration has, and the solver's threshold is right for what it was chosen for: rounding error. If the exploration continues with a model where pinned on pads is not known in advance to be a mechanism, add the relative test then, with the sweep's two groups as its test. This step changes neither.

## What adopting it would take

Three directions, measured against `PRODUCT.md` principle 2 (compute what is well understood and show every input; put connections, racking, tipping, and anchoring on the checklist) and hard rule 2 (margins, not verdicts).

**A. Add the push to the leg check, as statics.** The finding that holds under both joint cases is the push's extra load on one leg. It may not need frame analysis to compute. Taking each A-frame as two legs pinned at the beam and at their feet, a two-bar truss, statics gives each leg's axial load from the vertical and fore-and-aft loads at the top, with the same chain tension #467 uses. That is the case with both feet held. With the lifting foot free, the crossbar takes the outward thrust and the more loaded leg carries more (in the worked example on pads, 30% over P with both feet held and 36% with the lifting foot free, step 2), so the derivation would have to choose its case and say why, or cover both. The leg check would then measure its column capacity against the larger of today's P and the push's load on the more loaded leg, with the push case's φ searched for the largest leg load. Whether the statics reproduce the frame's numbers closely enough is the first thing to find out; if they do not, this direction needs the frame analysis in core, which is a larger decision.
- *Principle 2.* Column compression is on the computed side already. This only adds a load case the check names itself as leaving out.
- *Hard rule 2.* The result stays a margin under stated assumptions, as now.
- *Where it shows.* In the leg check's calculation, as a second load case beside the bottom of the arc, and in its margin, the smaller of the two. No new section of the review.
- *What it takes.* A sourced statics derivation, written into the spec with a hand-checked worked example, as #467's was; a template version bump (0008), since the leg check's margin changes for the same parameters; new fixtures. The frame analysis's sweep becomes its cross-check, as it was for #467 and #468 here: with pinned joints and the same supports, the two should agree as closely as they do at the bottom of the arc. Nothing in `packages/frame` comes to `main` if they do.
- *What it does not settle.* Whether the column check's end conditions still hold under the push, and whether the leg also bends under it (up to 3,561 in-lb on pads in the worked example, step 2). Both would be stated as assumptions, as the leg check states its others.

**B. Keep the checklist as it is, with its racking item's reason sharpened.** The racking item says swinging pushes the frame back and forth and racking is not computed. The analysis gives it a reason a builder can act on: on pads, a frame bolted with single bolts at the beam has nothing in its members that holds it along the beam; the bolts' clamping, the anchors, or bracing along the beam does. That is a copy change to one checklist item, with no number and no new computation.
- *Principle 2 and hard rule 2.* Unchanged: racking stays on the checklist.
- *Where it shows.* The racking item's "why".

**C. Show the frame analysis in the app as an exploratory view.** A labeled panel beside the checks, headed "Exploratory frame analysis, not a structural check", with stiffness along the beam and member forces for both joint cases.
- *Against it.* There is no margin to show. No source gives a load along the beam or a sway limit, so the stiffness cannot become a margin (hard rule 2), and showing a stiffness with no limit invites reading it as one. The joint range is too wide to read: 1.36 to 4.13 times in sway, and on pads pinned is a mechanism while rigid gives a number. Principle 2 puts racking on the checklist precisely because it is hard to compute reliably, and this exploration confirms it is. It would also bring `packages/frame`, its solver, and its tests to `main` to show numbers that change no decision.

### Proposal

A, with B. A puts the one robust finding into the check that already asks the question, as statics with a source and a margin, the way #467 brought the push into the uplift check. B gives the racking item the reason the analysis found, without a number. Not C: without a sourced load along the beam or a sway limit, and with the joint range as wide as it is, the frame analysis cannot give a margin, and the checklist is the right place for what it shows along the beam.

If the owner prefers to keep everything as it is, the exploration stands as a record of why: the per-member checks agree with the frame where they overlap, and the frame cannot narrow racking without a joint stiffness or a load along the beam that no source gives.

The owner decides in #741. Nothing here changes `main`.

### Adopted

The owner chose A with B on #741 (November 6, 2026), recorded in decision 0022.

- **B** is template version 42 (#742, #743). The racking item says that on pads nothing in the frames themselves holds them along the beam, and that buried legs hold them by bending at grade.
- **A** is template version 43 (#744, #745). The leg check takes the larger of P and N, the push's load on a leg by statics: each A-frame is a rigid body on its feet, with the uplift check's loads and lever arms, and the leg carries its foot's reaction along its axis. The chain angle is searched for the largest N, and on a slope both legs are checked.
- **Statics against the frame.** Before adoption, the statics were checked against this analysis at the uplift check's chain angle. They read at most 4.74% under the frame for buried legs and 9.65% on pads, and the owner accepted up to about 10% low on pads (#741). The sweep now also runs both pushes at the leg check's own angle ("The push against core's leg check" in the sweep's report). There the statics read at most 1.65% under the frame buried with pinned joints, 2.17% with rigid joints, and 4.52% on pads with rigid joints. The leg check states 2.2% for buried legs; on pads it is not computed. Where buried legs' fixed bases take part of the push by bending, N reads up to 42.47% over the frame.
- **The worked example** at the leg check's angle: N = 551.3 lb on a back leg, with the frame within 2% of it.
- **Nothing in `packages/frame` came to `main`.** The sweep's other tables still use the pushes where a foot lifts most, so the numbers above this section are unchanged. The sweep's template version is now 43; versions 42 and 43 change no geometry.

## Still open

- A joint stiffness with the hole clearance taken up first (step 3, option 2): needs EN 1995-1-1 itself, a density for Southern Pine on Eurocode's basis, and a nonlinear analysis.
- A sourced load along the beam for a swing set, or a sway limit. Either would turn the stiffness into a margin.
- Soil stiffness for buried legs, which needs a soil input Kerf does not have.
- The workbench's racking under planing, left until after this write-up (#545, question 4).
- The relative mechanism test above, if a later model needs the analysis to decide.

## Assumptions

These hold for every result this exploration prints, and are listed with each one.

- Linear elastic, small displacements, Euler–Bernoulli members (plane sections stay plane, shear deformation ignored). No second-order (P-Δ) effects and no buckling of the whole frame.
- Members are prismatic, with E, A, and I from the section and grade the owner entered (step 2 onward).
- Bolted joints are run twice: pinned and rigid. The real joint lies between them. Step 3 found no basis for a single rotational stiffness that covers the swing set's bolts in their oversize holes, so no third case is run. In 3D (step 4), pinned frees the single leg-to-beam bolt every way and each two-bolt joint about its bolts' axis.
- Feet on pads are pinned; the uplift case runs with the lifting foot released. Buried legs are fixed at grade, and the soil makes the real fixity lower.
- Loads are the quasi-static load cases the existing checks use. No dynamic or modal analysis. No load along the beam has a source, so step 4 reports the frame's stiffness along the beam instead of a sway under an assumed load.
- With pinned joints on pads, the frame is reported as a mechanism along the beam in every case, including where the solver returns a very small stiffness on sloped ground (steps 4 and 5).
- Out of scope: connection capacity, soil, sliding, and whole-frame buckling. They stay on the checklist.

## Plan of steps

Each step is blocked by the one before. Pull requests go into `explore/frame-analysis`.

1. #726 Package, 2D frame element, and solver, tested against hand-checked examples. Done.
2. #727 One A-frame in its plane from the template's placements and joints, pinned and rigid, checked against #467's foot reactions and #468's leg load in the worked example. Done.
3. #728 Bolt slip source: NDS 2024's load/slip modulus and whether it may be used beyond group action, the textbook basis for a bolt group's rotational stiffness, and Eurocode 5 (EN 1995-1-1, 7.1) as a cross-check. A third joint case if the basis holds. The basis does not hold for these joints, so no spring is added. Done.
4. #729 3D frame element and the whole swing set, with sway along the beam for buried legs and for pads. Done.
5. #730 A sweep over the template's parameters: where sway is largest and how far the joint cases differ. Done.
6. #731 Write-up and an adoption proposal. Done.
