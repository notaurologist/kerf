# Exploratory frame analysis, not a structural check

The swing set's frame analysis (exploration #545, step 5) over the template's 3 worked examples and the first 800 draws of its seeded sweep (seed 571, template version 41), drawn as core's sweep draws them, so draw n here is draw n there. Written by `pnpm --filter @kerf/frame sweep`; every number below comes from that run.

These are forces, displacements, and stiffnesses under the stated assumptions, not margins against any capacity and not a structural check.

## Inputs and assumptions

- Structural inputs: each instance's own, which for every sweep draw are the worked example's (core's sweep draws parameters only).
- The crossbar and gusset take the legs' species, grade, and incising: core asks for none, so the script supplies them.
- G = 0.053991 × E: √(G_LR·G_LT)/E_L for slash pine, Wood Handbook FPL-GTR-282 Table 5–1, p. 5–2, and Eq. 9–9, p. 9–5.
- Each instance runs every load case (one pound along the beam; the bottom of the arc; pushed toward the front and toward the back where a foot lifts most) in every support case (buried: fixed at grade; on pads: both feet pinned, and for each push the lifting feet released), with bolted joints pinned and rigid.
- With pinned joints on pads, every case is reported as the mechanism along the beam (step 4; owner's decision on #735). Where the solver still returned a stiffness, it is listed under "Mechanisms" and used nowhere else.
- Sway along the beam is a stiffness, inches per pound of load along the beam at its middle, the larger of the two frames' tops. No load along the beam is applied and no sway limit is assumed.
- Largest member forces and foot reactions are over the swing load cases only, and over every member: legs, crossbars, gussets, and the beam. A member's bending moment is the resultant of its two bending moments at either end.

Assumptions of every case (from `swingSet.ts`):

- The whole swing set: both A-frames and the beam, in the spec's coordinates (x along the beam, y front to back, z up).
- Linear elastic, small displacements, Euler–Bernoulli members: shear deformation and torsional warping are left out (McGuire et al., Section 4.6.1). No second-order (P-Δ) effects and no buckling.
- Members are prismatic, on their gross sections. E is from Table 4B for the species and grade entered for each member, with wet service, C_t = 1.0, and incising where entered, as in step 2. G is E times the ratio stated with each section. J is the Wood Handbook's approximation for a rectangle, with φ read from its Figure 9–9. A built-up beam's plies bend together about the strong axis; across it and in torsion each ply is taken on its own.
- The beam runs along its centerline at the leg-to-beam bolts' height, between the frames' bolts, through the hangers. The overhangs past the frames carry no load and are left out; their weight is in the half of the beam's weight each frame carries. The beam's cross-section is taken as rigid across its depth and over the short length from each bolt to the gusset's bearing, so each frame's legs and gusset join the beam's axis by rigid links (McGuire et al., Section 13.5.2, extended to 3D).
- Legs run along their centerlines, at the middle of their thickness along the beam, with joints at the gusset's and crossbar's bolt groups and the ground, as in step 2. The crossbar and gusset lie in their own planes on the frame's outside face; each bolt group joins them to the leg's centerline by a rigid link along the bolts.
- Bolted joints are run pinned and rigid; the real joint lies between them. Pinned: the leg-to-beam bolt is a single bolt, and each leg turns freely on it in every direction (step 2 let it turn in the frame's plane; along the beam this is turning about the bolt's own axis, the frame leaning against the beam). Each crossbar and gusset joint turns freely about its bolts' axis, along the beam, which is step 2's in-plane pin; its two bolts, spread across the board, hold the faces together against the other two rotations. Rigid: nothing turns. The legs are continuous in both.
- Where the beam bears on the gusset differs between the two cases. The gusset is on the frame's outside face, so the beam bears on it a short way along the beam from the bolt (2.5 in the worked example). With the beam held down at the bolt and up at the gusset, the two would form a couple that stops the frame turning against the beam along the beam, but only once the bolt bears up or down in its hole, which is 1/16" oversize: the spec takes the gusset as what the beam meets first. Pinned, the bearing is taken in line with the bolt, so there is no couple. Rigid, it is where it is.
- The gusset is not fastened to the beam: it bears under it. It carries the beam's weight, its push toward the front or back, and its turning in the frame's plane, as in step 2, and nothing along the beam or about any other axis; no friction is counted.
- Swing loads are the uplift check's (both swings at the same chain angle φ, each rider centered, half the chain tension at each hanger), applied at the hangers on the beam's underside and carried to the beam's axis with the moment their push makes about it. The beam shares them between the frames, which differs slightly from the uplift check's share by the beam's span between the gussets when the riders differ. Half the beam's whole weight is at each frame's bolt. The legs', crossbars', and gussets' own weight and the frame's inertia are left out.
- No load along the beam is applied from a source. The swing loads act in the A-frames' planes (spec, Structural model, Uplift at the feet), and neither the spec nor any source read for this exploration gives a load along the beam for a swing set (wind, a rider pushing on a leg, a swing twisting on its chains). So the frame's stiffness along the beam is reported instead: how far each frame's top moves along the beam per pound of load along the beam, applied at the beam's middle. Multiplying it by a load gives a sway; no sway limit is assumed.
- Out of scope: connection capacity, soil, sliding, whole-frame buckling, and dynamics.

### Comparison tolerances, fixed before the run

- **Leg axial load.** Core's leg check (#468) takes P = (C·R_s + R_w) / (2·cos α) at the bottom of the arc. The frame's value is the largest compression in a leg's lowest member, from its crossbar to its foot, in the same load case. They differ when |frame − P| / P is over 1.0%.
- **Foot uplift.** Core's uplift check (#467) gives each foot's pull on pads as C·S − D·c_v, with the lifting foot bearing nothing. The frame's value is that foot's pull in the case with the lifting feet released. They differ when |frame − core| is over the larger of 1.0% of core's value and 1.0 lb. Core has no uplift check for buried legs, so they are not compared.

## Instances

| Outcome | Instances |
|---|---|
| Analyzed | 243 (181 buried, 62 on pads) |
| refused | 414 |
| not-computed | 145 |
| input-needed | 1 |
| Total | 803 |

Not analyzed, by reason:

| Outcome | Reason | Instances | First instance |
|---|---|---|---|
| not-computed | No design values are entered for southern-pine-no2 in 6x6, the legs. | 92 | draw 10 |
| refused | The template refuses it: footprint-out-of-range | 87 | draw 7 (No splay between 5° and 35° gives that footprint depth with these parameters.) |
| refused | The template refuses it: seat-too-close-to-frame | 61 | draw 0 (Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| not-computed | No design values are entered for southern-pine-no2 in 6x6, the beam. | 53 | draw 42 |
| refused | The template refuses it: seats-too-close | 53 | draw 3 (The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hanger-outside-span, seat-too-close-to-frame, seats-too-close | 35 | draw 11 (Hangers must be between the frames' inside faces (19-11/16" to 62-9/16" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hanger-outside-span, hangers-overlap, seat-too-close-to-frame, seats-too-close | 33 | draw 4 (The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Hangers must be between the frames' inside faces (17-1/2" to 32-3/8" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hanger-outside-span, seat-too-close-to-frame | 33 | draw 41 (Hangers must be between the frames' inside faces (21-9/16" to 77-1/16" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: seat-too-close-to-frame, seats-too-close | 33 | draw 9 (Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hangers-overlap, seats-too-close | 21 | draw 56 (The two swings overlap. Move the swing centers apart or reduce the hanger spacing. The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hangers-overlap, seat-too-close-to-frame, seats-too-close | 20 | draw 146 (The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hanger-holes-outside-beam | 11 | draw 43 (The swing hanger bolt holes, 13/16" across, must fit within the beam's 3-1/2" depth at that height.) |
| refused | The template refuses it: flush-cut-through-leg | 6 | draw 15 (The flush cut against the beam would be 3-7/8" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay.) |
| refused | The template refuses it: flush-cut-through-leg, seats-too-close | 2 | draw 583 (The flush cut against the beam would be 3-9/16" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hanger-holes-outside-beam, hanger-outside-span, seat-too-close-to-frame | 2 | draw 131 (Hangers must be between the frames' inside faces (19-7/16" to 52-7/8" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The swing hanger bolt holes, 13/16" across, must fit within the beam's 3-1/2" depth at that height.) |
| refused | The template refuses it: hanger-holes-outside-beam, seat-too-close-to-frame | 2 | draw 394 (Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The swing hanger bolt holes, 9/16" across, must fit within the beam's 3-1/2" depth at that height.) |
| refused | The template refuses it: hanger-holes-outside-beam, seats-too-close | 2 | draw 256 (The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The swing hanger bolt holes, 7/16" across, must fit within the beam's 3-1/2" depth at that height.) |
| input-needed | Heaviest rider on each swing, with seat and chain, Maximum swing angle, Dynamic factor, Beam species and grade, Whether the beam lumber is incised, Beam moisture content, Leg species and grade, Whether the leg lumber is incised, Crossbar species and grade, Whether the crossbar lumber is incised, Gusset species and grade, Whether the gusset lumber is incised | 1 | Example: Worked example, no structural inputs |
| refused | The template refuses it: crossbar-below-grade | 1 | draw 529 (The crossbar's bottom edge (6-3/16" up) is at or below the ground at the uphill legs. Raise the crossbar.) |
| refused | The template refuses it: crossbar-below-grade, flush-cut-through-leg, hanger-outside-span, hangers-overlap, seat-too-close-to-frame, seats-too-close | 1 | draw 219 (The flush cut against the beam would be 3-15/16" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. The crossbar's bottom edge (13-1/4" up) is at or below the ground at the uphill legs. Raise the crossbar. The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Hangers must be between the frames' inside faces (25-9/16" to 29-7/8" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: crossbar-below-grade, hanger-holes-outside-beam, seat-too-close-to-frame | 1 | draw 139 (The crossbar's bottom edge (6" up) is at or below the ground at the uphill legs. Raise the crossbar. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The swing hanger bolt holes, 7/16" across, must fit within the beam's 3-1/2" depth at that height.) |
| refused | The template refuses it: crossbar-below-grade, hanger-outside-span, seat-too-close-to-frame | 1 | draw 122 (The crossbar's bottom edge (14-11/16" up) is at or below the ground at the uphill legs. Raise the crossbar. Hangers must be between the frames' inside faces (11-15/16" to 67-13/16" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: crossbar-below-grade, seat-too-close-to-frame | 1 | draw 421 (The crossbar's bottom edge (10-3/4" up) is at or below the ground at the uphill legs. Raise the crossbar. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: crossbar-below-grade, seat-too-close-to-frame, seats-too-close | 1 | draw 63 (The crossbar's bottom edge (7-3/8" up) is at or below the ground at the uphill legs. Raise the crossbar. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg, hangers-overlap, seat-too-close-to-frame, seats-too-close | 1 | draw 39 (The flush cut against the beam would be 4-1/16" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg, seat-too-close-to-frame | 1 | draw 178 (The flush cut against the beam would be 3-3/4" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg, seat-too-close-to-frame, seats-too-close | 1 | draw 753 (The flush cut against the beam would be 3-3/4" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: frames-do-not-fit | 1 | draw 2 (Two frames set 22-15/16" in from each end of a 52-3/4" beam overlap. Reduce the frame inset or lengthen the beam.) |
| refused | The template refuses it: hanger-holes-outside-beam, hanger-outside-span, hangers-overlap, seat-too-close-to-frame, seats-too-close | 1 | draw 712 (The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Hangers must be between the frames' inside faces (20-13/16" to 55-1/8" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The swing hanger bolt holes, 11/16" across, must fit within the beam's 3-1/2" depth at that height.) |
| refused | The template refuses it: hanger-holes-outside-beam, hanger-outside-span, seat-too-close-to-frame, seats-too-close | 1 | draw 490 (Hangers must be between the frames' inside faces (17" to 57-13/16" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The swing hanger bolt holes, 13/16" across, must fit within the beam's 3-1/2" depth at that height.) |
| refused | The template refuses it: hanger-holes-outside-beam, seat-too-close-to-frame, seats-too-close | 1 | draw 247 (Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The swing hanger bolt holes, 9/16" across, must fit within the beam's 3-1/2" depth at that height.) |

## Mechanisms

- Joints pinned, buried: 181 instances; 0 a mechanism along the beam and 0 another mechanism under the load along the beam; 0 swing load cases a mechanism along the beam and 0 another mechanism.
- Joints pinned, on pads: 62 instances; 62 a mechanism along the beam and 0 another mechanism under the load along the beam; 310 swing load cases a mechanism along the beam and 0 another mechanism.
- Joints rigid, buried: 181 instances; 0 a mechanism along the beam and 0 another mechanism under the load along the beam; 0 swing load cases a mechanism along the beam and 0 another mechanism.
- Joints rigid, on pads: 62 instances; 0 a mechanism along the beam and 0 another mechanism under the load along the beam; 0 swing load cases a mechanism along the beam and 0 another mechanism.

Pinned on pads, the solver returned a stiffness along the beam in 30 of 62 instances instead of reading the mechanism. Each is listed with the same instance's stiffness with rigid joints:

| Instance | Ground slope (in/ft) | Pinned, lb/in | Rigid, lb/in | Pinned over rigid |
|---|---|---|---|---|
| draw 102 | -2.375 | 0.003517 | 387.7 | 0.000009071 |
| draw 116 | -1.438 | 0.0004078 | 132.3 | 0.000003082 |
| draw 117 | -1.438 | 0.001372 | 121.4 | 0.0000113 |
| draw 138 | 1.563 | 0.005 | 105.7 | 0.00004729 |
| draw 174 | -2.356 | 0.001171 | 241.7 | 0.000004844 |
| draw 239 | 1.447 | 0.004506 | 250.9 | 0.00001796 |
| draw 242 | -1.178 | 0.000343 | 111.4 | 0.00000308 |
| draw 287 | 0.625 | 0.0004492 | 36.93 | 0.00001217 |
| draw 296 | -1.688 | 0.0007928 | 605.6 | 0.000001309 |
| draw 299 | 1.489 | 0.001148 | 45.82 | 0.00002505 |
| draw 305 | -2.093 | 0.001258 | 475.9 | 0.000002644 |
| draw 312 | -1.903 | 0.001734 | 477.3 | 0.000003632 |
| draw 313 | 1.234 | 0.001483 | 452.8 | 0.000003275 |
| draw 333 | -2.981 | 0.02362 | 720.6 | 0.00003278 |
| draw 337 | -2.375 | 0.002389 | 172.2 | 0.00001387 |
| draw 399 | 1.517 | 0.001197 | 218.9 | 0.00000547 |
| draw 410 | 0.688 | 0.0006634 | 204.4 | 0.000003246 |
| draw 417 | -2.128 | 0.002274 | 197.7 | 0.0000115 |
| draw 430 | 2.500 | 0.004508 | 151 | 0.00002986 |
| draw 443 | 2.674 | 0.005942 | 687.8 | 0.00000864 |
| draw 445 | -2.938 | 0.01608 | 329.3 | 0.00004882 |
| draw 473 | -1.470 | 0.0001752 | 324.2 | 5.402e-7 |
| draw 514 | -0.513 | 0.0009239 | 565.1 | 0.000001635 |
| draw 521 | 2.407 | 0.002802 | 517.8 | 0.000005411 |
| draw 595 | 2.056 | 0.002635 | 167.5 | 0.00001573 |
| draw 615 | 1.625 | 0.0001111 | 73.98 | 0.000001502 |
| draw 617 | -2.129 | 0.003707 | 48.86 | 0.00007587 |
| draw 654 | -0.938 | 0.001163 | 293.5 | 0.000003964 |
| draw 663 | 1.782 | 0.0003852 | 121.5 | 0.000003172 |
| draw 696 | -1.688 | 0.0001627 | 38.84 | 0.000004188 |

Pinned over rigid, these stiffnesses are at most 0.00007587. Buried, where pinned joints are not a mechanism, the pinned stiffness is at least 0.2424 of the rigid one.

## Comparison with the sourced checks

### Leg axial load against #468

424 comparisons in 243 instances; 101 differ by more than 1.0%.

| Feet | Joints | Comparisons | Over tolerance | Smallest difference | Median | Largest |
|---|---|---|---|---|---|---|
| Buried | pinned | 181 | 0 | -0.27% | +0.16% | +0.71% |
| Buried | rigid | 181 | 88 | -18.82% | -0.18% | +8.79% |
| On pads | pinned | 0 | – | – | – | – |
| On pads | rigid | 62 | 13 | -13.42% | -0.16% | +0.99% |

Every comparison over the tolerance:

| Instance | Supports | Joints | Core P (lb) | Frame (lb) | Difference | Leg | Where |
|---|---|---|---|---|---|---|---|
| draw 435 | Both feet fixed at grade | rigid | 423.55 | 343.82 | -18.82% | left-back-leg-3 | splay 35.0°, beam height 68.00, burial 42.63, crossbar height 20.12, beam length 201.31, 4x6 legs, 4x6 beam |
| draw 766 | Both feet fixed at grade | rigid | 394.08 | 332.01 | -15.75% | left-back-leg-3 | splay 27.6°, beam height 67.24, burial 17.25, crossbar height 24.13, beam length 234.50, 4x8 legs, 2-ply 2x8 beam |
| draw 296 | Both feet pinned on their pads | rigid | 405.20 | 350.84 | -13.42% | left-front-leg-3 | splay 33.2°, beam height 64.33, burial 0.00, crossbar height 14.11, beam length 222.64, 4x8 legs, 4x8 beam |
| draw 651 | Both feet fixed at grade | rigid | 422.50 | 380.94 | -9.84% | left-back-leg-3 | splay 31.9°, beam height 75.84, burial 27.06, crossbar height 37.33, beam length 190.82, 4x8 legs, 4x6 beam |
| draw 366 | Both feet fixed at grade | rigid | 420.86 | 380.71 | -9.54% | right-front-leg-3 | splay 33.1°, beam height 97.75, burial 4.32, crossbar height 26.78, beam length 209.72, 4x8 legs, 3-ply 2x6 beam |
| draw 729 | Both feet fixed at grade | rigid | 398.94 | 370.25 | -7.19% | left-back-leg-3 | splay 33.2°, beam height 63.44, burial 40.44, crossbar height 41.63, beam length 184.63, 4x8 legs, 4x4 beam |
| draw 751 | Both feet fixed at grade | rigid | 409.86 | 380.60 | -7.14% | right-front-leg-3 | splay 32.2°, beam height 119.63, burial 4.31, crossbar height 18.56, beam length 186.12, 4x6 legs, 4x8 beam |
| draw 793 | Both feet fixed at grade | rigid | 346.26 | 323.09 | -6.69% | right-front-leg-3 | splay 19.5°, beam height 128.55, burial 11.65, crossbar height 13.34, beam length 232.75, 4x8 legs, 2-ply 2x6 beam |
| draw 519 | Both feet fixed at grade | rigid | 397.11 | 371.74 | -6.39% | left-front-leg-3 | splay 32.5°, beam height 78.46, burial 23.19, crossbar height 57.50, beam length 237.44, 4x8 legs, 4x4 beam |
| draw 452 | Both feet pinned on their pads | rigid | 406.40 | 380.64 | -6.34% | right-front-leg-3 | splay 34.0°, beam height 90.31, burial 0.00, crossbar height 31.19, beam length 216.93, 4x6 legs, 4x4 beam |
| draw 376 | Both feet fixed at grade | rigid | 400.89 | 376.11 | -6.18% | right-front-leg-3 | splay 31.9°, beam height 62.72, burial 22.19, crossbar height 33.88, beam length 170.94, 4x6 legs, 4x4 beam |
| draw 36 | Both feet fixed at grade | rigid | 420.23 | 395.97 | -5.77% | right-back-leg-3 | splay 34.6°, beam height 136.63, burial 37.38, crossbar height 40.94, beam length 239.06, 4x6 legs, 4x6 beam |
| draw 615 | Both feet pinned on their pads | rigid | 420.27 | 396.20 | -5.73% | right-back-leg-3 | splay 34.1°, beam height 89.94, burial 0.00, crossbar height 15.64, beam length 230.29, 4x4 legs, 3-ply 2x4 beam |
| draw 265 | Both feet fixed at grade | rigid | 395.06 | 373.04 | -5.57% | left-front-leg-3 | splay 27.7°, beam height 72.06, burial 10.40, crossbar height 22.19, beam length 143.83, 4x6 legs, 3-ply 2x6 beam |
| draw 242 | Both feet pinned on their pads | rigid | 363.75 | 343.77 | -5.49% | left-front-leg-3 | splay 24.3°, beam height 83.89, burial 0.00, crossbar height 27.94, beam length 185.72, 4x8 legs, 4x4 beam |
| draw 112 | Both feet fixed at grade | rigid | 340.47 | 321.95 | -5.44% | left-back-leg-3 | splay 17.2°, beam height 78.00, burial 3.50, crossbar height 21.38, beam length 233.00, 4x8 legs, 4x6 beam |
| draw 455 | Both feet fixed at grade | rigid | 416.12 | 394.07 | -5.30% | left-front-leg-3 | splay 33.7°, beam height 79.44, burial 42.00, crossbar height 44.93, beam length 210.99, 4x8 legs, 4x6 beam |
| draw 463 | Both feet fixed at grade | rigid | 416.02 | 394.44 | -5.19% | left-back-leg-3 | splay 34.2°, beam height 106.13, burial 41.00, crossbar height 23.56, beam length 119.22, 4x8 legs, 4x4 beam |
| draw 282 | Both feet fixed at grade | rigid | 385.22 | 366.54 | -4.85% | left-front-leg-3 | splay 27.2°, beam height 139.38, burial 7.06, crossbar height 30.81, beam length 198.69, 4x6 legs, 4x6 beam |
| draw 32 | Both feet fixed at grade | rigid | 404.37 | 385.21 | -4.74% | left-front-leg-3 | splay 21.0°, beam height 120.25, burial 42.04, crossbar height 13.69, beam length 192.51, 4x8 legs, 4x6 beam |
| draw 579 | Both feet fixed at grade | rigid | 336.63 | 320.76 | -4.72% | left-front-leg-3 | splay 22.3°, beam height 90.00, burial 13.69, crossbar height 24.36, beam length 165.56, 4x6 legs, 4x4 beam |
| draw 232 | Both feet fixed at grade | rigid | 396.81 | 379.99 | -4.24% | right-front-leg-3 | splay 32.4°, beam height 67.00, burial 7.94, crossbar height 54.06, beam length 146.39, 4x8 legs, 2-ply 2x4 beam |
| draw 453 | Both feet fixed at grade | rigid | 411.41 | 394.14 | -4.20% | left-back-leg-3 | splay 28.3°, beam height 91.44, burial 21.24, crossbar height 35.06, beam length 183.02, 4x6 legs, 4x6 beam |
| draw 722 | Both feet pinned on their pads | rigid | 400.67 | 384.27 | -4.09% | left-back-leg-3 | splay 27.6°, beam height 113.00, burial 0.00, crossbar height 27.94, beam length 212.25, 4x8 legs, 4x8 beam |
| draw 581 | Both feet fixed at grade | rigid | 343.81 | 330.83 | -3.78% | right-back-leg-3 | splay 18.0°, beam height 61.71, burial 21.75, crossbar height 44.95, beam length 189.40, 4x8 legs, 4x8 beam |
| draw 89 | Both feet pinned on their pads | rigid | 353.16 | 340.70 | -3.53% | left-front-leg-3 | splay 20.4°, beam height 102.68, burial 0.00, crossbar height 29.13, beam length 205.69, 4x8 legs, 2-ply 2x4 beam |
| draw 226 | Both feet pinned on their pads | rigid | 417.86 | 403.57 | -3.42% | right-back-leg-3 | splay 31.3°, beam height 99.90, burial 0.00, crossbar height 22.02, beam length 165.48, 4x6 legs, 2-ply 2x6 beam |
| draw 249 | Both feet fixed at grade | rigid | 384.38 | 371.43 | -3.37% | right-front-leg-3 | splay 31.8°, beam height 127.56, burial 38.43, crossbar height 34.96, beam length 114.00, 4x6 legs, 2-ply 2x4 beam |
| draw 703 | Both feet fixed at grade | rigid | 378.66 | 367.27 | -3.01% | right-back-leg-3 | splay 14.4°, beam height 133.45, burial 22.13, crossbar height 19.47, beam length 220.25, 4x8 legs, 3-ply 2x6 beam |
| draw 156 | Both feet fixed at grade | rigid | 449.87 | 436.41 | -2.99% | left-back-leg-3 | splay 32.9°, beam height 97.69, burial 21.26, crossbar height 18.69, beam length 152.34, 4x6 legs, 3-ply 2x6 beam |
| draw 642 | Both feet fixed at grade | rigid | 372.37 | 361.28 | -2.98% | left-front-leg-3 | splay 29.7°, beam height 83.29, burial 21.06, crossbar height 42.88, beam length 190.38, 4x8 legs, 2-ply 2x8 beam |
| draw 702 | Both feet fixed at grade | rigid | 369.58 | 358.60 | -2.97% | right-back-leg-3 | splay 23.2°, beam height 74.33, burial 33.44, crossbar height 56.30, beam length 219.79, 4x8 legs, 2-ply 2x6 beam |
| draw 206 | Both feet fixed at grade | rigid | 392.70 | 381.41 | -2.88% | right-back-leg-3 | splay 29.4°, beam height 100.50, burial 24.56, crossbar height 29.69, beam length 160.25, 4x6 legs, 4x6 beam |
| draw 202 | Both feet fixed at grade | rigid | 389.61 | 378.53 | -2.84% | left-back-leg-3 | splay 24.0°, beam height 76.50, burial 17.88, crossbar height 14.63, beam length 167.88, 4x6 legs, 4x8 beam |
| draw 255 | Both feet fixed at grade | rigid | 356.61 | 346.81 | -2.75% | left-back-leg-3 | splay 18.5°, beam height 77.00, burial 34.12, crossbar height 17.38, beam length 216.81, 4x6 legs, 2-ply 2x6 beam |
| draw 764 | Both feet fixed at grade | rigid | 442.89 | 430.97 | -2.69% | left-back-leg-3 | splay 33.3°, beam height 98.01, burial 5.88, crossbar height 40.09, beam length 196.95, 4x6 legs, 4x6 beam |
| draw 191 | Both feet fixed at grade | rigid | 393.77 | 383.55 | -2.59% | left-back-leg-3 | splay 28.1°, beam height 110.94, burial 35.22, crossbar height 17.53, beam length 222.25, 4x4 legs, 4x6 beam |
| draw 629 | Both feet fixed at grade | rigid | 376.05 | 366.30 | -2.59% | right-front-leg-3 | splay 26.2°, beam height 111.69, burial 5.27, crossbar height 52.88, beam length 175.95, 4x8 legs, 4x6 beam |
| draw 12 | Both feet pinned on their pads | rigid | 383.60 | 374.42 | -2.39% | left-front-leg-3 | splay 32.8°, beam height 76.04, burial 0.00, crossbar height 37.61, beam length 93.63, 4x8 legs, 2-ply 2x6 beam |
| draw 557 | Both feet fixed at grade | rigid | 376.00 | 367.26 | -2.33% | right-back-leg-3 | splay 20.0°, beam height 60.05, burial 45.06, crossbar height 43.15, beam length 199.36, 4x8 legs, 4x4 beam |
| draw 496 | Both feet fixed at grade | rigid | 393.59 | 384.85 | -2.22% | left-front-leg-3 | splay 24.4°, beam height 62.78, burial 10.44, crossbar height 42.06, beam length 187.13, 4x8 legs, 4x4 beam |
| draw 166 | Both feet pinned on their pads | rigid | 433.95 | 424.33 | -2.22% | right-back-leg-3 | splay 29.4°, beam height 102.26, burial 0.00, crossbar height 36.19, beam length 188.94, 4x8 legs, 4x8 beam |
| draw 464 | Both feet fixed at grade | rigid | 381.50 | 373.08 | -2.21% | left-front-leg-3 | splay 26.2°, beam height 74.41, burial 18.00, crossbar height 34.75, beam length 168.94, 4x6 legs, 4x6 beam |
| draw 364 | Both feet fixed at grade | rigid | 378.01 | 369.86 | -2.16% | left-back-leg-3 | splay 26.3°, beam height 94.32, burial 19.89, crossbar height 31.63, beam length 208.56, 4x4 legs, 3-ply 2x4 beam |
| draw 657 | Both feet fixed at grade | rigid | 378.48 | 370.32 | -2.15% | right-front-leg-3 | splay 16.2°, beam height 67.00, burial 2.96, crossbar height 31.44, beam length 189.19, 4x8 legs, 4x6 beam |
| draw 485 | Both feet fixed at grade | rigid | 373.16 | 365.42 | -2.07% | left-back-leg-3 | splay 28.2°, beam height 71.73, burial 47.51, crossbar height 55.69, beam length 144.75, 4x8 legs, 4x8 beam |
| draw 40 | Both feet fixed at grade | rigid | 342.91 | 336.23 | -1.95% | right-back-leg-3 | splay 23.5°, beam height 89.38, burial 21.25, crossbar height 37.61, beam length 210.92, 4x6 legs, 4x4 beam |
| draw 648 | Both feet fixed at grade | rigid | 388.26 | 381.00 | -1.87% | left-back-leg-3 | splay 32.3°, beam height 134.88, burial 2.37, crossbar height 59.13, beam length 202.70, 4x6 legs, 2-ply 2x6 beam |
| draw 74 | Both feet fixed at grade | rigid | 413.20 | 405.95 | -1.75% | left-front-leg-3 | splay 33.6°, beam height 109.27, burial 6.25, crossbar height 72.81, beam length 236.06, 4x6 legs, 4x6 beam |
| draw 695 | Both feet fixed at grade | rigid | 371.77 | 365.27 | -1.75% | right-front-leg-3 | splay 25.8°, beam height 75.74, burial 0.63, crossbar height 36.63, beam length 111.94, 4x8 legs, 4x8 beam |
| draw 362 | Both feet pinned on their pads | rigid | 369.83 | 363.42 | -1.73% | right-front-leg-3 | splay 31.3°, beam height 77.08, burial 0.00, crossbar height 40.13, beam length 115.57, 4x8 legs, 3-ply 2x6 beam |
| draw 738 | Both feet fixed at grade | rigid | 356.50 | 350.33 | -1.73% | right-back-leg-3 | splay 20.4°, beam height 61.63, burial 33.69, crossbar height 21.25, beam length 171.89, 4x6 legs, 4x4 beam |
| draw 678 | Both feet fixed at grade | rigid | 372.36 | 366.16 | -1.67% | right-front-leg-3 | splay 24.6°, beam height 66.06, burial 7.10, crossbar height 43.44, beam length 163.69, 4x8 legs, 4x6 beam |
| draw 203 | Both feet fixed at grade | rigid | 404.88 | 398.41 | -1.60% | left-front-leg-3 | splay 34.9°, beam height 77.13, burial 29.19, crossbar height 36.70, beam length 165.31, 4x4 legs, 4x6 beam |
| draw 141 | Both feet fixed at grade | rigid | 382.19 | 376.27 | -1.55% | right-front-leg-3 | splay 27.3°, beam height 121.69, burial 21.69, crossbar height 57.13, beam length 186.36, 4x8 legs, 4x6 beam |
| draw 645 | Both feet fixed at grade | rigid | 354.67 | 349.20 | -1.54% | right-front-leg-3 | splay 22.7°, beam height 63.50, burial 44.74, crossbar height 26.38, beam length 148.36, 4x4 legs, 4x4 beam |
| draw 343 | Both feet fixed at grade | rigid | 358.87 | 353.41 | -1.52% | left-back-leg-3 | splay 13.6°, beam height 88.50, burial 24.89, crossbar height 25.69, beam length 234.37, 4x8 legs, 2-ply 2x4 beam |
| draw 473 | Both feet pinned on their pads | rigid | 383.68 | 377.93 | -1.50% | right-front-leg-3 | splay 32.9°, beam height 62.82, burial 0.00, crossbar height 22.63, beam length 205.10, 4x4 legs, 4x6 beam |
| draw 565 | Both feet fixed at grade | rigid | 416.84 | 410.60 | -1.50% | left-back-leg-3 | splay 34.4°, beam height 139.19, burial 37.33, crossbar height 42.88, beam length 163.50, 4x6 legs, 4x8 beam |
| draw 493 | Both feet fixed at grade | rigid | 423.37 | 417.22 | -1.45% | left-front-leg-3 | splay 33.4°, beam height 119.94, burial 23.56, crossbar height 40.56, beam length 191.02, 4x6 legs, 4x8 beam |
| draw 175 | Both feet fixed at grade | rigid | 384.78 | 379.24 | -1.44% | right-front-leg-3 | splay 29.3°, beam height 136.63, burial 24.19, crossbar height 87.20, beam length 218.31, 4x8 legs, 3-ply 2x4 beam |
| draw 110 | Both feet fixed at grade | rigid | 395.62 | 390.11 | -1.39% | right-front-leg-3 | splay 32.2°, beam height 110.13, burial 31.25, crossbar height 88.17, beam length 196.25, 4x8 legs, 3-ply 2x6 beam |
| draw 248 | Both feet fixed at grade | rigid | 378.92 | 373.82 | -1.35% | right-back-leg-3 | splay 26.1°, beam height 105.37, burial 37.38, crossbar height 79.63, beam length 219.40, 4x8 legs, 3-ply 2x8 beam |
| draw 395 | Both feet fixed at grade | rigid | 353.97 | 349.39 | -1.29% | left-back-leg-3 | splay 14.0°, beam height 113.44, burial 35.83, crossbar height 20.04, beam length 206.38, 4x8 legs, 2-ply 2x8 beam |
| draw 679 | Both feet fixed at grade | rigid | 380.54 | 375.70 | -1.27% | left-back-leg-3 | splay 23.8°, beam height 113.15, burial 3.76, crossbar height 63.43, beam length 226.72, 4x8 legs, 4x6 beam |
| draw 576 | Both feet fixed at grade | rigid | 375.14 | 370.42 | -1.26% | left-back-leg-3 | splay 25.4°, beam height 84.85, burial 9.37, crossbar height 25.66, beam length 119.90, 4x8 legs, 3-ply 2x6 beam |
| draw 663 | Both feet pinned on their pads | rigid | 426.58 | 421.22 | -1.25% | left-back-leg-3 | splay 34.0°, beam height 110.73, burial 0.00, crossbar height 55.88, beam length 190.56, 4x8 legs, 3-ply 2x6 beam |
| draw 291 | Both feet fixed at grade | rigid | 357.11 | 352.65 | -1.25% | left-front-leg-3 | splay 29.4°, beam height 117.88, burial 39.96, crossbar height 60.00, beam length 159.41, 4x6 legs, 4x4 beam |
| draw 363 | Both feet fixed at grade | rigid | 345.57 | 341.29 | -1.24% | right-back-leg-3 | splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x4 beam |
| draw 96 | Both feet fixed at grade | rigid | 370.99 | 366.51 | -1.21% | left-front-leg-3 | splay 28.5°, beam height 93.94, burial 35.13, crossbar height 34.99, beam length 188.88, 4x4 legs, 2-ply 2x8 beam |
| draw 735 | Both feet fixed at grade | rigid | 403.35 | 398.76 | -1.14% | left-front-leg-3 | splay 30.9°, beam height 94.98, burial 33.06, crossbar height 47.69, beam length 170.56, 4x6 legs, 4x8 beam |
| draw 548 | Both feet fixed at grade | rigid | 341.69 | 337.83 | -1.13% | right-front-leg-3 | splay 22.1°, beam height 80.96, burial 41.37, crossbar height 57.56, beam length 186.88, 4x6 legs, 3-ply 2x4 beam |
| draw 163 | Both feet fixed at grade | rigid | 451.49 | 446.42 | -1.12% | left-front-leg-3 | splay 34.5°, beam height 129.27, burial 20.44, crossbar height 16.63, beam length 172.98, 4x4 legs, 4x4 beam |
| draw 566 | Both feet fixed at grade | rigid | 358.77 | 354.75 | -1.12% | left-front-leg-3 | splay 22.3°, beam height 67.50, burial 39.81, crossbar height 18.69, beam length 154.18, 4x4 legs, 4x6 beam |
| draw 597 | Both feet pinned on their pads | rigid | 392.50 | 388.47 | -1.03% | right-back-leg-3 | splay 29.1°, beam height 102.38, burial 0.00, crossbar height 78.95, beam length 225.25, 4x8 legs, 4x8 beam |
| draw 723 | Both feet fixed at grade | rigid | 397.96 | 393.88 | -1.02% | left-back-leg-3 | splay 27.8°, beam height 117.94, burial 15.55, crossbar height 80.00, beam length 227.11, 4x8 legs, 3-ply 2x8 beam |
| draw 574 | Both feet fixed at grade | rigid | 386.05 | 382.16 | -1.01% | right-front-leg-3 | splay 21.5°, beam height 86.41, burial 43.80, crossbar height 59.66, beam length 206.38, 4x8 legs, 3-ply 2x8 beam |
| draw 413 | Both feet fixed at grade | rigid | 397.65 | 401.68 | +1.01% | left-front-leg-3 | splay 17.2°, beam height 114.07, burial 38.88, crossbar height 85.88, beam length 176.85, 4x8 legs, 4x6 beam |
| draw 229 | Both feet fixed at grade | rigid | 378.30 | 382.34 | +1.07% | right-back-leg-3 | splay 20.6°, beam height 90.27, burial 2.54, crossbar height 33.25, beam length 212.63, 4x4 legs, 2-ply 2x4 beam |
| draw 487 | Both feet fixed at grade | rigid | 347.44 | 351.16 | +1.07% | right-back-leg-3 | splay 12.2°, beam height 122.33, burial 23.13, crossbar height 44.53, beam length 219.19, 4x8 legs, 4x4 beam |
| draw 130 | Both feet fixed at grade | rigid | 412.30 | 416.85 | +1.10% | left-front-leg-3 | splay 27.9°, beam height 124.13, burial 10.92, crossbar height 103.92, beam length 220.40, 4x4 legs, 2-ply 2x4 beam |
| draw 212 | Both feet fixed at grade | rigid | 321.20 | 324.84 | +1.13% | left-front-leg-3 | splay 10.9°, beam height 94.38, burial 18.08, crossbar height 20.06, beam length 173.19, 4x6 legs, 3-ply 2x4 beam |
| draw 50 | Both feet fixed at grade | rigid | 354.49 | 358.53 | +1.14% | left-back-leg-3 | splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x8 legs, 3-ply 2x4 beam |
| draw 381 | Both feet fixed at grade | rigid | 350.61 | 355.03 | +1.26% | left-front-leg-3 | splay 6.4°, beam height 75.77, burial 32.23, crossbar height 47.56, beam length 206.75, 4x4 legs, 4x4 beam |
| draw 272 | Both feet fixed at grade | rigid | 332.92 | 337.12 | +1.26% | left-back-leg-3 | splay 7.9°, beam height 101.75, burial 21.93, crossbar height 40.13, beam length 169.23, 4x6 legs, 4x4 beam |
| draw 460 | Both feet fixed at grade | rigid | 324.98 | 329.09 | +1.27% | right-back-leg-3 | splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam |
| draw 500 | Both feet fixed at grade | rigid | 356.48 | 361.36 | +1.37% | right-front-leg-3 | splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x6 legs, 2-ply 2x4 beam |
| draw 379 | Both feet fixed at grade | rigid | 339.44 | 344.12 | +1.38% | right-front-leg-3 | splay 5.4°, beam height 67.50, burial 36.94, crossbar height 40.80, beam length 154.06, 4x8 legs, 3-ply 2x4 beam |
| draw 314 | Both feet fixed at grade | rigid | 357.99 | 363.74 | +1.60% | left-front-leg-3 | splay 9.8°, beam height 71.94, burial 24.00, crossbar height 56.44, beam length 154.58, 4x8 legs, 3-ply 2x4 beam |
| draw 188 | Both feet fixed at grade | rigid | 367.81 | 374.19 | +1.73% | right-front-leg-3 | splay 15.4°, beam height 129.76, burial 11.44, crossbar height 116.62, beam length 215.73, 4x4 legs, 2-ply 2x4 beam |
| draw 367 | Both feet fixed at grade | rigid | 342.11 | 348.17 | +1.77% | right-back-leg-3 | splay 5.5°, beam height 73.05, burial 30.01, crossbar height 52.69, beam length 160.96, 4x8 legs, 4x4 beam |
| draw 652 | Both feet fixed at grade | rigid | 391.29 | 398.83 | +1.93% | left-back-leg-3 | splay 17.6°, beam height 117.31, burial 37.39, crossbar height 88.25, beam length 155.35, 4x6 legs, 4x4 beam |
| draw 6 | Both feet fixed at grade | rigid | 379.01 | 386.63 | +2.01% | right-back-leg-3 | splay 18.9°, beam height 134.11, burial 15.50, crossbar height 65.45, beam length 232.71, 4x6 legs, 2-ply 2x4 beam |
| draw 389 | Both feet fixed at grade | rigid | 357.30 | 364.89 | +2.12% | right-back-leg-3 | splay 13.4°, beam height 117.81, burial 35.01, crossbar height 76.16, beam length 163.45, 4x8 legs, 2-ply 2x4 beam |
| draw 659 | Both feet fixed at grade | rigid | 385.16 | 393.37 | +2.13% | left-back-leg-3 | splay 9.5°, beam height 87.00, burial 19.06, crossbar height 18.44, beam length 213.50, 4x8 legs, 4x8 beam |
| draw 165 | Both feet fixed at grade | rigid | 370.54 | 378.44 | +2.13% | left-front-leg-3 | splay 13.4°, beam height 122.43, burial 44.69, crossbar height 101.14, beam length 172.63, 4x6 legs, 2-ply 2x4 beam |
| draw 644 | Both feet fixed at grade | rigid | 363.88 | 371.82 | +2.18% | left-front-leg-3 | splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam |
| draw 502 | Both feet fixed at grade | rigid | 340.51 | 348.77 | +2.43% | left-back-leg-3 | splay 11.1°, beam height 74.94, burial 28.63, crossbar height 17.13, beam length 179.88, 4x6 legs, 4x8 beam |
| draw 509 | Both feet fixed at grade | rigid | 383.39 | 393.46 | +2.63% | left-front-leg-3 | splay 5.7°, beam height 70.53, burial 33.30, crossbar height 18.19, beam length 192.19, 4x8 legs, 2-ply 2x6 beam |
| draw 440 | Both feet fixed at grade | rigid | 388.98 | 400.50 | +2.96% | right-front-leg-3 | splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x4 beam |
| draw 461 | Both feet fixed at grade | rigid | 372.61 | 405.36 | +8.79% | left-back-leg-3 | splay 7.8°, beam height 68.15, burial 41.72, crossbar height 16.13, beam length 204.91, 4x8 legs, 4x4 beam |

### The push against #468's P

Core's P is the load at the bottom of the arc and leaves out the push toward the front and back. Here the frame's value is the largest compression in a leg's lowest member when pushed toward the front or the back, where a foot lifts most, against the same P. No tolerance applies: this is a load core does not compute. 972 comparisons in 243 instances.

| Feet | Joints | Supports | Comparisons | Smallest | Median | Largest |
|---|---|---|---|---|---|---|
| Buried | pinned | Both feet fixed at grade | 362 | -38.08% | +12.80% | +215.56% |
| Buried | rigid | Both feet fixed at grade | 362 | -42.15% | +12.58% | +231.22% |
| On pads | rigid | Both feet pinned on their pads | 124 | -38.59% | +26.86% | +201.87% |
| On pads | rigid | The lifting back feet released | 62 | -29.17% | +31.67% | +208.43% |
| On pads | rigid | The lifting front feet released | 62 | -28.16% | +34.07% | +203.26% |

Each instance's largest, with where it is largest by parameter, is under "A leg's load when pushed" below.

### Foot uplift against #467

248 comparisons in 62 instances on pads; 2 differ by more than the tolerance.

Frame minus core: smallest -3.491 lb, median 0.000 lb, largest 3.491 lb.

Every comparison over the tolerance:

| Instance | Foot | Joints | Core (lb) | Frame (lb) | Difference (lb) | Where |
|---|---|---|---|---|---|---|
| draw 239 | right frame, back foot | rigid | 309.17 | 305.94 | -3.23 | splay 10.0°, beam height 76.69, burial 0.00, crossbar height 58.00, beam length 213.50, 4x4 legs, 4x6 beam |
| draw 617 | left frame, front foot | rigid | 110.95 | 109.70 | -1.25 | splay 24.4°, beam height 118.69, burial 0.00, crossbar height 103.42, beam length 124.69, 4x4 legs, 2-ply 2x4 beam |

## Where each result is largest

### Sway along the beam per pound, joints pinned (in/lb)

181 instances. Smallest 0.0007149, median 0.004839, largest 0.02293.

Largest five:

- 0.02293: draw 520 (splay 31.3°, beam height 138.79, burial 1.27, crossbar height 58.44, beam length 193.39, 4x4 legs, 2-ply 2x4 beam)
- 0.02169: draw 125 (splay 31.9°, beam height 134.37, burial 21.13, crossbar height 87.27, beam length 219.00, 4x4 legs, 3-ply 2x6 beam)
- 0.02069: draw 757 (splay 27.3°, beam height 138.09, burial 45.91, crossbar height 87.75, beam length 171.25, 4x4 legs, 4x8 beam)
- 0.02049: draw 163 (splay 34.5°, beam height 129.27, burial 20.44, crossbar height 16.63, beam length 172.98, 4x4 legs, 4x4 beam)
- 0.01996: draw 133 (splay 21.3°, beam height 142.31, burial 10.25, crossbar height 90.88, beam length 189.31, 4x4 legs, 4x8 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 0.003817 | 0.01294 |
| Splay | 13.6 to 21.6 ° | 45 | 0.004524 | 0.01996 |
| Splay | 21.7 to 27.6 ° | 45 | 0.00512 | 0.02069 |
| Splay | 27.7 to 35.0 ° | 46 | 0.005757 | 0.02293 |
| Beam height | 60.1 to 77.1 in | 45 | 0.001677 | 0.004666 |
| Beam height | 77.9 to 100.2 in | 45 | 0.003129 | 0.007092 |
| Beam height | 100.5 to 120.3 in | 45 | 0.005599 | 0.0128 |
| Beam height | 120.3 to 142.3 in | 46 | 0.01164 | 0.02293 |
| Burial depth | 0.6 to 12.9 in | 45 | 0.00512 | 0.02293 |
| Burial depth | 13.4 to 24.0 in | 45 | 0.004659 | 0.02169 |
| Burial depth | 24.1 to 35.1 in | 45 | 0.004144 | 0.01487 |
| Burial depth | 35.1 to 47.8 in | 46 | 0.004967 | 0.02069 |
| Crossbar height | 12.8 to 33.8 in | 45 | 0.002591 | 0.02049 |
| Crossbar height | 33.9 to 49.3 in | 45 | 0.003817 | 0.01685 |
| Crossbar height | 49.9 to 68.7 in | 45 | 0.004144 | 0.02293 |
| Crossbar height | 68.7 to 122.9 in | 46 | 0.006955 | 0.02169 |

### Sway along the beam per pound, joints rigid (in/lb)

243 instances. Smallest 0.0002898, median 0.002079, largest 0.02708.

Largest five:

- 0.02708: draw 287 (splay 18.7°, beam height 136.19, burial 0.00, crossbar height 120.88, beam length 215.75, 4x6 legs, 4x4 beam)
- 0.02694: draw 676 (splay 7.8°, beam height 136.00, burial 0.00, crossbar height 92.38, beam length 154.32, 4x4 legs, 2-ply 2x4 beam)
- 0.02575: draw 696 (splay 22.8°, beam height 136.95, burial 0.00, crossbar height 71.38, beam length 158.38, 4x8 legs, 2-ply 2x4 beam)
- 0.02183: draw 299 (splay 34.8°, beam height 99.56, burial 0.00, crossbar height 82.44, beam length 235.29, 4x4 legs, 2-ply 2x4 beam)
- 0.02047: draw 617 (splay 24.4°, beam height 118.69, burial 0.00, crossbar height 103.42, beam length 124.69, 4x4 legs, 2-ply 2x4 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | 0.001852 | 0.02694 |
| Splay | 13.6 to 21.2 ° | 61 | 0.002053 | 0.02708 |
| Splay | 21.3 to 27.6 ° | 61 | 0.002079 | 0.02575 |
| Splay | 27.7 to 35.0 ° | 61 | 0.002701 | 0.02183 |
| Beam height | 60.1 to 77.9 in | 60 | 0.0007649 | 0.005057 |
| Beam height | 78.0 to 99.9 in | 61 | 0.001641 | 0.02183 |
| Beam height | 100.0 to 117.9 in | 61 | 0.002688 | 0.01661 |
| Beam height | 118.3 to 142.3 in | 61 | 0.004932 | 0.02708 |
| Burial depth | 0.0 to 0.0 in | 60 | 0.006656 | 0.02708 |
| Burial depth | 0.0 to 18.0 in | 61 | 0.001841 | 0.01071 |
| Burial depth | 18.1 to 32.7 in | 61 | 0.001641 | 0.00742 |
| Burial depth | 32.8 to 47.8 in | 61 | 0.001545 | 0.005692 |
| Crossbar height | 12.3 to 32.3 in | 60 | 0.00157 | 0.01661 |
| Crossbar height | 33.3 to 49.9 in | 61 | 0.001769 | 0.01299 |
| Crossbar height | 50.1 to 68.7 in | 61 | 0.00192 | 0.01202 |
| Crossbar height | 69.8 to 122.9 in | 61 | 0.003835 | 0.02708 |

### Spread of sway: pinned over rigid (times)

181 instances. Smallest 1.36, median 2.82, largest 4.13.

Largest five:

- 4.13: draw 85 (splay 24.4°, beam height 106.50, burial 44.26, crossbar height 53.63, beam length 130.09, 4x4 legs, 4x8 beam)
- 4.07: draw 672 (splay 21.2°, beam height 67.00, burial 2.69, crossbar height 47.98, beam length 143.23, 4x4 legs, 4x8 beam)
- 4.04: draw 757 (splay 27.3°, beam height 138.09, burial 45.91, crossbar height 87.75, beam length 171.25, 4x4 legs, 4x8 beam)
- 3.97: draw 760 (splay 15.8°, beam height 75.06, burial 29.31, crossbar height 45.56, beam length 169.48, 4x4 legs, 4x8 beam)
- 3.95: draw 231 (splay 24.6°, beam height 116.44, burial 30.69, crossbar height 73.13, beam length 138.65, 4x4 legs, 3-ply 2x8 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 2.08 | 3.94 |
| Splay | 13.6 to 21.6 ° | 45 | 2.83 | 4.07 |
| Splay | 21.7 to 27.6 ° | 45 | 2.96 | 4.13 |
| Splay | 27.7 to 35.0 ° | 46 | 3.07 | 3.95 |
| Beam height | 60.1 to 77.1 in | 45 | 2.50 | 4.07 |
| Beam height | 77.9 to 100.2 in | 45 | 3.00 | 3.82 |
| Beam height | 100.5 to 120.3 in | 45 | 2.90 | 4.13 |
| Beam height | 120.3 to 142.3 in | 46 | 2.76 | 4.04 |
| Burial depth | 0.6 to 12.9 in | 45 | 2.84 | 4.07 |
| Burial depth | 13.4 to 24.0 in | 45 | 2.77 | 3.94 |
| Burial depth | 24.1 to 35.1 in | 45 | 2.88 | 3.97 |
| Burial depth | 35.1 to 47.8 in | 46 | 2.78 | 4.13 |
| Crossbar height | 12.8 to 33.8 in | 45 | 2.77 | 3.80 |
| Crossbar height | 33.9 to 49.3 in | 45 | 2.71 | 4.07 |
| Crossbar height | 49.9 to 68.7 in | 45 | 2.73 | 4.13 |
| Crossbar height | 68.7 to 122.9 in | 46 | 3.07 | 4.04 |

### Largest axial compression in a member, joints pinned (lb)

181 instances. Smallest 355.4, median 421.7, largest 1,059.2.

Largest five:

- 1,059.2: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-front-leg-3, Pushed toward the front, where the back foot lifts most (φ = 40.61°); Both feet fixed at grade
- 1,020.7: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-front-leg-3, Pushed toward the front, where the back foot lifts most (φ = 40.69°); Both feet fixed at grade
- 1,010.0: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-front-leg-2, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 1,003.4: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-back-leg-3, Pushed toward the back, where the front foot lifts most (φ = 40.62°); Both feet fixed at grade
- 980.1: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x6 legs, 2-ply 2x4 beam); at right-front-leg-3, Pushed toward the front, where the back foot lifts most (φ = 41.10°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 666.8 | 1,059.2 |
| Splay | 13.6 to 21.6 ° | 45 | 507.7 | 615.3 |
| Splay | 21.7 to 27.6 ° | 45 | 385.7 | 453.1 |
| Splay | 27.7 to 35.0 ° | 46 | 403.3 | 454.2 |
| Beam height | 60.1 to 77.1 in | 45 | 402.1 | 952.9 |
| Beam height | 77.9 to 100.2 in | 45 | 420.4 | 739.3 |
| Beam height | 100.5 to 120.3 in | 45 | 445.9 | 1,059.2 |
| Beam height | 120.3 to 142.3 in | 46 | 432.6 | 1,020.7 |
| Burial depth | 0.6 to 12.9 in | 45 | 428.1 | 1,059.2 |
| Burial depth | 13.4 to 24.0 in | 45 | 424.9 | 1,020.7 |
| Burial depth | 24.1 to 35.1 in | 45 | 452.6 | 1,010.0 |
| Burial depth | 35.1 to 47.8 in | 46 | 410.8 | 879.0 |
| Crossbar height | 12.8 to 33.8 in | 45 | 451.4 | 1,059.2 |
| Crossbar height | 33.9 to 49.3 in | 45 | 417.6 | 980.1 |
| Crossbar height | 49.9 to 68.7 in | 45 | 411.9 | 913.9 |
| Crossbar height | 68.7 to 122.9 in | 46 | 449.5 | 1,020.7 |

### Largest axial tension in a member, joints pinned (lb)

181 instances. Smallest 81.4, median 229.3, largest 862.8.

Largest five:

- 862.8: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x6 legs, 2-ply 2x4 beam); at right-gusset-front, Pushed toward the back, where the front foot lifts most (φ = 41.08°); Both feet fixed at grade
- 731.4: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-gusset-front, Pushed toward the back, where the front foot lifts most (φ = 40.69°); Both feet fixed at grade
- 717.6: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-front-leg-3, Pushed toward the back, where the front foot lifts most (φ = 40.57°); Both feet fixed at grade
- 703.1: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-gusset-back, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 672.2: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-back-leg-3, Pushed toward the front, where the back foot lifts most (φ = 40.58°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 488.0 | 862.8 |
| Splay | 13.6 to 21.6 ° | 45 | 257.9 | 504.2 |
| Splay | 21.7 to 27.6 ° | 45 | 196.1 | 345.1 |
| Splay | 27.7 to 35.0 ° | 46 | 139.3 | 239.7 |
| Beam height | 60.1 to 77.1 in | 45 | 212.1 | 571.8 |
| Beam height | 77.9 to 100.2 in | 45 | 228.6 | 582.4 |
| Beam height | 100.5 to 120.3 in | 45 | 257.9 | 717.6 |
| Beam height | 120.3 to 142.3 in | 46 | 231.9 | 862.8 |
| Burial depth | 0.6 to 12.9 in | 45 | 229.3 | 717.6 |
| Burial depth | 13.4 to 24.0 in | 45 | 219.4 | 862.8 |
| Burial depth | 24.1 to 35.1 in | 45 | 259.7 | 703.1 |
| Burial depth | 35.1 to 47.8 in | 46 | 216.3 | 666.4 |
| Crossbar height | 12.8 to 33.8 in | 45 | 250.1 | 717.6 |
| Crossbar height | 33.9 to 49.3 in | 45 | 204.8 | 862.8 |
| Crossbar height | 49.9 to 68.7 in | 45 | 224.6 | 670.8 |
| Crossbar height | 68.7 to 122.9 in | 46 | 234.2 | 731.4 |

### Largest bending moment in a member, joints pinned (in-lb)

181 instances. Smallest 12,635, median 30,438, largest 53,037.

Largest five:

- 53,037: draw 36 (splay 34.6°, beam height 136.63, burial 37.38, crossbar height 40.94, beam length 239.06, 4x6 legs, 4x6 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 49,472: draw 766 (splay 27.6°, beam height 67.24, burial 17.25, crossbar height 24.13, beam length 234.50, 4x8 legs, 2-ply 2x8 beam); at beam-5, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 48,597: draw 74 (splay 33.6°, beam height 109.27, burial 6.25, crossbar height 72.81, beam length 236.06, 4x6 legs, 4x6 beam); at beam-4, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 48,275: draw 554 (splay 7.0°, beam height 70.33, burial 1.79, crossbar height 34.50, beam length 220.06, 4x4 legs, 4x6 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 48,225: draw 28 (splay 10.9°, beam height 120.28, burial 20.13, crossbar height 52.06, beam length 234.22, 4x8 legs, 4x6 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 29,878 | 48,275 |
| Splay | 13.6 to 21.6 ° | 45 | 32,278 | 44,275 |
| Splay | 21.7 to 27.6 ° | 45 | 29,998 | 49,472 |
| Splay | 27.7 to 35.0 ° | 46 | 29,910 | 53,037 |
| Beam height | 60.1 to 77.1 in | 45 | 30,438 | 49,472 |
| Beam height | 77.9 to 100.2 in | 45 | 31,163 | 46,932 |
| Beam height | 100.5 to 120.3 in | 45 | 29,383 | 48,597 |
| Beam height | 120.3 to 142.3 in | 46 | 32,771 | 53,037 |
| Burial depth | 0.6 to 12.9 in | 45 | 28,047 | 48,597 |
| Burial depth | 13.4 to 24.0 in | 45 | 32,521 | 49,472 |
| Burial depth | 24.1 to 35.1 in | 45 | 28,913 | 47,894 |
| Burial depth | 35.1 to 47.8 in | 46 | 30,537 | 53,037 |
| Crossbar height | 12.8 to 33.8 in | 45 | 30,806 | 49,472 |
| Crossbar height | 33.9 to 49.3 in | 45 | 32,031 | 53,037 |
| Crossbar height | 49.9 to 68.7 in | 45 | 26,323 | 48,225 |
| Crossbar height | 68.7 to 122.9 in | 46 | 31,157 | 48,597 |

### Largest downward load on a foot, joints pinned (lb)

181 instances. Smallest 311.1, median 374.3, largest 1,047.8.

Largest five:

- 1,047.8: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 40.57°); Both feet fixed at grade
- 1,010.1: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 40.69°); Both feet fixed at grade
- 997.0: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 990.8: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 40.58°); Both feet fixed at grade
- 967.1: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x6 legs, 2-ply 2x4 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 41.08°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 636.2 | 1,047.8 |
| Splay | 13.6 to 21.6 ° | 45 | 477.0 | 583.3 |
| Splay | 21.7 to 27.6 ° | 45 | 347.3 | 413.3 |
| Splay | 27.7 to 35.0 ° | 46 | 344.8 | 380.4 |
| Beam height | 60.1 to 77.1 in | 45 | 360.6 | 937.9 |
| Beam height | 77.9 to 100.2 in | 45 | 372.6 | 727.2 |
| Beam height | 100.5 to 120.3 in | 45 | 391.3 | 1,047.8 |
| Beam height | 120.3 to 142.3 in | 46 | 388.3 | 1,010.1 |
| Burial depth | 0.6 to 12.9 in | 45 | 372.2 | 1,047.8 |
| Burial depth | 13.4 to 24.0 in | 45 | 380.4 | 1,010.1 |
| Burial depth | 24.1 to 35.1 in | 45 | 417.2 | 997.0 |
| Burial depth | 35.1 to 47.8 in | 46 | 354.9 | 866.0 |
| Crossbar height | 12.8 to 33.8 in | 45 | 404.9 | 1,047.8 |
| Crossbar height | 33.9 to 49.3 in | 45 | 362.9 | 967.1 |
| Crossbar height | 49.9 to 68.7 in | 45 | 365.5 | 902.2 |
| Crossbar height | 68.7 to 122.9 in | 46 | 402.4 | 1,010.1 |

### Largest pull on a foot, joints pinned (lb)

181 instances. Smallest 27.5, median 121.2, largest 707.7.

Largest five:

- 707.7: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 40.61°); Both feet fixed at grade
- 661.1: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-front-foot, Pushed toward the back, where the front foot lifts most (φ = 40.62°); Both feet fixed at grade
- 642.3: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-front-foot, Pushed toward the back, where the front foot lifts most (φ = 41.19°); Both feet fixed at grade
- 639.2: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 40.69°); Both feet fixed at grade
- 615.3: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x6 legs, 2-ply 2x4 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 41.10°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 304.3 | 707.7 |
| Splay | 13.6 to 21.6 ° | 45 | 183.2 | 281.3 |
| Splay | 21.7 to 27.6 ° | 45 | 94.2 | 140.5 |
| Splay | 27.7 to 35.0 ° | 46 | 48.8 | 101.2 |
| Beam height | 60.1 to 77.1 in | 45 | 114.6 | 558.8 |
| Beam height | 77.9 to 100.2 in | 45 | 110.5 | 426.7 |
| Beam height | 100.5 to 120.3 in | 45 | 139.3 | 707.7 |
| Beam height | 120.3 to 142.3 in | 46 | 137.3 | 661.1 |
| Burial depth | 0.6 to 12.9 in | 45 | 124.9 | 707.7 |
| Burial depth | 13.4 to 24.0 in | 45 | 126.6 | 661.1 |
| Burial depth | 24.1 to 35.1 in | 45 | 148.3 | 642.3 |
| Burial depth | 35.1 to 47.8 in | 46 | 95.2 | 511.9 |
| Crossbar height | 12.8 to 33.8 in | 45 | 144.4 | 707.7 |
| Crossbar height | 33.9 to 49.3 in | 45 | 100.0 | 615.3 |
| Crossbar height | 49.9 to 68.7 in | 45 | 100.3 | 540.1 |
| Crossbar height | 68.7 to 122.9 in | 46 | 139.0 | 642.3 |

### Largest horizontal force on a foot, joints pinned (lb)

181 instances. Smallest 147.9, median 178.3, largest 257.2.

Largest five:

- 257.2: draw 343 (splay 13.6°, beam height 88.50, burial 24.89, crossbar height 25.69, beam length 234.37, 4x8 legs, 2-ply 2x4 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.85°); Both feet fixed at grade
- 256.4: draw 163 (splay 34.5°, beam height 129.27, burial 20.44, crossbar height 16.63, beam length 172.98, 4x4 legs, 4x4 beam); at left-back-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 252.8: draw 633 (splay 34.7°, beam height 104.38, burial 41.63, crossbar height 82.71, beam length 175.19, 4x8 legs, 4x4 beam); at right-back-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 243.4: draw 156 (splay 32.9°, beam height 97.69, burial 21.26, crossbar height 18.69, beam length 152.34, 4x6 legs, 3-ply 2x6 beam); at left-front-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 242.6: draw 764 (splay 33.3°, beam height 98.01, burial 5.88, crossbar height 40.09, beam length 196.95, 4x6 legs, 4x6 beam); at left-back-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 168.8 | 220.1 |
| Splay | 13.6 to 21.6 ° | 45 | 177.0 | 257.2 |
| Splay | 21.7 to 27.6 ° | 45 | 175.0 | 207.0 |
| Splay | 27.7 to 35.0 ° | 46 | 210.5 | 256.4 |
| Beam height | 60.1 to 77.1 in | 45 | 181.6 | 239.9 |
| Beam height | 77.9 to 100.2 in | 45 | 177.5 | 257.2 |
| Beam height | 100.5 to 120.3 in | 45 | 175.1 | 252.8 |
| Beam height | 120.3 to 142.3 in | 46 | 177.0 | 256.4 |
| Burial depth | 0.6 to 12.9 in | 45 | 175.1 | 242.6 |
| Burial depth | 13.4 to 24.0 in | 45 | 181.5 | 256.4 |
| Burial depth | 24.1 to 35.1 in | 45 | 174.7 | 257.2 |
| Burial depth | 35.1 to 47.8 in | 46 | 179.4 | 252.8 |
| Crossbar height | 12.8 to 33.8 in | 45 | 188.8 | 257.2 |
| Crossbar height | 33.9 to 49.3 in | 45 | 178.2 | 242.6 |
| Crossbar height | 49.9 to 68.7 in | 45 | 175.0 | 220.3 |
| Crossbar height | 68.7 to 122.9 in | 46 | 173.9 | 252.8 |

### Largest moment at a buried foot, joints pinned (in-lb)

181 instances. Smallest 412, median 1,932, largest 22,800.

Largest five:

- 22,800: draw 343 (splay 13.6°, beam height 88.50, burial 24.89, crossbar height 25.69, beam length 234.37, 4x8 legs, 2-ply 2x4 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 44.80°); Both feet fixed at grade
- 13,670: draw 509 (splay 5.7°, beam height 70.53, burial 33.30, crossbar height 18.19, beam length 192.19, 4x8 legs, 2-ply 2x6 beam); at left-front-foot, Pushed toward the back, where the front foot lifts most (φ = 41.64°); Both feet fixed at grade
- 11,815: draw 702 (splay 23.2°, beam height 74.33, burial 33.44, crossbar height 56.30, beam length 219.79, 4x8 legs, 2-ply 2x6 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 49.30°); Both feet fixed at grade
- 10,572: draw 766 (splay 27.6°, beam height 67.24, burial 17.25, crossbar height 24.13, beam length 234.50, 4x8 legs, 2-ply 2x8 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 51.45°); Both feet fixed at grade
- 9,202: draw 50 (splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x8 legs, 3-ply 2x4 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 44.21°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 3,280 | 13,670 |
| Splay | 13.6 to 21.6 ° | 45 | 2,134 | 22,800 |
| Splay | 21.7 to 27.6 ° | 45 | 1,165 | 11,815 |
| Splay | 27.7 to 35.0 ° | 46 | 983 | 6,223 |
| Beam height | 60.1 to 77.1 in | 45 | 2,285 | 13,670 |
| Beam height | 77.9 to 100.2 in | 45 | 2,186 | 22,800 |
| Beam height | 100.5 to 120.3 in | 45 | 1,465 | 6,085 |
| Beam height | 120.3 to 142.3 in | 46 | 1,339 | 5,651 |
| Burial depth | 0.6 to 12.9 in | 45 | 1,932 | 7,041 |
| Burial depth | 13.4 to 24.0 in | 45 | 2,254 | 10,572 |
| Burial depth | 24.1 to 35.1 in | 45 | 2,271 | 22,800 |
| Burial depth | 35.1 to 47.8 in | 46 | 1,210 | 9,202 |
| Crossbar height | 12.8 to 33.8 in | 45 | 2,586 | 22,800 |
| Crossbar height | 33.9 to 49.3 in | 45 | 1,885 | 6,615 |
| Crossbar height | 49.9 to 68.7 in | 45 | 1,936 | 11,815 |
| Crossbar height | 68.7 to 122.9 in | 46 | 1,374 | 9,202 |

### Largest axial compression in a member, joints rigid (lb)

243 instances. Smallest 562.3, median 1,804.4, largest 6,116.0.

Largest five:

- 6,116.0: draw 475 (splay 10.4°, beam height 131.00, burial 14.63, crossbar height 110.02, beam length 218.76, 4x4 legs, 2-ply 2x4 beam); at left-back-leg-1, Pushed toward the back, where the front foot lifts most (φ = 42.58°); Both feet fixed at grade
- 4,772.3: draw 188 (splay 15.4°, beam height 129.76, burial 11.44, crossbar height 116.62, beam length 215.73, 4x4 legs, 2-ply 2x4 beam); at right-back-leg-1, Pushed toward the back, where the front foot lifts most (φ = 44.85°); Both feet fixed at grade
- 4,419.4: draw 718 (splay 20.7°, beam height 105.13, burial 0.00, crossbar height 85.31, beam length 234.06, 4x8 legs, 2-ply 2x6 beam); at left-front-leg-1, Pushed toward the front, where the back foot lifts most (φ = 47.81°); The lifting back feet released
- 4,042.6: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x6 legs, 2-ply 2x4 beam); at right-front-leg-1, Pushed toward the front, where the back foot lifts most (φ = 41.73°); Both feet fixed at grade
- 3,947.1: draw 443 (splay 8.6°, beam height 65.05, burial 0.00, crossbar height 12.31, beam length 218.13, 4x8 legs, 2-ply 2x8 beam); at left-back-leg-1, Pushed toward the back, where the front foot lifts most (φ = 43.23°); The lifting front feet released

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | 2,166.2 | 6,116.0 |
| Splay | 13.6 to 21.2 ° | 61 | 2,023.9 | 4,772.3 |
| Splay | 21.3 to 27.6 ° | 61 | 1,588.9 | 3,239.9 |
| Splay | 27.7 to 35.0 ° | 61 | 1,468.5 | 3,143.2 |
| Beam height | 60.1 to 77.9 in | 60 | 1,806.6 | 3,947.1 |
| Beam height | 78.0 to 99.9 in | 61 | 1,865.8 | 4,042.6 |
| Beam height | 100.0 to 117.9 in | 61 | 1,440.8 | 4,419.4 |
| Beam height | 118.3 to 142.3 in | 61 | 1,927.8 | 6,116.0 |
| Burial depth | 0.0 to 0.0 in | 60 | 1,707.9 | 4,419.4 |
| Burial depth | 0.0 to 18.0 in | 61 | 1,823.6 | 6,116.0 |
| Burial depth | 18.1 to 32.7 in | 61 | 1,956.9 | 3,823.8 |
| Burial depth | 32.8 to 47.8 in | 61 | 1,755.2 | 3,704.6 |
| Crossbar height | 12.3 to 32.3 in | 60 | 1,855.3 | 3,947.1 |
| Crossbar height | 33.3 to 49.9 in | 61 | 1,829.1 | 3,827.1 |
| Crossbar height | 50.1 to 68.7 in | 61 | 1,660.4 | 4,042.6 |
| Crossbar height | 69.8 to 122.9 in | 61 | 1,889.6 | 6,116.0 |

### Largest axial tension in a member, joints rigid (lb)

243 instances. Smallest 168.3, median 591.4, largest 2,566.8.

Largest five:

- 2,566.8: draw 475 (splay 10.4°, beam height 131.00, burial 14.63, crossbar height 110.02, beam length 218.76, 4x4 legs, 2-ply 2x4 beam); at left-front-leg-1, Pushed toward the back, where the front foot lifts most (φ = 42.58°); Both feet fixed at grade
- 1,971.3: draw 188 (splay 15.4°, beam height 129.76, burial 11.44, crossbar height 116.62, beam length 215.73, 4x4 legs, 2-ply 2x4 beam); at right-back-leg-1, Pushed toward the front, where the back foot lifts most (φ = 44.83°); Both feet fixed at grade
- 1,881.0: draw 718 (splay 20.7°, beam height 105.13, burial 0.00, crossbar height 85.31, beam length 234.06, 4x8 legs, 2-ply 2x6 beam); at left-front-leg-1, Pushed toward the back, where the front foot lifts most (φ = 47.75°); Both feet pinned on their pads
- 1,876.4: draw 35 (splay 14.3°, beam height 135.50, burial 47.76, crossbar height 122.88, beam length 193.63, 4x4 legs, 2-ply 2x8 beam); at left-back-leg-1, Pushed toward the front, where the back foot lifts most (φ = 44.29°); Both feet fixed at grade
- 1,560.2: draw 591 (splay 20.9°, beam height 102.09, burial 21.88, crossbar height 45.79, beam length 238.86, 4x6 legs, 2-ply 2x6 beam); at left-front-leg-1, Pushed toward the back, where the front foot lifts most (φ = 47.65°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | 687.9 | 2,566.8 |
| Splay | 13.6 to 21.2 ° | 61 | 698.8 | 1,971.3 |
| Splay | 21.3 to 27.6 ° | 61 | 517.2 | 1,524.2 |
| Splay | 27.7 to 35.0 ° | 61 | 591.4 | 1,367.6 |
| Beam height | 60.1 to 77.9 in | 60 | 554.2 | 1,542.8 |
| Beam height | 78.0 to 99.9 in | 61 | 731.5 | 1,481.1 |
| Beam height | 100.0 to 117.9 in | 61 | 516.8 | 1,881.0 |
| Beam height | 118.3 to 142.3 in | 61 | 688.7 | 2,566.8 |
| Burial depth | 0.0 to 0.0 in | 60 | 545.2 | 1,881.0 |
| Burial depth | 0.0 to 18.0 in | 61 | 655.4 | 2,566.8 |
| Burial depth | 18.1 to 32.7 in | 61 | 585.3 | 1,560.2 |
| Burial depth | 32.8 to 47.8 in | 61 | 576.6 | 1,876.4 |
| Crossbar height | 12.3 to 32.3 in | 60 | 676.7 | 1,461.0 |
| Crossbar height | 33.3 to 49.9 in | 61 | 546.2 | 1,560.2 |
| Crossbar height | 50.1 to 68.7 in | 61 | 585.3 | 1,542.8 |
| Crossbar height | 69.8 to 122.9 in | 61 | 595.6 | 2,566.8 |

### Largest bending moment in a member, joints rigid (in-lb)

243 instances. Smallest 6,554, median 18,236, largest 37,694.

Largest five:

- 37,694: draw 399 (splay 17.8°, beam height 84.64, burial 0.00, crossbar height 58.25, beam length 230.05, 4x4 legs, 4x8 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet pinned on their pads
- 33,939: draw 597 (splay 29.1°, beam height 102.38, burial 0.00, crossbar height 78.95, beam length 225.25, 4x8 legs, 4x8 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet pinned on their pads
- 33,707: draw 36 (splay 34.6°, beam height 136.63, burial 37.38, crossbar height 40.94, beam length 239.06, 4x6 legs, 4x6 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 33,477: draw 134 (splay 25.6°, beam height 82.74, burial 0.00, crossbar height 62.13, beam length 196.13, 4x6 legs, 4x8 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet pinned on their pads
- 33,104: draw 680 (splay 15.0°, beam height 122.23, burial 0.00, crossbar height 62.73, beam length 227.56, 4x6 legs, 3-ply 2x8 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet pinned on their pads

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | 18,185 | 29,096 |
| Splay | 13.6 to 21.2 ° | 61 | 18,236 | 37,694 |
| Splay | 21.3 to 27.6 ° | 61 | 19,449 | 33,477 |
| Splay | 27.7 to 35.0 ° | 61 | 18,232 | 33,939 |
| Beam height | 60.1 to 77.9 in | 60 | 17,699 | 32,133 |
| Beam height | 78.0 to 99.9 in | 61 | 19,557 | 37,694 |
| Beam height | 100.0 to 117.9 in | 61 | 18,243 | 33,939 |
| Beam height | 118.3 to 142.3 in | 61 | 19,947 | 33,707 |
| Burial depth | 0.0 to 0.0 in | 60 | 18,639 | 37,694 |
| Burial depth | 0.0 to 18.0 in | 61 | 18,236 | 30,027 |
| Burial depth | 18.1 to 32.7 in | 61 | 18,162 | 32,133 |
| Burial depth | 32.8 to 47.8 in | 61 | 18,928 | 33,707 |
| Crossbar height | 12.3 to 32.3 in | 60 | 17,735 | 30,027 |
| Crossbar height | 33.3 to 49.9 in | 61 | 18,243 | 33,707 |
| Crossbar height | 50.1 to 68.7 in | 61 | 18,928 | 37,694 |
| Crossbar height | 69.8 to 122.9 in | 61 | 18,286 | 33,939 |

### Largest downward load on a foot, joints rigid (lb)

243 instances. Smallest 312.4, median 386.2, largest 1,101.0.

Largest five:

- 1,101.0: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 40.61°); Both feet fixed at grade
- 1,046.1: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 40.69°); Both feet fixed at grade
- 1,021.0: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 1,013.5: draw 534 (splay 6.9°, beam height 110.75, burial 0.00, crossbar height 49.44, beam length 208.69, 4x8 legs, 3-ply 2x4 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 41.70°); Both feet pinned on their pads
- 1,012.7: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 40.62°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | 689.9 | 1,101.0 |
| Splay | 13.6 to 21.2 ° | 61 | 488.3 | 626.2 |
| Splay | 21.3 to 27.6 ° | 61 | 355.2 | 448.2 |
| Splay | 27.7 to 35.0 ° | 61 | 347.1 | 384.0 |
| Beam height | 60.1 to 77.9 in | 60 | 372.1 | 976.2 |
| Beam height | 78.0 to 99.9 in | 61 | 384.0 | 906.2 |
| Beam height | 100.0 to 117.9 in | 61 | 388.7 | 1,101.0 |
| Beam height | 118.3 to 142.3 in | 61 | 404.3 | 1,046.1 |
| Burial depth | 0.0 to 0.0 in | 60 | 421.1 | 1,013.5 |
| Burial depth | 0.0 to 18.0 in | 61 | 386.2 | 1,101.0 |
| Burial depth | 18.1 to 32.7 in | 61 | 388.7 | 1,046.1 |
| Burial depth | 32.8 to 47.8 in | 61 | 367.4 | 930.0 |
| Crossbar height | 12.3 to 32.3 in | 60 | 395.8 | 1,012.7 |
| Crossbar height | 33.3 to 49.9 in | 61 | 381.4 | 1,101.0 |
| Crossbar height | 50.1 to 68.7 in | 61 | 375.8 | 930.0 |
| Crossbar height | 69.8 to 122.9 in | 61 | 409.0 | 1,046.1 |

### Largest pull on a foot, joints rigid (lb)

243 instances. Smallest 29.4, median 133.4, largest 760.0.

Largest five:

- 760.0: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 40.61°); Both feet fixed at grade
- 684.7: draw 676 (splay 7.8°, beam height 136.00, burial 0.00, crossbar height 92.38, beam length 154.32, 4x4 legs, 2-ply 2x4 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 41.36°); The lifting back feet released
- 682.2: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-front-foot, Pushed toward the back, where the front foot lifts most (φ = 40.62°); Both feet fixed at grade
- 674.4: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 40.69°); Both feet fixed at grade
- 660.5: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-front-foot, Pushed toward the back, where the front foot lifts most (φ = 41.19°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | 372.9 | 760.0 |
| Splay | 13.6 to 21.2 ° | 61 | 202.4 | 300.2 |
| Splay | 21.3 to 27.6 ° | 61 | 101.9 | 162.6 |
| Splay | 27.7 to 35.0 ° | 61 | 51.6 | 105.6 |
| Beam height | 60.1 to 77.9 in | 60 | 121.1 | 641.1 |
| Beam height | 78.0 to 99.9 in | 61 | 131.3 | 572.8 |
| Beam height | 100.0 to 117.9 in | 61 | 132.9 | 760.0 |
| Beam height | 118.3 to 142.3 in | 61 | 151.4 | 684.7 |
| Burial depth | 0.0 to 0.0 in | 60 | 168.4 | 684.7 |
| Burial depth | 0.0 to 18.0 in | 61 | 132.0 | 760.0 |
| Burial depth | 18.1 to 32.7 in | 61 | 133.4 | 682.2 |
| Burial depth | 32.8 to 47.8 in | 61 | 109.4 | 567.1 |
| Crossbar height | 12.3 to 32.3 in | 60 | 136.9 | 682.2 |
| Crossbar height | 33.3 to 49.9 in | 61 | 129.5 | 760.0 |
| Crossbar height | 50.1 to 68.7 in | 61 | 109.4 | 567.1 |
| Crossbar height | 69.8 to 122.9 in | 61 | 151.4 | 684.7 |

### Largest horizontal force on a foot, joints rigid (lb)

243 instances. Smallest 158.1, median 226.1, largest 467.3.

Largest five:

- 467.3: draw 443 (splay 8.6°, beam height 65.05, burial 0.00, crossbar height 12.31, beam length 218.13, 4x8 legs, 2-ply 2x8 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 43.23°); The lifting front feet released
- 402.7: draw 461 (splay 7.8°, beam height 68.15, burial 41.72, crossbar height 16.13, beam length 204.91, 4x8 legs, 4x4 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 42.84°); Both feet fixed at grade
- 402.6: draw 509 (splay 5.7°, beam height 70.53, burial 33.30, crossbar height 18.19, beam length 192.19, 4x8 legs, 2-ply 2x6 beam); at left-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.75°); Both feet fixed at grade
- 380.3: draw 343 (splay 13.6°, beam height 88.50, burial 24.89, crossbar height 25.69, beam length 234.37, 4x8 legs, 2-ply 2x4 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.85°); Both feet fixed at grade
- 376.2: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x4 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.94°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | 253.9 | 467.3 |
| Splay | 13.6 to 21.2 ° | 61 | 241.2 | 376.2 |
| Splay | 21.3 to 27.6 ° | 61 | 209.2 | 303.9 |
| Splay | 27.7 to 35.0 ° | 61 | 218.8 | 279.7 |
| Beam height | 60.1 to 77.9 in | 60 | 245.3 | 467.3 |
| Beam height | 78.0 to 99.9 in | 61 | 239.3 | 380.3 |
| Beam height | 100.0 to 117.9 in | 61 | 216.7 | 315.5 |
| Beam height | 118.3 to 142.3 in | 61 | 220.4 | 275.1 |
| Burial depth | 0.0 to 0.0 in | 60 | 252.4 | 467.3 |
| Burial depth | 0.0 to 18.0 in | 61 | 213.0 | 342.0 |
| Burial depth | 18.1 to 32.7 in | 61 | 223.4 | 380.3 |
| Burial depth | 32.8 to 47.8 in | 61 | 217.6 | 402.7 |
| Crossbar height | 12.3 to 32.3 in | 60 | 234.3 | 467.3 |
| Crossbar height | 33.3 to 49.9 in | 61 | 233.2 | 338.0 |
| Crossbar height | 50.1 to 68.7 in | 61 | 221.5 | 342.0 |
| Crossbar height | 69.8 to 122.9 in | 61 | 219.8 | 340.4 |

### Largest moment at a buried foot, joints rigid (in-lb)

181 instances. Smallest 787, median 4,577, largest 11,202.

Largest five:

- 11,202: draw 343 (splay 13.6°, beam height 88.50, burial 24.89, crossbar height 25.69, beam length 234.37, 4x8 legs, 2-ply 2x4 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.85°); Both feet fixed at grade
- 10,793: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x6 legs, 2-ply 2x4 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.73°); Both feet fixed at grade
- 10,489: draw 50 (splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x8 legs, 3-ply 2x4 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.30°); Both feet fixed at grade
- 10,366: draw 475 (splay 10.4°, beam height 131.00, burial 14.63, crossbar height 110.02, beam length 218.76, 4x4 legs, 2-ply 2x4 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 42.58°); Both feet fixed at grade
- 10,145: draw 509 (splay 5.7°, beam height 70.53, burial 33.30, crossbar height 18.19, beam length 192.19, 4x8 legs, 2-ply 2x6 beam); at left-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.75°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | 6,167 | 10,793 |
| Splay | 13.6 to 21.6 ° | 45 | 5,032 | 11,202 |
| Splay | 21.7 to 27.6 ° | 45 | 4,133 | 7,244 |
| Splay | 27.7 to 35.0 ° | 46 | 3,491 | 7,311 |
| Beam height | 60.1 to 77.1 in | 45 | 5,138 | 10,145 |
| Beam height | 77.9 to 100.2 in | 45 | 4,595 | 11,202 |
| Beam height | 100.5 to 120.3 in | 45 | 4,064 | 7,845 |
| Beam height | 120.3 to 142.3 in | 46 | 4,756 | 10,366 |
| Burial depth | 0.6 to 12.9 in | 45 | 4,474 | 10,793 |
| Burial depth | 13.4 to 24.0 in | 45 | 5,491 | 10,366 |
| Burial depth | 24.1 to 35.1 in | 45 | 4,548 | 11,202 |
| Burial depth | 35.1 to 47.8 in | 46 | 4,373 | 10,489 |
| Crossbar height | 12.8 to 33.8 in | 45 | 5,138 | 11,202 |
| Crossbar height | 33.9 to 49.3 in | 45 | 4,570 | 9,807 |
| Crossbar height | 49.9 to 68.7 in | 45 | 4,104 | 10,793 |
| Crossbar height | 68.7 to 122.9 in | 46 | 4,635 | 10,489 |

### Spread of the largest compression: rigid against pinned (of pinned)

181 instances. Smallest +36.50%, median +269.54%, largest +808.14%.

Largest five:

- +808.14%: draw 40 (splay 23.5°, beam height 89.38, burial 21.25, crossbar height 37.61, beam length 210.92, 4x6 legs, 4x4 beam)
- +786.24%: draw 591 (splay 20.9°, beam height 102.09, burial 21.88, crossbar height 45.79, beam length 238.86, 4x6 legs, 2-ply 2x6 beam)
- +729.71%: draw 702 (splay 23.2°, beam height 74.33, burial 33.44, crossbar height 56.30, beam length 219.79, 4x8 legs, 2-ply 2x6 beam)
- +711.59%: draw 475 (splay 10.4°, beam height 131.00, burial 14.63, crossbar height 110.02, beam length 218.76, 4x4 legs, 2-ply 2x4 beam)
- +691.75%: draw 557 (splay 20.0°, beam height 60.05, burial 45.06, crossbar height 43.15, beam length 199.36, 4x8 legs, 4x4 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | +224.70% | +711.59% |
| Splay | 13.6 to 21.6 ° | 45 | +352.95% | +786.24% |
| Splay | 21.7 to 27.6 ° | 45 | +297.15% | +808.14% |
| Splay | 27.7 to 35.0 ° | 46 | +285.51% | +659.30% |
| Beam height | 60.1 to 77.1 in | 45 | +299.67% | +729.71% |
| Beam height | 77.9 to 100.2 in | 45 | +279.91% | +808.14% |
| Beam height | 100.5 to 120.3 in | 45 | +237.00% | +786.24% |
| Beam height | 120.3 to 142.3 in | 46 | +290.99% | +711.59% |
| Burial depth | 0.6 to 12.9 in | 45 | +290.60% | +685.59% |
| Burial depth | 13.4 to 24.0 in | 45 | +299.64% | +808.14% |
| Burial depth | 24.1 to 35.1 in | 45 | +226.24% | +729.71% |
| Burial depth | 35.1 to 47.8 in | 46 | +243.93% | +691.75% |
| Crossbar height | 12.8 to 33.8 in | 45 | +275.39% | +648.23% |
| Crossbar height | 33.9 to 49.3 in | 45 | +270.64% | +808.14% |
| Crossbar height | 49.9 to 68.7 in | 45 | +242.81% | +729.71% |
| Crossbar height | 68.7 to 122.9 in | 46 | +245.95% | +711.59% |

### Spread of the largest bending moment: rigid against pinned (of pinned)

181 instances. Smallest -49.48%, median -39.20%, largest -13.67%.

Largest five:

- -13.67%: draw 231 (splay 24.6°, beam height 116.44, burial 30.69, crossbar height 73.13, beam length 138.65, 4x4 legs, 3-ply 2x8 beam)
- -15.33%: draw 85 (splay 24.4°, beam height 106.50, burial 44.26, crossbar height 53.63, beam length 130.09, 4x4 legs, 4x8 beam)
- -16.00%: draw 757 (splay 27.3°, beam height 138.09, burial 45.91, crossbar height 87.75, beam length 171.25, 4x4 legs, 4x8 beam)
- -16.61%: draw 612 (splay 23.6°, beam height 126.31, burial 31.50, crossbar height 68.70, beam length 178.06, 4x4 legs, 3-ply 2x8 beam)
- -21.39%: draw 133 (splay 21.3°, beam height 142.31, burial 10.25, crossbar height 90.88, beam length 189.31, 4x4 legs, 4x8 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | -39.74% | -22.02% |
| Splay | 13.6 to 21.6 ° | 45 | -40.54% | -21.39% |
| Splay | 21.7 to 27.6 ° | 45 | -39.20% | -13.67% |
| Splay | 27.7 to 35.0 ° | 46 | -38.17% | -21.56% |
| Beam height | 60.1 to 77.1 in | 45 | -38.25% | -27.00% |
| Beam height | 77.9 to 100.2 in | 45 | -38.08% | -24.88% |
| Beam height | 100.5 to 120.3 in | 45 | -39.47% | -13.67% |
| Beam height | 120.3 to 142.3 in | 46 | -40.48% | -16.00% |
| Burial depth | 0.6 to 12.9 in | 45 | -40.54% | -21.39% |
| Burial depth | 13.4 to 24.0 in | 45 | -39.00% | -22.02% |
| Burial depth | 24.1 to 35.1 in | 45 | -39.74% | -13.67% |
| Burial depth | 35.1 to 47.8 in | 46 | -37.23% | -15.33% |
| Crossbar height | 12.8 to 33.8 in | 45 | -41.97% | -23.71% |
| Crossbar height | 33.9 to 49.3 in | 45 | -37.95% | -21.56% |
| Crossbar height | 49.9 to 68.7 in | 45 | -39.74% | -15.33% |
| Crossbar height | 68.7 to 122.9 in | 46 | -38.78% | -13.67% |

### Spread of the largest pull on a foot: rigid against pinned (of pinned)

181 instances. Smallest -11.41%, median +2.88%, largest +95.70%.

Largest five:

- +95.70%: draw 367 (splay 5.5°, beam height 73.05, burial 30.01, crossbar height 52.69, beam length 160.96, 4x8 legs, 4x4 beam)
- +79.55%: draw 314 (splay 9.8°, beam height 71.94, burial 24.00, crossbar height 56.44, beam length 154.58, 4x8 legs, 3-ply 2x4 beam)
- +40.95%: draw 509 (splay 5.7°, beam height 70.53, burial 33.30, crossbar height 18.19, beam length 192.19, 4x8 legs, 2-ply 2x6 beam)
- +32.56%: draw 379 (splay 5.4°, beam height 67.50, burial 36.94, crossbar height 40.80, beam length 154.06, 4x8 legs, 3-ply 2x4 beam)
- +27.12%: draw 448 (splay 8.8°, beam height 106.88, burial 34.30, crossbar height 58.56, beam length 135.88, 4x8 legs, 4x4 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | +4.46% | +95.70% |
| Splay | 13.6 to 21.6 ° | 45 | +1.81% | +14.04% |
| Splay | 21.7 to 27.6 ° | 45 | +2.80% | +24.30% |
| Splay | 27.7 to 35.0 ° | 46 | +3.25% | +26.46% |
| Beam height | 60.1 to 77.1 in | 45 | +4.17% | +95.70% |
| Beam height | 77.9 to 100.2 in | 45 | +2.71% | +23.64% |
| Beam height | 100.5 to 120.3 in | 45 | +2.80% | +27.12% |
| Beam height | 120.3 to 142.3 in | 46 | +2.33% | +7.91% |
| Burial depth | 0.6 to 12.9 in | 45 | +2.70% | +17.22% |
| Burial depth | 13.4 to 24.0 in | 45 | +3.28% | +79.55% |
| Burial depth | 24.1 to 35.1 in | 45 | +2.90% | +95.70% |
| Burial depth | 35.1 to 47.8 in | 46 | +2.51% | +32.56% |
| Crossbar height | 12.8 to 33.8 in | 45 | +3.78% | +40.95% |
| Crossbar height | 33.9 to 49.3 in | 45 | +4.18% | +32.56% |
| Crossbar height | 49.9 to 68.7 in | 45 | +2.48% | +95.70% |
| Crossbar height | 68.7 to 122.9 in | 46 | +1.91% | +23.64% |

### Spread of the largest horizontal force on a foot: rigid against pinned (of pinned)

181 instances. Smallest -24.38%, median +14.73%, largest +131.23%.

Largest five:

- +131.23%: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x6 legs, 2-ply 2x4 beam)
- +105.92%: draw 50 (splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x8 legs, 3-ply 2x4 beam)
- +105.48%: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x4 beam)
- +98.19%: draw 554 (splay 7.0°, beam height 70.33, burial 1.79, crossbar height 34.50, beam length 220.06, 4x4 legs, 4x6 beam)
- +88.24%: draw 461 (splay 7.8°, beam height 68.15, burial 41.72, crossbar height 16.13, beam length 204.91, 4x8 legs, 4x4 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | +36.01% | +131.23% |
| Splay | 13.6 to 21.6 ° | 45 | +17.37% | +105.48% |
| Splay | 21.7 to 27.6 ° | 45 | +11.73% | +63.88% |
| Splay | 27.7 to 35.0 ° | 46 | +3.28% | +43.29% |
| Beam height | 60.1 to 77.1 in | 45 | +30.73% | +105.48% |
| Beam height | 77.9 to 100.2 in | 45 | +17.37% | +131.23% |
| Beam height | 100.5 to 120.3 in | 45 | +9.21% | +54.41% |
| Beam height | 120.3 to 142.3 in | 46 | +8.73% | +70.56% |
| Burial depth | 0.6 to 12.9 in | 45 | +12.24% | +131.23% |
| Burial depth | 13.4 to 24.0 in | 45 | +22.78% | +78.87% |
| Burial depth | 24.1 to 35.1 in | 45 | +16.15% | +105.48% |
| Burial depth | 35.1 to 47.8 in | 46 | +14.64% | +105.92% |
| Crossbar height | 12.8 to 33.8 in | 45 | +22.17% | +105.48% |
| Crossbar height | 33.9 to 49.3 in | 45 | +16.88% | +98.19% |
| Crossbar height | 49.9 to 68.7 in | 45 | +12.50% | +131.23% |
| Crossbar height | 68.7 to 122.9 in | 46 | +11.98% | +105.92% |

### A leg's load when pushed, against #468's P, joints pinned (over P)

181 instances. Smallest -37.45%, median +13.08%, largest +215.56%.

Largest five:

- +215.56%: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-front-leg-3, Pushed toward the front, where the back foot lifts most; Both feet fixed at grade
- +208.75%: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-back-leg-3, Pushed toward the back, where the front foot lifts most; Both feet fixed at grade
- +178.26%: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-front-leg-3, Pushed toward the front, where the back foot lifts most; Both feet fixed at grade
- +177.57%: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-back-leg-3, Pushed toward the back, where the front foot lifts most; Both feet fixed at grade
- +174.94%: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x6 legs, 2-ply 2x4 beam); at right-front-leg-3, Pushed toward the front, where the back foot lifts most; Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.4 ° | 45 | +85.87% | +215.56% |
| Splay | 13.6 to 21.6 ° | 45 | +36.85% | +73.06% |
| Splay | 21.7 to 27.6 ° | 45 | +1.10% | +16.57% |
| Splay | 27.7 to 35.0 ° | 46 | -24.73% | -8.14% |
| Beam height | 60.1 to 77.1 in | 45 | +10.26% | +155.85% |
| Beam height | 77.9 to 100.2 in | 45 | +9.03% | +135.34% |
| Beam height | 100.5 to 120.3 in | 45 | +16.57% | +215.56% |
| Beam height | 120.3 to 142.3 in | 46 | +15.22% | +208.75% |
| Burial depth | 0.6 to 12.9 in | 45 | +13.54% | +215.56% |
| Burial depth | 13.4 to 24.0 in | 45 | +14.98% | +208.75% |
| Burial depth | 24.1 to 35.1 in | 45 | +26.59% | +177.57% |
| Burial depth | 35.1 to 47.8 in | 46 | +5.12% | +150.78% |
| Crossbar height | 12.8 to 33.8 in | 45 | +23.86% | +215.56% |
| Crossbar height | 33.9 to 49.3 in | 45 | +4.04% | +174.94% |
| Crossbar height | 49.9 to 68.7 in | 45 | +6.52% | +158.49% |
| Crossbar height | 68.7 to 122.9 in | 46 | +15.22% | +178.26% |

### A leg's load when pushed, against #468's P, joints rigid (over P)

243 instances. Smallest -40.68%, median +16.72%, largest +231.22%.

Largest five:

- +231.22%: draw 516 (splay 5.6°, beam height 115.10, burial 5.90, crossbar height 33.75, beam length 215.88, 4x4 legs, 4x4 beam); at right-front-leg-3, Pushed toward the front, where the back foot lifts most; Both feet fixed at grade
- +214.81%: draw 460 (splay 5.6°, beam height 140.50, burial 19.31, crossbar height 21.56, beam length 220.06, 4x6 legs, 4x4 beam); at right-back-leg-3, Pushed toward the back, where the front foot lifts most; Both feet fixed at grade
- +208.43%: draw 676 (splay 7.8°, beam height 136.00, burial 0.00, crossbar height 92.38, beam length 154.32, 4x4 legs, 2-ply 2x4 beam); at left-front-leg-3, Pushed toward the front, where the back foot lifts most; The lifting back feet released
- +188.04%: draw 553 (splay 5.2°, beam height 121.73, burial 21.73, crossbar height 91.62, beam length 164.19, 4x8 legs, 2-ply 2x6 beam); at left-front-leg-3, Pushed toward the front, where the back foot lifts most; Both feet fixed at grade
- +184.08%: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x4 beam); at left-back-leg-3, Pushed toward the back, where the front foot lifts most; Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.2 to 13.6 ° | 60 | +107.44% | +231.22% |
| Splay | 13.6 to 21.2 ° | 61 | +42.46% | +87.31% |
| Splay | 21.3 to 27.6 ° | 61 | +5.23% | +27.77% |
| Splay | 27.7 to 35.0 ° | 61 | -24.62% | -6.43% |
| Beam height | 60.1 to 77.9 in | 60 | +12.45% | +183.34% |
| Beam height | 78.0 to 99.9 in | 61 | +23.37% | +163.28% |
| Beam height | 100.0 to 117.9 in | 61 | +16.47% | +231.22% |
| Beam height | 118.3 to 142.3 in | 61 | +20.40% | +214.81% |
| Burial depth | 0.0 to 0.0 in | 60 | +35.71% | +208.43% |
| Burial depth | 0.0 to 18.0 in | 61 | +15.28% | +231.22% |
| Burial depth | 18.1 to 32.7 in | 61 | +17.79% | +214.81% |
| Burial depth | 32.8 to 47.8 in | 61 | +7.26% | +166.29% |
| Crossbar height | 12.3 to 32.3 in | 60 | +17.72% | +214.81% |
| Crossbar height | 33.3 to 49.9 in | 61 | +17.79% | +231.22% |
| Crossbar height | 50.1 to 68.7 in | 61 | +10.73% | +166.29% |
| Crossbar height | 69.8 to 122.9 in | 61 | +23.50% | +208.43% |

## Every analyzed instance

Sway in in/lb along the beam; forces in lb and moments in in-lb, largest over the swing load cases; "–" where the case is a mechanism or the value is zero. Leg is the largest |frame − P| / P over the support cases; uplift the largest |frame − core| in lb.

| Instance | Splay ° | Height | Burial | Crossbar | Sway pinned | Sway rigid | Compression p / r | Moment p / r | Foot down p / r | Foot pull p / r | Foot horizontal p / r | Leg vs P p / r | Uplift vs core |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Example: Worked example, every input entered | 20.0 | 96.00 | 24.00 | 40.00 | 0.006076 | 0.001641 | 420 / 1,085 | 15,750 / 10,533 | 389 / 395 | 151 / 157 | 162 / 164 | 0.02% / 0.20% | – |
| Example: Two-ply 2x6 beam on pads, level ground, footprint depth | 19.9 | 96.00 | 0.00 | 40.00 | mechanism along the beam | 0.006707 | – / 1,661 | – / 10,984 | – / 406 | – / 171 | – / 234 | – / 0.07% | 0.00 |
| draw 6 | 18.9 | 134.11 | 15.50 | 65.45 | 0.009593 | 0.005437 | 511 / 3,479 | 39,934 / 23,669 | 477 / 486 | 196 / 202 | 190 / 265 | 0.34% / 2.01% | – |
| draw 12 | 32.8 | 76.04 | 0.00 | 37.61 | mechanism along the beam | 0.00278 | – / 906 | – / 11,411 | – / 323 | – / 57 | – / 203 | – / 2.39% | 0.15 |
| draw 13 | 24.3 | 128.94 | 0.00 | 38.21 | mechanism along the beam | 0.01125 | – / 1,096 | – / 13,090 | – / 378 | – / 125 | – / 248 | – / 0.13% | 0.80 |
| draw 17 | 32.0 | 130.67 | 20.57 | 75.73 | 0.01909 | 0.005943 | 398 / 2,795 | 38,784 / 23,672 | 337 / 338 | 55 / 56 | 211 / 230 | 0.10% / 0.07% | – |
| draw 21 | 19.6 | 113.81 | 0.00 | 28.25 | mechanism along the beam | 0.01474 | – / 1,039 | – / 9,666 | – / 446 | – / 194 | – / 251 | – / 0.16% | 0.76 |
| draw 28 | 10.9 | 120.28 | 20.13 | 52.06 | 0.004988 | 0.001996 | 647 / 2,627 | 48,225 / 26,400 | 627 / 630 | 303 / 305 | 169 / 232 | 0.15% / 0.45% | – |
| draw 32 | 21.0 | 120.25 | 42.04 | 13.69 | 0.005819 | 0.002053 | 473 / 1,476 | 26,080 / 14,374 | 434 / 438 | 148 / 151 | 189 / 183 | 0.31% / 4.74% | – |
| draw 34 | 17.1 | 98.56 | 22.69 | 37.56 | 0.00622 | 0.001802 | 508 / 2,029 | 23,019 / 14,429 | 477 / 485 | 183 / 191 | 180 / 211 | 0.17% / 0.14% | – |
| draw 35 | 14.3 | 135.50 | 47.76 | 122.88 | 0.01555 | 0.004205 | 584 / 3,396 | 41,525 / 30,575 | 562 / 561 | 265 / 265 | 160 / 207 | 0.03% / 0.02% | – |
| draw 36 | 34.6 | 136.63 | 37.38 | 40.94 | 0.01585 | 0.005051 | 421 / 3,004 | 53,037 / 33,707 | 346 / 351 | 34 / 37 | 238 / 220 | 0.00% / 5.77% | – |
| draw 40 | 23.5 | 89.38 | 21.25 | 37.61 | 0.003129 | 0.001874 | 357 / 3,240 | 36,360 / 23,065 | 319 / 323 | 99 / 99 | 168 / 246 | 0.01% / 1.95% | – |
| draw 50 | 12.0 | 92.07 | 39.18 | 75.56 | 0.002236 | 0.001435 | 582 / 1,948 | 41,504 / 25,612 | 499 / 546 | 189 / 234 | 165 / 340 | 0.22% / 1.14% | – |
| draw 55 | 22.1 | 107.50 | 4.79 | 50.61 | 0.005599 | 0.001572 | 402 / 959 | 15,772 / 11,195 | 365 / 371 | 126 / 132 | 171 / 177 | 0.34% / 0.04% | – |
| draw 74 | 33.6 | 109.27 | 6.25 | 72.81 | 0.007842 | 0.002701 | 414 / 1,713 | 48,597 / 30,010 | 345 / 347 | 36 / 38 | 228 / 249 | 0.08% / 1.75% | – |
| draw 84 | 12.8 | 98.05 | 14.03 | 67.06 | 0.002718 | 0.001734 | 539 / 2,624 | 28,256 / 18,771 | 517 / 517 | 237 / 236 | 158 / 225 | 0.11% / 0.15% | – |
| draw 85 | 24.4 | 106.50 | 44.26 | 53.63 | 0.009181 | 0.002225 | 380 / 653 | 14,979 / 12,683 | 341 / 344 | 106 / 109 | 170 / 170 | 0.18% / 0.13% | – |
| draw 86 | 14.0 | 79.25 | 32.65 | 66.64 | 0.001528 | 0.0005792 | 453 / 903 | 12,635 / 6,554 | 429 / 452 | 167 / 191 | 153 / 177 | 0.03% / 0.23% | – |
| draw 89 | 20.4 | 102.68 | 0.00 | 29.13 | mechanism along the beam | 0.01661 | – / 3,502 | – / 24,559 | – / 413 | – / 169 | – / 284 | – / 3.53% | 0.26 |
| draw 91 | 21.9 | 112.12 | 33.62 | 78.75 | 0.006237 | 0.002109 | 453 / 1,293 | 31,988 / 19,449 | 413 / 419 | 140 / 145 | 188 / 206 | 0.43% / 0.62% | – |
| draw 95 | 30.4 | 115.38 | 36.50 | 92.69 | 0.0128 | 0.003835 | 402 / 1,890 | 27,868 / 17,251 | 347 / 347 | 60 / 61 | 203 / 217 | 0.17% / 0.06% | – |
| draw 96 | 28.5 | 93.94 | 35.13 | 34.99 | 0.007092 | 0.001928 | 371 / 1,840 | 37,086 / 27,395 | 326 / 327 | 66 / 68 | 176 / 202 | 0.04% / 1.21% | – |
| draw 99 | 21.2 | 65.44 | 20.75 | 24.41 | 0.002041 | 0.0006763 | 398 / 2,259 | 23,215 / 11,908 | 363 / 363 | 127 / 128 | 170 / 241 | 0.06% / 0.81% | – |
| draw 102 | 11.2 | 80.25 | 0.00 | 29.25 | mechanism along the beam | 0.002579 | – / 2,185 | – / 13,106 | – / 686 | – / 367 | – / 285 | – / 0.30% | 1.39 |
| draw 105 | 15.8 | 82.71 | 14.38 | 61.21 | 0.001826 | 0.0005179 | 513 / 1,652 | 17,414 / 11,167 | 483 / 488 | 192 / 197 | 176 / 202 | 0.61% / 0.35% | – |
| draw 110 | 32.2 | 110.13 | 31.25 | 88.17 | 0.005822 | 0.001927 | 396 / 1,194 | 22,176 / 11,953 | 335 / 335 | 34 / 34 | 210 / 211 | 0.00% / 1.39% | – |
| draw 112 | 17.2 | 78.00 | 3.50 | 21.38 | 0.001524 | 0.0006998 | 428 / 3,053 | 39,525 / 23,473 | 398 / 386 | 129 / 119 | 171 / 283 | 0.06% / 5.44% | – |
| draw 116 | 13.6 | 102.00 | 0.00 | 73.85 | mechanism along the beam | 0.007558 | – / 1,576 | – / 30,864 | – / 626 | – / 300 | – / 256 | – / 0.12% | 0.41 |
| draw 117 | 23.8 | 112.70 | 0.00 | 100.40 | mechanism along the beam | 0.008238 | – / 1,357 | – / 29,368 | – / 405 | – / 124 | – / 255 | – / 0.01% | 0.47 |
| draw 119 | 6.6 | 93.25 | 2.00 | 59.13 | 0.002358 | 0.0006398 | 708 / 1,908 | 22,498 / 15,460 | 696 / 700 | 356 / 359 | 153 / 195 | 0.16% / 0.19% | – |
| draw 121 | 19.2 | 111.79 | 3.13 | 35.15 | 0.005746 | 0.00301 | 496 / 2,776 | 32,278 / 18,790 | 459 / 466 | 183 / 188 | 195 / 222 | 0.41% / 0.59% | – |
| draw 125 | 31.9 | 134.37 | 21.13 | 87.27 | 0.02169 | 0.00638 | 398 / 1,247 | 41,917 / 29,386 | 338 / 338 | 42 / 43 | 210 / 220 | 0.02% / 0.14% | – |
| draw 129 | 13.4 | 118.25 | 10.32 | 42.25 | 0.004887 | 0.001687 | 643 / 2,167 | 29,902 / 17,259 | 615 / 633 | 269 / 285 | 195 / 238 | 0.52% / 0.57% | – |
| draw 130 | 27.9 | 124.13 | 10.92 | 103.92 | 0.01496 | 0.006749 | 414 / 3,143 | 32,956 / 18,286 | 366 / 369 | 101 / 106 | 193 / 221 | 0.39% / 1.10% | – |
| draw 133 | 21.3 | 142.31 | 10.25 | 90.88 | 0.01996 | 0.00505 | 482 / 1,524 | 32,610 / 25,634 | 445 / 448 | 154 / 157 | 188 / 193 | 0.31% / 0.37% | – |
| draw 134 | 25.6 | 82.74 | 0.00 | 62.13 | mechanism along the beam | 0.003581 | – / 1,385 | – / 33,477 | – / 348 | – / 94 | – / 241 | – / 0.49% | 0.17 |
| draw 136 | 9.9 | 122.56 | 3.21 | 43.25 | 0.006896 | 0.001961 | 684 / 944 | 13,686 / 9,030 | 667 / 691 | 378 / 402 | 160 / 158 | 0.12% / 0.15% | – |
| draw 137 | 13.9 | 65.73 | 12.05 | 31.88 | 0.0008497 | 0.0004902 | 437 / 1,356 | 14,907 / 9,337 | 412 / 425 | 163 / 176 | 160 / 188 | 0.13% / 0.67% | – |
| draw 138 | 22.2 | 93.65 | 0.00 | 74.80 | mechanism along the beam | 0.009459 | – / 2,197 | – / 17,608 | – / 383 | – / 144 | – / 262 | – / 0.16% | 0.28 |
| draw 140 | 27.3 | 67.81 | 26.38 | 19.30 | 0.002591 | 0.0007161 | 425 / 1,425 | 19,052 / 12,269 | 377 / 380 | 93 / 98 | 199 / 204 | 0.71% / 0.45% | – |
| draw 141 | 27.3 | 121.69 | 21.69 | 57.13 | 0.006506 | 0.002379 | 383 / 1,127 | 35,791 / 19,963 | 341 / 347 | 73 / 77 | 180 / 195 | 0.14% / 1.55% | – |
| draw 147 | 23.1 | 104.71 | 38.81 | 58.13 | 0.005281 | 0.001545 | 393 / 1,116 | 29,515 / 19,770 | 355 / 355 | 97 / 99 | 175 / 190 | 0.07% / 0.39% | – |
| draw 156 | 32.9 | 97.69 | 21.26 | 18.69 | 0.00553 | 0.001608 | 453 / 1,399 | 24,192 / 16,365 | 380 / 384 | 48 / 53 | 243 / 219 | 0.37% / 2.99% | – |
| draw 159 | 16.0 | 124.01 | 31.91 | 80.30 | 0.01203 | 0.003379 | 533 / 889 | 20,125 / 14,725 | 508 / 513 | 233 / 239 | 164 / 167 | 0.18% / 0.23% | – |
| draw 162 | 12.8 | 99.38 | 34.65 | 49.90 | 0.002907 | 0.0009705 | 565 / 1,755 | 25,843 / 15,573 | 541 / 553 | 232 / 244 | 175 / 221 | 0.39% / 0.59% | – |
| draw 163 | 34.5 | 129.27 | 20.44 | 16.63 | 0.02049 | 0.00742 | 454 / 1,909 | 23,259 / 12,643 | 374 / 377 | 58 / 60 | 256 / 250 | 0.49% / 1.12% | – |
| draw 164 | 28.8 | 84.69 | 36.75 | 61.44 | 0.003094 | 0.001389 | 370 / 879 | 18,673 / 10,282 | 324 / 325 | 66 / 69 | 177 / 193 | 0.15% / 0.67% | – |
| draw 165 | 13.4 | 122.43 | 44.69 | 101.14 | 0.006936 | 0.003966 | 649 / 2,541 | 33,296 / 20,059 | 625 / 641 | 314 / 324 | 181 / 258 | 0.44% / 2.13% | – |
| draw 166 | 29.4 | 102.26 | 0.00 | 36.19 | mechanism along the beam | 0.005414 | – / 882 | – / 24,710 | – / 380 | – / 73 | – / 241 | – / 2.22% | 0.46 |
| draw 171 | 24.9 | 100.17 | 37.34 | 47.60 | 0.004751 | 0.001733 | 410 / 1,589 | 36,816 / 20,278 | 372 / 376 | 99 / 104 | 193 / 224 | 0.30% / 0.80% | – |
| draw 174 | 17.0 | 76.56 | 0.00 | 30.88 | mechanism along the beam | 0.004137 | – / 1,887 | – / 24,738 | – / 524 | – / 235 | – / 272 | – / 0.14% | 0.72 |
| draw 175 | 29.3 | 136.63 | 24.19 | 87.20 | 0.009689 | 0.004932 | 385 / 2,853 | 47,894 / 24,927 | 336 / 342 | 64 / 66 | 188 / 220 | 0.10% / 1.44% | – |
| draw 188 | 15.4 | 129.76 | 11.44 | 116.62 | 0.01335 | 0.006604 | 607 / 4,772 | 40,673 / 22,718 | 581 / 592 | 281 / 288 | 178 / 261 | 0.31% / 1.73% | – |
| draw 189 | 26.5 | 83.31 | 38.19 | 51.08 | 0.002083 | 0.001084 | 415 / 1,422 | 24,126 / 13,924 | 371 / 381 | 79 / 88 | 186 / 221 | 0.59% / 0.04% | – |
| draw 191 | 28.1 | 110.94 | 35.22 | 17.53 | 0.0111 | 0.003285 | 395 / 2,249 | 40,191 / 26,802 | 348 / 351 | 75 / 78 | 192 / 197 | 0.08% / 2.59% | – |
| draw 197 | 31.1 | 104.13 | 34.38 | 65.47 | 0.004745 | 0.001551 | 398 / 960 | 15,770 / 9,424 | 340 / 342 | 58 / 59 | 205 / 199 | 0.32% / 0.86% | – |
| draw 199 | 27.7 | 87.44 | 43.10 | 70.31 | 0.003283 | 0.001263 | 409 / 2,850 | 45,642 / 24,298 | 362 / 367 | 68 / 69 | 189 / 271 | 0.24% / 0.11% | – |
| draw 202 | 24.0 | 76.50 | 17.88 | 14.63 | 0.002215 | 0.0006452 | 394 / 1,022 | 25,137 / 16,799 | 357 / 363 | 90 / 96 | 201 / 197 | 0.16% / 2.84% | – |
| draw 203 | 34.9 | 77.13 | 29.19 | 36.70 | 0.004666 | 0.001368 | 406 / 1,944 | 31,015 / 19,869 | 333 / 335 | 36 / 39 | 231 / 246 | 0.06% / 1.60% | – |
| draw 206 | 29.4 | 100.50 | 24.56 | 29.69 | 0.005473 | 0.001636 | 394 / 1,424 | 21,611 / 13,577 | 343 / 346 | 67 / 70 | 192 / 175 | 0.15% / 2.88% | – |
| draw 207 | 30.2 | 101.18 | 0.00 | 66.29 | mechanism along the beam | 0.007077 | – / 989 | – / 11,513 | – / 320 | – / 70 | – / 207 | – / 0.35% | 0.07 |
| draw 212 | 10.9 | 94.38 | 18.08 | 20.06 | 0.003113 | 0.001593 | 569 / 1,584 | 27,531 / 15,462 | 543 / 566 | 256 / 281 | 198 / 254 | 0.04% / 1.13% | – |
| draw 226 | 31.3 | 99.90 | 0.00 | 22.02 | mechanism along the beam | 0.007313 | – / 2,008 | – / 17,804 | – / 362 | – / 76 | – / 236 | – / 3.42% | 0.42 |
| draw 228 | 25.4 | 128.25 | 5.00 | 105.06 | 0.009617 | 0.004592 | 376 / 2,258 | 34,267 / 17,826 | 340 / 344 | 108 / 110 | 173 / 195 | 0.27% / 0.82% | – |
| draw 229 | 20.6 | 90.27 | 2.54 | 33.25 | 0.004918 | 0.002589 | 469 / 2,692 | 34,968 / 20,328 | 431 / 442 | 166 / 175 | 194 / 288 | 0.33% / 1.07% | – |
| draw 231 | 24.6 | 116.44 | 30.69 | 73.13 | 0.01198 | 0.003031 | 390 / 831 | 19,287 / 16,651 | 350 / 352 | 99 / 102 | 174 / 179 | 0.21% / 0.19% | – |
| draw 232 | 32.4 | 67.00 | 7.94 | 54.06 | 0.001321 | 0.0008235 | 398 / 2,027 | 23,650 / 15,260 | 336 / 339 | 47 / 47 | 212 / 239 | 0.14% / 4.24% | – |
| draw 236 | 17.9 | 88.75 | 40.81 | 59.81 | 0.004716 | 0.001327 | 553 / 1,556 | 38,256 / 27,151 | 518 / 524 | 197 / 203 | 197 / 229 | 0.33% / 0.55% | – |
| draw 239 | 10.0 | 76.69 | 0.00 | 58.00 | mechanism along the beam | 0.003986 | – / 1,781 | – / 19,013 | – / 879 | – / 508 | – / 311 | – / 0.58% | 3.23 |
| draw 241 | 13.7 | 100.94 | 36.63 | 83.01 | 0.006548 | 0.001749 | 607 / 1,804 | 30,636 / 20,891 | 583 / 586 | 266 / 268 | 169 / 187 | 0.16% / 0.19% | – |
| draw 242 | 24.3 | 83.89 | 0.00 | 27.94 | mechanism along the beam | 0.008981 | – / 1,431 | – / 22,022 | – / 337 | – / 117 | – / 249 | – / 5.49% | 0.17 |
| draw 243 | 24.5 | 134.88 | 32.13 | 50.87 | 0.0114 | 0.003199 | 406 / 1,510 | 29,998 / 20,510 | 362 / 363 | 94 / 96 | 188 / 194 | 0.14% / 0.39% | – |
| draw 245 | 13.5 | 96.88 | 0.00 | 50.11 | mechanism along the beam | 0.006583 | – / 3,239 | – / 27,111 | – / 620 | – / 307 | – / 281 | – / 0.20% | 0.72 |
| draw 248 | 26.1 | 105.37 | 37.38 | 79.63 | 0.004424 | 0.001357 | 379 / 1,195 | 44,341 / 30,227 | 340 / 342 | 50 / 50 | 169 / 216 | 0.03% / 1.35% | – |
| draw 249 | 31.8 | 127.56 | 38.43 | 34.96 | 0.01167 | 0.004843 | 386 / 1,278 | 15,852 / 8,528 | 328 / 329 | 68 / 69 | 202 / 181 | 0.14% / 3.37% | – |
| draw 252 | 22.7 | 138.13 | 24.18 | 58.00 | 0.01162 | 0.005345 | 418 / 1,996 | 22,295 / 13,074 | 380 / 382 | 137 / 138 | 175 / 182 | 0.27% / 0.41% | – |
| draw 255 | 18.5 | 77.00 | 34.12 | 17.38 | 0.00197 | 0.0007873 | 451 / 3,160 | 30,646 / 17,006 | 417 / 417 | 148 / 150 | 197 / 275 | 0.11% / 2.75% | – |
| draw 259 | 19.4 | 93.32 | 29.25 | 56.58 | 0.003519 | 0.001232 | 433 / 2,024 | 25,092 / 13,104 | 401 / 401 | 141 / 142 | 164 / 192 | 0.06% / 0.56% | – |
| draw 264 | 15.6 | 117.68 | 4.96 | 74.72 | 0.005062 | 0.001544 | 543 / 1,397 | 27,197 / 18,236 | 516 / 523 | 217 / 224 | 175 / 207 | 0.35% / 0.29% | – |
| draw 265 | 27.7 | 72.06 | 10.40 | 22.19 | 0.001998 | 0.0006323 | 396 / 1,375 | 24,354 / 14,434 | 351 / 354 | 64 / 68 | 182 / 195 | 0.09% / 5.57% | – |
| draw 272 | 7.9 | 101.75 | 21.93 | 40.13 | 0.003817 | 0.002149 | 774 / 2,780 | 29,878 / 18,243 | 759 / 783 | 443 / 465 | 168 / 228 | 0.23% / 1.26% | – |
| draw 281 | 22.2 | 117.11 | 46.66 | 55.19 | 0.01109 | 0.004965 | 415 / 2,610 | 31,129 / 17,610 | 380 / 383 | 139 / 142 | 168 / 191 | 0.13% / 0.06% | – |
| draw 282 | 27.2 | 139.38 | 7.06 | 30.81 | 0.01362 | 0.004315 | 386 / 1,824 | 33,464 / 20,343 | 343 / 344 | 84 / 86 | 175 / 172 | 0.02% / 4.85% | – |
| draw 287 | 18.7 | 136.19 | 0.00 | 120.88 | mechanism along the beam | 0.02708 | – / 2,240 | – / 17,414 | – / 481 | – / 210 | – / 259 | – / 0.18% | 0.58 |
| draw 291 | 29.4 | 117.88 | 39.96 | 60.00 | 0.008397 | 0.003831 | 357 / 1,426 | 15,924 / 10,397 | 311 / 312 | 69 / 70 | 175 / 179 | 0.04% / 1.25% | – |
| draw 294 | 9.3 | 79.94 | 28.17 | 44.69 | 0.001544 | 0.0004686 | 613 / 1,991 | 30,366 / 18,565 | 595 / 600 | 274 / 278 | 159 / 204 | 0.20% / 0.02% | – |
| draw 296 | 33.2 | 64.33 | 0.00 | 14.11 | mechanism along the beam | 0.001651 | – / 1,776 | – / 29,042 | – / 357 | – / 30 | – / 215 | – / 13.42% | 0.04 |
| draw 299 | 34.8 | 99.56 | 0.00 | 82.44 | mechanism along the beam | 0.02183 | – / 2,647 | – / 24,240 | – / 336 | – / 55 | – / 260 | – / 0.14% | 0.12 |
| draw 302 | 7.3 | 92.58 | 11.94 | 51.25 | 0.002878 | 0.001825 | 739 / 4,043 | 36,686 / 21,593 | 727 / 706 | 427 / 405 | 148 / 342 | 0.07% / 0.26% | – |
| draw 305 | 20.9 | 82.37 | 0.00 | 41.96 | mechanism along the beam | 0.002101 | – / 1,865 | – / 17,785 | – / 381 | – / 131 | – / 241 | – / 0.45% | 0.00 |
| draw 308 | 10.3 | 61.88 | 7.94 | 47.00 | 0.0009052 | 0.0005604 | 507 / 1,213 | 19,173 / 12,868 | 488 / 525 | 210 / 247 | 155 / 233 | 0.13% / 0.00% | – |
| draw 312 | 16.1 | 74.78 | 0.00 | 16.71 | mechanism along the beam | 0.002095 | – / 619 | – / 11,425 | – / 460 | – / 213 | – / 240 | – / 0.91% | 0.02 |
| draw 313 | 13.6 | 70.00 | 0.00 | 44.31 | mechanism along the beam | 0.002208 | – / 2,144 | – / 15,982 | – / 534 | – / 257 | – / 256 | – / 0.24% | 0.00 |
| draw 314 | 9.8 | 71.94 | 24.00 | 56.44 | 0.001055 | 0.0006601 | 531 / 1,372 | 26,323 / 16,486 | 461 / 580 | 145 / 261 | 172 / 308 | 0.48% / 1.60% | – |
| draw 316 | 32.1 | 100.06 | 21.64 | 59.81 | 0.005821 | 0.001675 | 416 / 1,072 | 23,410 / 16,733 | 353 / 354 | 52 / 56 | 220 / 218 | 0.38% / 0.39% | – |
| draw 326 | 22.9 | 77.90 | 19.38 | 63.00 | 0.003549 | 0.0009748 | 416 / 2,840 | 45,796 / 32,133 | 376 / 376 | 87 / 88 | 182 / 297 | 0.11% / 0.04% | – |
| draw 331 | 11.5 | 102.64 | 12.87 | 16.38 | 0.004181 | 0.001453 | 635 / 1,119 | 19,416 / 10,165 | 614 / 627 | 303 / 315 | 169 / 171 | 0.19% / 0.83% | – |
| draw 333 | 16.9 | 66.44 | 0.00 | 44.38 | mechanism along the beam | 0.001388 | – / 1,093 | – / 14,551 | – / 522 | – / 231 | – / 282 | – / 0.45% | 1.39 |
| draw 337 | 8.8 | 98.75 | 0.00 | 69.75 | mechanism along the beam | 0.005807 | – / 2,164 | – / 15,818 | – / 805 | – / 483 | – / 261 | – / 0.04% | 0.21 |
| draw 342 | 15.0 | 122.54 | 2.38 | 46.10 | 0.01123 | 0.005669 | 580 / 3,235 | 35,463 / 20,867 | 556 / 565 | 269 / 276 | 170 / 255 | 0.17% / 0.54% | – |
| draw 343 | 13.6 | 88.50 | 24.89 | 25.69 | 0.002035 | 0.001498 | 547 / 3,824 | 44,275 / 29,096 | 520 / 505 | 224 / 203 | 257 / 380 | 0.17% / 1.52% | – |
| draw 350 | 34.0 | 120.88 | 21.26 | 36.81 | 0.01577 | 0.005704 | 406 / 1,322 | 24,593 / 13,652 | 336 / 339 | 48 / 51 | 226 / 231 | 0.18% / 0.51% | – |
| draw 356 | 12.9 | 113.88 | 16.44 | 96.50 | 0.009222 | 0.002343 | 608 / 2,046 | 24,608 / 19,189 | 588 / 589 | 299 / 300 | 156 / 175 | 0.03% / 0.04% | – |
| draw 362 | 31.3 | 77.08 | 0.00 | 40.13 | mechanism along the beam | 0.00247 | – / 995 | – / 10,266 | – / 317 | – / 53 | – / 198 | – / 1.73% | 0.00 |
| draw 363 | 13.8 | 66.83 | 30.94 | 20.88 | 0.001858 | 0.00101 | 531 / 3,659 | 33,124 / 20,994 | 507 / 510 | 218 / 220 | 183 / 376 | 0.09% / 1.24% | – |
| draw 364 | 26.3 | 94.32 | 19.89 | 31.63 | 0.006429 | 0.002873 | 379 / 2,011 | 37,396 / 20,369 | 339 / 343 | 87 / 93 | 176 / 233 | 0.09% / 2.16% | – |
| draw 366 | 33.1 | 97.75 | 4.32 | 26.78 | 0.004317 | 0.001402 | 422 / 1,502 | 22,953 / 12,412 | 353 / 355 | 29 / 30 | 227 / 172 | 0.14% / 9.54% | – |
| draw 367 | 5.5 | 73.05 | 30.01 | 52.69 | 0.001082 | 0.0006918 | 550 / 1,397 | 26,017 / 15,323 | 523 / 713 | 193 / 379 | 156 / 233 | 0.38% / 1.77% | – |
| draw 376 | 31.9 | 62.72 | 22.19 | 33.88 | 0.001433 | 0.0007917 | 402 / 2,600 | 32,083 / 18,232 | 341 / 348 | 49 / 51 | 211 / 256 | 0.13% / 6.18% | – |
| draw 378 | 18.0 | 133.89 | 4.16 | 76.69 | 0.009893 | 0.003165 | 523 / 2,043 | 32,803 / 20,141 | 492 / 498 | 203 / 208 | 179 / 192 | 0.35% / 0.57% | – |
| draw 379 | 5.4 | 67.50 | 36.94 | 40.80 | 0.0008527 | 0.0004962 | 564 / 1,818 | 18,172 / 11,485 | 552 / 626 | 226 / 299 | 162 / 265 | 0.48% / 1.38% | – |
| draw 380 | 12.9 | 132.69 | 0.00 | 110.38 | mechanism along the beam | 0.009784 | – / 1,261 | – / 21,414 | – / 629 | – / 321 | – / 247 | – / 0.03% | 0.24 |
| draw 381 | 6.4 | 75.77 | 32.23 | 47.56 | 0.002491 | 0.001347 | 897 / 3,090 | 28,714 / 17,732 | 884 / 916 | 540 / 569 | 170 / 256 | 0.37% / 1.26% | – |
| draw 386 | 21.6 | 129.81 | 4.74 | 85.44 | 0.007274 | 0.002079 | 428 / 1,015 | 20,557 / 13,889 | 391 / 393 | 125 / 127 | 179 / 183 | 0.24% / 0.03% | – |
| draw 389 | 13.4 | 117.81 | 35.01 | 76.16 | 0.004676 | 0.002862 | 601 / 3,477 | 32,614 / 19,741 | 577 / 584 | 280 / 283 | 172 / 257 | 0.40% / 2.12% | – |
| draw 390 | 30.3 | 108.81 | 0.00 | 71.94 | mechanism along the beam | 0.00653 | – / 573 | – / 11,675 | – / 345 | – / 67 | – / 219 | – / 0.10% | 0.35 |
| draw 395 | 14.0 | 113.44 | 35.83 | 20.04 | 0.004457 | 0.00141 | 566 / 3,114 | 29,688 / 16,234 | 538 / 535 | 231 / 228 | 186 / 218 | 0.10% / 1.29% | – |
| draw 399 | 17.8 | 84.64 | 0.00 | 58.25 | mechanism along the beam | 0.004568 | – / 2,368 | – / 37,694 | – / 502 | – / 199 | – / 264 | – / 0.13% | 0.40 |
| draw 400 | 12.8 | 75.88 | 13.59 | 23.27 | 0.001733 | 0.0006719 | 509 / 1,912 | 32,491 / 17,266 | 485 / 490 | 182 / 188 | 189 / 327 | 0.05% / 0.14% | – |
| draw 401 | 8.6 | 113.32 | 24.56 | 32.33 | 0.00556 | 0.001546 | 875 / 2,186 | 22,358 / 15,388 | 858 / 874 | 495 / 511 | 177 / 208 | 0.59% / 0.71% | – |
| draw 410 | 12.7 | 98.61 | 0.00 | 74.27 | mechanism along the beam | 0.004892 | – / 1,025 | – / 10,957 | – / 592 | – / 301 | – / 254 | – / 0.02% | 0.33 |
| draw 413 | 17.2 | 114.07 | 38.88 | 85.88 | 0.004524 | 0.001673 | 548 / 2,173 | 31,139 / 16,693 | 515 / 520 | 205 / 208 | 195 / 223 | 0.55% / 1.01% | – |
| draw 417 | 6.3 | 73.94 | 0.00 | 20.25 | mechanism along the beam | 0.005057 | – / 2,232 | – / 11,335 | – / 976 | – / 641 | – / 304 | – / 0.56% | 3.49 |
| draw 418 | 23.9 | 70.81 | 16.75 | 25.56 | 0.002642 | 0.000868 | 382 / 1,719 | 30,806 / 17,877 | 340 / 343 | 100 / 104 | 184 / 225 | 0.17% / 0.39% | – |
| draw 424 | 24.3 | 126.51 | 0.00 | 51.33 | mechanism along the beam | 0.01005 | – / 2,638 | – / 31,306 | – / 376 | – / 102 | – / 244 | – / 0.17% | 0.25 |
| draw 427 | 10.9 | 92.94 | 28.80 | 29.36 | 0.002413 | 0.0008391 | 565 / 1,700 | 46,932 / 27,083 | 544 / 561 | 225 / 242 | 166 / 250 | 0.03% / 0.97% | – |
| draw 430 | 7.6 | 94.48 | 0.00 | 42.35 | mechanism along the beam | 0.006623 | – / 2,556 | – / 13,543 | – / 906 | – / 573 | – / 299 | – / 0.60% | 2.89 |
| draw 434 | 30.8 | 142.03 | 11.81 | 115.75 | 0.01474 | 0.005986 | 408 / 1,060 | 22,841 / 12,394 | 350 / 353 | 77 / 79 | 208 / 215 | 0.52% / 0.80% | – |
| draw 435 | 35.0 | 68.00 | 42.63 | 20.12 | 0.002113 | 0.0007816 | 424 / 1,928 | 34,945 / 17,666 | 348 / 355 | 28 / 29 | 240 / 211 | 0.27% / 18.82% | – |
| draw 440 | 6.9 | 74.44 | 20.96 | 41.68 | 0.002371 | 0.001393 | 953 / 3,809 | 38,624 / 23,968 | 938 / 965 | 559 / 577 | 190 / 338 | 0.51% / 2.96% | – |
| draw 443 | 8.6 | 65.05 | 0.00 | 12.31 | mechanism along the beam | 0.001454 | – / 3,947 | – / 26,579 | – / 718 | – / 399 | – / 467 | – / 0.99% | 0.12 |
| draw 444 | 20.3 | 121.13 | 0.00 | 56.94 | mechanism along the beam | 0.01179 | – / 562 | – / 12,045 | – / 429 | – / 175 | – / 235 | – / 0.14% | 0.37 |
| draw 445 | 14.9 | 76.01 | 0.00 | 57.38 | mechanism along the beam | 0.003036 | – / 3,147 | – / 21,922 | – / 583 | – / 251 | – / 298 | – / 0.14% | 0.53 |
| draw 448 | 8.8 | 106.88 | 34.30 | 58.56 | 0.003346 | 0.001815 | 670 / 1,033 | 20,918 / 11,888 | 606 / 689 | 304 / 387 | 174 / 186 | 0.30% / 0.75% | – |
| draw 452 | 34.0 | 90.31 | 0.00 | 31.19 | mechanism along the beam | 0.01214 | – / 2,813 | – / 19,557 | – / 339 | – / 51 | – / 210 | – / 6.34% | 0.13 |
| draw 453 | 28.3 | 91.44 | 21.24 | 35.06 | 0.004058 | 0.001373 | 413 / 2,415 | 36,103 / 20,602 | 363 / 366 | 74 / 77 | 194 / 199 | 0.20% / 4.20% | – |
| draw 455 | 33.7 | 79.44 | 42.00 | 44.93 | 0.00219 | 0.0008902 | 417 / 1,316 | 41,800 / 22,534 | 348 / 361 | 28 / 32 | 229 / 268 | 0.08% / 5.30% | – |
| draw 458 | 24.6 | 100.00 | 0.00 | 77.25 | mechanism along the beam | 0.004191 | – / 1,236 | – / 19,893 | – / 347 | – / 110 | – / 234 | – / 0.29% | 0.34 |
| draw 460 | 5.6 | 140.50 | 19.31 | 21.56 | 0.009801 | 0.005604 | 1,003 / 3,760 | 41,477 / 25,300 | 991 / 1,013 | 661 / 682 | 180 / 226 | 0.09% / 1.27% | – |
| draw 461 | 7.8 | 68.15 | 41.72 | 16.13 | 0.0008864 | 0.0006435 | 656 / 3,705 | 36,162 / 23,828 | 636 / 610 | 293 / 259 | 214 / 403 | 0.56% / 8.79% | – |
| draw 463 | 34.2 | 106.13 | 41.00 | 23.56 | 0.005446 | 0.002308 | 419 / 1,268 | 15,446 / 8,049 | 346 / 351 | 50 / 52 | 233 / 196 | 0.30% / 5.19% | – |
| draw 464 | 26.2 | 74.41 | 18.00 | 34.75 | 0.002053 | 0.0007329 | 383 / 2,065 | 34,880 / 19,766 | 343 / 351 | 77 / 80 | 178 / 221 | 0.17% / 2.21% | – |
| draw 473 | 32.9 | 62.82 | 0.00 | 22.63 | mechanism along the beam | 0.003084 | – / 1,682 | – / 11,250 | – / 324 | – / 46 | – / 211 | – / 1.50% | 0.00 |
| draw 475 | 10.4 | 131.00 | 14.63 | 110.02 | 0.01294 | 0.006561 | 754 / 6,116 | 42,443 / 23,960 | 737 / 739 | 427 / 427 | 161 / 274 | 0.14% / 0.88% | – |
| draw 476 | 6.4 | 136.25 | 35.06 | 51.71 | 0.007112 | 0.002101 | 914 / 1,740 | 36,637 / 24,900 | 902 / 930 | 540 / 567 | 156 / 172 | 0.22% / 0.40% | – |
| draw 485 | 28.2 | 71.73 | 47.51 | 55.69 | 0.001528 | 0.0004557 | 374 / 1,241 | 28,319 / 18,928 | 329 / 332 | 50 / 52 | 176 / 185 | 0.06% / 2.07% | – |
| draw 487 | 12.2 | 122.33 | 23.13 | 44.53 | 0.005183 | 0.003206 | 612 / 2,710 | 41,647 / 24,813 | 589 / 598 | 285 / 291 | 176 / 243 | 0.20% / 1.07% | – |
| draw 493 | 33.4 | 119.94 | 23.56 | 40.56 | 0.01023 | 0.002796 | 424 / 1,469 | 34,248 / 25,479 | 354 / 357 | 37 / 39 | 233 / 226 | 0.12% / 1.45% | – |
| draw 496 | 24.4 | 62.78 | 10.44 | 42.06 | 0.0008767 | 0.0005637 | 396 / 1,859 | 21,794 / 13,928 | 361 / 367 | 82 / 86 | 178 / 220 | 0.45% / 2.22% | – |
| draw 500 | 6.7 | 132.88 | 13.44 | 43.38 | 0.008369 | 0.004897 | 980 / 2,712 | 32,031 / 19,947 | 967 / 1,000 | 615 / 645 | 170 / 275 | 0.32% / 1.37% | – |
| draw 502 | 11.1 | 74.94 | 28.63 | 17.13 | 0.001702 | 0.0005343 | 579 / 1,645 | 37,439 / 23,464 | 553 / 570 | 241 / 259 | 198 / 245 | 0.13% / 2.43% | – |
| draw 509 | 5.7 | 70.53 | 33.30 | 18.19 | 0.001016 | 0.0004893 | 667 / 2,165 | 31,680 / 17,865 | 652 / 770 | 278 / 392 | 220 / 403 | 0.62% / 2.63% | – |
| draw 510 | 25.8 | 136.96 | 7.44 | 62.25 | 0.01951 | 0.005225 | 355 / 1,411 | 26,513 / 20,381 | 320 / 320 | 91 / 93 | 163 / 171 | 0.02% / 0.18% | – |
| draw 514 | 19.2 | 69.13 | 0.00 | 48.88 | mechanism along the beam | 0.001769 | – / 1,193 | – / 11,173 | – / 395 | – / 157 | – / 242 | – / 0.58% | 0.27 |
| draw 516 | 5.6 | 115.10 | 5.90 | 33.75 | 0.008523 | 0.0044 | 1,059 / 3,636 | 34,973 / 21,819 | 1,048 / 1,101 | 708 / 760 | 171 / 227 | 0.17% / 0.92% | – |
| draw 519 | 32.5 | 78.46 | 23.19 | 57.50 | 0.002104 | 0.001377 | 398 / 2,326 | 36,676 / 24,368 | 335 / 340 | 39 / 40 | 213 / 280 | 0.01% / 6.39% | – |
| draw 520 | 31.3 | 138.79 | 1.27 | 58.44 | 0.02293 | 0.0097 | 369 / 2,273 | 38,480 / 19,503 | 315 / 316 | 66 / 67 | 191 / 212 | 0.00% / 0.94% | – |
| draw 521 | 15.6 | 64.44 | 0.00 | 24.70 | mechanism along the beam | 0.001931 | – / 1,795 | – / 23,658 | – / 597 | – / 276 | – / 290 | – / 0.31% | 1.59 |
| draw 533 | 8.1 | 131.00 | 47.65 | 66.24 | 0.01269 | 0.005692 | 828 / 2,723 | 37,530 / 20,599 | 814 / 833 | 492 / 510 | 157 / 256 | 0.08% / 0.33% | – |
| draw 534 | 6.9 | 110.75 | 0.00 | 49.44 | mechanism along the beam | 0.01299 | – / 3,827 | – / 21,518 | – / 1,014 | – / 656 | – / 315 | – / 0.38% | 2.33 |
| draw 536 | 21.7 | 112.67 | 0.00 | 53.69 | mechanism along the beam | 0.008186 | – / 2,773 | – / 28,717 | – / 429 | – / 151 | – / 284 | – / 0.19% | 0.37 |
| draw 548 | 22.1 | 80.96 | 41.37 | 57.56 | 0.002335 | 0.001273 | 364 / 2,035 | 28,589 / 18,036 | 328 / 325 | 100 / 99 | 162 / 239 | 0.00% / 1.13% | – |
| draw 549 | 14.1 | 116.70 | 45.88 | 83.42 | 0.006228 | 0.002211 | 546 / 3,505 | 33,309 / 17,666 | 524 / 517 | 244 / 237 | 157 / 227 | 0.01% / 0.05% | – |
| draw 553 | 5.2 | 121.73 | 21.73 | 91.62 | 0.004981 | 0.001832 | 1,021 / 2,225 | 20,607 / 10,756 | 1,010 / 1,046 | 639 / 674 | 167 / 191 | 0.55% / 0.78% | – |
| draw 554 | 7.0 | 70.33 | 1.79 | 34.50 | 0.002109 | 0.0007794 | 827 / 3,569 | 48,275 / 26,095 | 814 / 831 | 463 / 478 | 157 / 310 | 0.18% / 0.84% | – |
| draw 557 | 20.0 | 60.05 | 45.06 | 43.15 | 0.0007149 | 0.0005162 | 396 / 3,137 | 40,350 / 25,488 | 358 / 366 | 106 / 103 | 179 / 336 | 0.24% / 2.33% | – |
| draw 563 | 33.0 | 129.69 | 0.00 | 64.75 | mechanism along the beam | 0.01202 | – / 898 | – / 13,620 | – / 350 | – / 60 | – / 221 | – / 0.49% | 0.36 |
| draw 565 | 34.4 | 139.19 | 37.33 | 42.88 | 0.01685 | 0.004555 | 418 / 964 | 29,297 / 22,982 | 345 / 346 | 38 / 39 | 235 / 225 | 0.05% / 1.50% | – |
| draw 566 | 22.3 | 67.50 | 39.81 | 18.69 | 0.002281 | 0.0006818 | 396 / 1,340 | 16,975 / 9,461 | 355 / 361 | 115 / 122 | 180 / 186 | 0.12% / 1.12% | – |
| draw 567 | 14.0 | 98.63 | 29.63 | 71.72 | 0.003873 | 0.001174 | 555 / 2,834 | 36,430 / 20,274 | 531 / 529 | 218 / 216 | 166 / 224 | 0.09% / 0.01% | – |
| draw 570 | 7.2 | 111.94 | 7.19 | 52.25 | 0.003905 | 0.001429 | 778 / 1,668 | 19,825 / 10,521 | 764 / 799 | 433 / 469 | 169 / 183 | 0.28% / 0.43% | – |
| draw 574 | 21.5 | 86.41 | 43.80 | 59.66 | 0.00226 | 0.0006864 | 412 / 1,866 | 34,353 / 21,719 | 373 / 374 | 86 / 89 | 177 / 240 | 0.16% / 1.01% | – |
| draw 576 | 25.4 | 84.85 | 9.37 | 25.66 | 0.002191 | 0.0006986 | 377 / 820 | 15,044 / 9,372 | 341 / 346 | 75 / 81 | 190 / 187 | 0.26% / 1.26% | – |
| draw 579 | 22.3 | 90.00 | 13.69 | 24.36 | 0.003243 | 0.001701 | 367 / 1,260 | 26,564 / 15,253 | 330 / 333 | 111 / 115 | 166 / 184 | 0.10% / 4.72% | – |
| draw 581 | 18.0 | 61.71 | 21.75 | 44.95 | 0.0008171 | 0.0002898 | 393 / 1,829 | 34,077 / 17,215 | 363 / 351 | 100 / 89 | 157 / 261 | 0.05% / 3.78% | – |
| draw 591 | 20.9 | 102.09 | 21.88 | 45.79 | 0.004659 | 0.001814 | 425 / 3,766 | 41,393 / 21,433 | 391 / 389 | 131 / 130 | 174 / 269 | 0.08% / 0.90% | – |
| draw 594 | 12.3 | 73.06 | 34.75 | 12.75 | 0.001485 | 0.0009045 | 548 / 1,503 | 25,687 / 16,118 | 517 / 547 | 225 / 256 | 213 / 248 | 0.30% / 0.62% | – |
| draw 595 | 8.5 | 106.16 | 0.00 | 84.65 | mechanism along the beam | 0.00597 | – / 1,392 | – / 18,128 | – / 795 | – / 477 | – / 258 | – / 0.03% | 0.06 |
| draw 597 | 29.1 | 102.38 | 0.00 | 78.95 | mechanism along the beam | 0.005724 | – / 1,125 | – / 33,939 | – / 344 | – / 59 | – / 222 | – / 1.03% | 0.08 |
| draw 603 | 27.3 | 94.61 | 24.15 | 72.44 | 0.006887 | 0.001802 | 368 / 1,589 | 31,163 / 22,415 | 328 / 328 | 68 / 68 | 168 / 183 | 0.01% / 0.16% | – |
| draw 608 | 22.9 | 92.85 | 41.19 | 58.77 | 0.00585 | 0.001568 | 381 / 1,018 | 14,799 / 10,026 | 345 / 347 | 122 / 124 | 161 / 164 | 0.10% / 0.01% | – |
| draw 612 | 23.6 | 126.31 | 31.50 | 68.70 | 0.01487 | 0.003799 | 397 / 954 | 19,739 / 16,460 | 359 / 362 | 97 / 100 | 171 / 176 | 0.02% / 0.02% | – |
| draw 613 | 12.8 | 101.24 | 0.00 | 35.32 | mechanism along the beam | 0.01242 | – / 1,380 | – / 19,545 | – / 643 | – / 334 | – / 287 | – / 0.62% | 1.21 |
| draw 614 | 7.0 | 112.19 | 41.63 | 71.44 | 0.005312 | 0.001444 | 879 / 1,200 | 21,055 / 14,644 | 866 / 887 | 512 / 532 | 164 / 169 | 0.36% / 0.39% | – |
| draw 615 | 34.1 | 89.94 | 0.00 | 15.64 | mechanism along the beam | 0.01352 | – / 2,594 | – / 18,120 | – / 356 | – / 51 | – / 225 | – / 5.73% | 0.15 |
| draw 617 | 24.4 | 118.69 | 0.00 | 103.42 | mechanism along the beam | 0.02047 | – / 1,717 | – / 11,557 | – / 404 | – / 163 | – / 264 | – / 0.81% | 1.25 |
| draw 620 | 13.7 | 125.83 | 15.60 | 70.22 | 0.005997 | 0.001751 | 570 / 1,726 | 27,317 / 16,974 | 547 / 548 | 235 / 237 | 165 / 178 | 0.11% / 0.09% | – |
| draw 625 | 14.2 | 78.88 | 34.38 | 26.44 | 0.003146 | 0.0009628 | 594 / 3,058 | 34,324 / 21,253 | 567 / 586 | 244 / 261 | 182 / 288 | 0.34% / 0.25% | – |
| draw 629 | 26.2 | 111.69 | 5.27 | 52.88 | 0.00512 | 0.001882 | 377 / 1,134 | 40,044 / 23,613 | 338 / 343 | 80 / 84 | 175 / 194 | 0.11% / 2.59% | – |
| draw 633 | 34.7 | 104.38 | 41.63 | 82.71 | 0.005183 | 0.002688 | 446 / 1,102 | 29,383 / 16,809 | 367 / 374 | 45 / 50 | 253 / 265 | 0.43% / 0.27% | – |
| draw 635 | 6.5 | 133.44 | 29.76 | 91.33 | 0.006564 | 0.002262 | 925 / 1,928 | 29,184 / 16,675 | 913 / 941 | 560 / 586 | 159 / 172 | 0.37% / 0.90% | – |
| draw 636 | 34.7 | 94.81 | 0.00 | 68.58 | mechanism along the beam | 0.006373 | – / 1,660 | – / 31,651 | – / 349 | – / 31 | – / 242 | – / 0.72% | 0.08 |
| draw 642 | 29.7 | 83.29 | 21.06 | 42.88 | 0.002374 | 0.0007478 | 373 / 1,386 | 28,826 / 18,162 | 324 / 329 | 45 / 45 | 183 / 192 | 0.05% / 2.98% | – |
| draw 643 | 17.5 | 62.06 | 30.94 | 37.20 | 0.000782 | 0.0002965 | 411 / 1,192 | 18,498 / 9,407 | 379 / 391 | 121 / 133 | 174 / 204 | 0.46% / 0.35% | – |
| draw 644 | 6.8 | 129.72 | 27.90 | 91.94 | 0.007776 | 0.004067 | 1,010 / 3,048 | 25,885 / 15,132 | 997 / 1,021 | 642 / 660 | 174 / 223 | 0.59% / 2.18% | – |
| draw 645 | 22.7 | 63.50 | 44.74 | 26.38 | 0.001854 | 0.0009377 | 377 / 1,750 | 26,343 / 15,104 | 339 / 345 | 115 / 120 | 167 / 220 | 0.12% / 1.54% | – |
| draw 646 | 13.0 | 117.00 | 0.00 | 53.50 | mechanism along the beam | 0.01051 | – / 1,128 | – / 28,103 | – / 679 | – / 353 | – / 262 | – / 0.26% | 1.13 |
| draw 648 | 32.3 | 134.88 | 2.37 | 59.13 | 0.01427 | 0.004522 | 389 / 1,587 | 25,202 / 14,513 | 329 / 329 | 51 / 52 | 207 / 201 | 0.02% / 1.87% | – |
| draw 651 | 31.9 | 75.84 | 27.06 | 37.33 | 0.001962 | 0.0007584 | 424 / 2,512 | 38,798 / 20,278 | 360 / 366 | 42 / 43 | 222 / 223 | 0.06% / 9.84% | – |
| draw 652 | 17.6 | 117.31 | 37.39 | 88.25 | 0.006497 | 0.003197 | 549 / 1,896 | 24,667 / 14,094 | 516 / 525 | 223 / 226 | 189 / 207 | 0.65% / 1.93% | – |
| draw 654 | 14.6 | 85.51 | 0.00 | 58.00 | mechanism along the beam | 0.003407 | – / 1,707 | – / 20,950 | – / 524 | – / 229 | – / 311 | – / 0.34% | 0.25 |
| draw 657 | 16.2 | 67.00 | 2.96 | 31.44 | 0.0009714 | 0.0004347 | 469 / 2,226 | 36,395 / 19,555 | 438 / 437 | 144 / 141 | 178 / 286 | 0.27% / 2.15% | – |
| draw 659 | 9.5 | 87.00 | 19.06 | 18.44 | 0.001969 | 0.0006555 | 704 / 3,194 | 42,461 / 23,815 | 681 / 678 | 315 / 311 | 202 / 278 | 0.37% / 2.13% | – |
| draw 663 | 34.0 | 110.73 | 0.00 | 55.88 | mechanism along the beam | 0.008234 | – / 782 | – / 18,265 | – / 357 | – / 43 | – / 229 | – / 1.25% | 0.20 |
| draw 672 | 21.2 | 67.00 | 2.69 | 47.98 | 0.002244 | 0.0005507 | 397 / 1,471 | 25,390 / 18,052 | 362 / 364 | 116 / 118 | 166 / 190 | 0.06% / 0.07% | – |
| draw 673 | 11.4 | 103.55 | 27.42 | 61.94 | 0.004144 | 0.001873 | 596 / 1,441 | 15,815 / 8,695 | 578 / 591 | 302 / 316 | 155 / 164 | 0.06% / 0.04% | – |
| draw 676 | 7.8 | 136.00 | 0.00 | 92.38 | mechanism along the beam | 0.02694 | – / 2,479 | – / 12,725 | – / 1,008 | – / 685 | – / 273 | – / 0.32% | 2.11 |
| draw 678 | 24.6 | 66.06 | 7.10 | 43.44 | 0.001028 | 0.0004221 | 374 / 1,788 | 33,476 / 17,812 | 340 / 350 | 70 / 74 | 172 / 240 | 0.27% / 1.67% | – |
| draw 679 | 23.8 | 113.15 | 3.76 | 63.43 | 0.005028 | 0.00192 | 393 / 2,141 | 40,876 / 21,795 | 352 / 354 | 98 / 100 | 178 / 213 | 0.16% / 1.27% | – |
| draw 680 | 15.0 | 122.23 | 0.00 | 62.73 | mechanism along the beam | 0.008267 | – / 3,233 | – / 33,104 | – / 563 | – / 237 | – / 270 | – / 0.02% | 0.12 |
| draw 681 | 22.3 | 137.89 | 32.81 | 89.44 | 0.01166 | 0.003694 | 421 / 2,383 | 31,152 / 19,597 | 385 / 390 | 138 / 142 | 172 / 194 | 0.23% / 0.17% | – |
| draw 687 | 21.3 | 87.98 | 0.56 | 70.13 | 0.003092 | 0.0008481 | 399 / 1,515 | 25,023 / 16,336 | 365 / 364 | 115 / 115 | 167 / 186 | 0.09% / 0.26% | – |
| draw 688 | 15.1 | 110.31 | 21.19 | 42.63 | 0.004135 | 0.001247 | 615 / 2,106 | 32,521 / 20,359 | 583 / 589 | 231 / 238 | 207 / 226 | 0.50% / 0.47% | – |
| draw 694 | 24.8 | 108.45 | 24.19 | 49.30 | 0.005947 | 0.002957 | 386 / 1,957 | 26,382 / 15,378 | 349 / 352 | 112 / 114 | 176 / 191 | 0.30% / 0.83% | – |
| draw 695 | 25.8 | 75.74 | 0.63 | 36.63 | 0.001677 | 0.0005078 | 373 / 591 | 21,937 / 15,117 | 336 / 339 | 70 / 76 | 174 / 180 | 0.14% / 1.75% | – |
| draw 696 | 22.8 | 136.95 | 0.00 | 71.38 | mechanism along the beam | 0.02575 | – / 1,841 | – / 14,997 | – / 378 | – / 151 | – / 243 | – / 0.50% | 0.26 |
| draw 697 | 24.6 | 66.56 | 47.44 | 53.94 | 0.002298 | 0.0007715 | 363 / 2,171 | 23,786 / 12,184 | 330 / 330 | 93 / 93 | 166 / 230 | 0.09% / 0.18% | – |
| draw 701 | 32.6 | 89.12 | 5.44 | 68.67 | 0.006472 | 0.001895 | 405 / 2,377 | 36,326 / 23,660 | 341 / 342 | 45 / 46 | 218 / 245 | 0.15% / 0.03% | – |
| draw 702 | 23.2 | 74.33 | 33.44 | 56.30 | 0.001466 | 0.0006927 | 380 / 3,154 | 42,909 / 24,200 | 340 / 346 | 90 / 85 | 189 / 304 | 0.12% / 2.97% | – |
| draw 703 | 14.4 | 133.45 | 22.13 | 19.47 | 0.007084 | 0.00256 | 585 / 1,683 | 43,259 / 25,064 | 557 / 576 | 226 / 244 | 188 / 230 | 0.17% / 3.01% | – |
| draw 711 | 19.0 | 93.88 | 0.00 | 43.49 | mechanism along the beam | 0.003548 | – / 1,036 | – / 25,340 | – / 444 | – / 168 | – / 249 | – / 0.60% | 0.30 |
| draw 718 | 20.7 | 105.13 | 0.00 | 85.31 | mechanism along the beam | 0.007312 | – / 4,419 | – / 27,644 | – / 409 | – / 151 | – / 293 | – / 0.81% | 0.18 |
| draw 719 | 14.8 | 127.65 | 0.00 | 21.88 | mechanism along the beam | 0.0131 | – / 1,604 | – / 17,240 | – / 564 | – / 289 | – / 246 | – / 0.03% | 0.25 |
| draw 722 | 27.6 | 113.00 | 0.00 | 27.94 | mechanism along the beam | 0.00669 | – / 1,709 | – / 25,662 | – / 356 | – / 75 | – / 231 | – / 4.09% | 0.22 |
| draw 723 | 27.8 | 117.94 | 15.55 | 80.00 | 0.00626 | 0.001878 | 398 / 1,823 | 41,409 / 27,843 | 353 / 355 | 46 / 46 | 185 / 215 | 0.06% / 1.02% | – |
| draw 728 | 28.9 | 74.44 | 43.44 | 59.96 | 0.003664 | 0.0009285 | 377 / 1,392 | 20,805 / 15,187 | 330 / 330 | 67 / 67 | 182 / 188 | 0.11% / 0.09% | – |
| draw 729 | 33.2 | 63.44 | 40.44 | 41.63 | 0.001139 | 0.0007149 | 400 / 1,130 | 30,438 / 19,010 | 335 / 344 | 29 / 37 | 217 / 272 | 0.03% / 7.19% | – |
| draw 733 | 16.8 | 81.19 | 0.00 | 54.28 | mechanism along the beam | 0.002297 | – / 1,661 | – / 23,914 | – / 532 | – / 200 | – / 316 | – / 0.16% | 0.89 |
| draw 734 | 8.0 | 117.86 | 1.92 | 83.05 | 0.006067 | 0.002137 | 809 / 2,667 | 19,412 / 10,313 | 796 / 794 | 472 / 470 | 154 / 190 | 0.14% / 0.10% | – |
| draw 735 | 30.9 | 94.98 | 33.06 | 47.69 | 0.004839 | 0.001369 | 404 / 1,056 | 34,151 / 25,654 | 347 / 349 | 49 / 51 | 207 / 207 | 0.16% / 1.14% | – |
| draw 737 | 24.8 | 101.50 | 0.00 | 29.63 | mechanism along the beam | 0.01071 | – / 2,217 | – / 27,235 | – / 382 | – / 133 | – / 273 | – / 0.47% | 0.43 |
| draw 738 | 20.4 | 61.63 | 33.69 | 21.25 | 0.001008 | 0.0006371 | 394 / 2,585 | 36,924 / 21,366 | 356 / 358 | 116 / 117 | 185 / 306 | 0.17% / 1.73% | – |
| draw 751 | 32.2 | 119.63 | 4.31 | 18.56 | 0.01027 | 0.002707 | 411 / 1,645 | 39,360 / 30,027 | 348 / 349 | 44 / 46 | 216 / 170 | 0.12% / 7.14% | – |
| draw 756 | 25.2 | 113.44 | 33.56 | 78.69 | 0.006498 | 0.003257 | 355 / 1,233 | 24,523 / 13,603 | 322 / 324 | 106 / 108 | 165 / 193 | 0.18% / 0.12% | – |
| draw 757 | 27.3 | 138.09 | 45.91 | 87.75 | 0.02069 | 0.005117 | 391 / 1,205 | 32,740 / 27,502 | 347 / 348 | 85 / 86 | 179 / 181 | 0.22% / 0.22% | – |
| draw 760 | 15.8 | 75.06 | 29.31 | 45.56 | 0.002876 | 0.0007251 | 528 / 1,722 | 26,501 / 18,077 | 501 / 508 | 203 / 210 | 170 / 193 | 0.22% / 0.20% | – |
| draw 764 | 33.3 | 98.01 | 5.88 | 40.09 | 0.005692 | 0.001841 | 445 / 1,195 | 28,047 / 17,362 | 372 / 376 | 46 / 50 | 243 / 229 | 0.31% / 2.69% | – |
| draw 766 | 27.6 | 67.24 | 17.25 | 24.13 | 0.00128 | 0.0004416 | 395 / 2,952 | 49,472 / 27,795 | 350 / 355 | 49 / 46 | 207 / 271 | 0.14% / 15.75% | – |
| draw 773 | 22.6 | 126.67 | 41.94 | 103.00 | 0.006974 | 0.002018 | 403 / 1,982 | 44,206 / 32,239 | 365 / 365 | 92 / 92 | 171 / 209 | 0.06% / 0.37% | – |
| draw 781 | 23.6 | 125.12 | 32.06 | 91.88 | 0.01378 | 0.006152 | 396 / 2,571 | 28,913 / 17,009 | 359 / 360 | 124 / 125 | 169 / 188 | 0.12% / 0.20% | – |
| draw 786 | 21.7 | 74.38 | 38.61 | 36.13 | 0.001332 | 0.000899 | 380 / 1,191 | 33,215 / 21,337 | 353 / 368 | 91 / 113 | 194 / 272 | 0.33% / 1.00% | – |
| draw 793 | 19.5 | 128.55 | 11.65 | 13.34 | 0.006881 | 0.002709 | 437 / 2,063 | 24,227 / 14,405 | 405 / 405 | 145 / 145 | 167 / 176 | 0.12% / 6.69% | – |
