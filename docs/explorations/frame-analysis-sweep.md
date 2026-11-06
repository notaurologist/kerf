# Exploratory frame analysis, not a structural check

The swing set's frame analysis (exploration #545, step 5) over the template's 3 worked examples and the first 800 draws of its seeded sweep (seed 571, template version 40), drawn as core's sweep draws them, so draw n here is draw n there. Written by `pnpm --filter @kerf/frame sweep`; every number below comes from that run.

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
| Analyzed | 102 (82 buried, 20 on pads) |
| rejected | 409 |
| refused | 207 |
| not-computed | 84 |
| input-needed | 1 |
| Total | 803 |

Not analyzed, by reason:

| Outcome | Reason | Instances | First instance |
|---|---|---|---|
| rejected | The parameters schema rejects gussetStock = "2x10" | 197 | draw 0 |
| rejected | The parameters schema rejects beamStock = "6x8" | 123 | draw 3 |
| rejected | The parameters schema rejects beamStock = "2x10" | 89 | draw 7 |
| not-computed | No design values are entered for southern-pine-no2 in 6x6, the legs. | 59 | draw 10 |
| refused | The template refuses it: footprint-out-of-range | 44 | draw 8 (No splay between 5° and 35° gives that footprint depth with these parameters.) |
| refused | The template refuses it: seat-too-close-to-frame | 31 | draw 1 (Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: seats-too-close | 30 | draw 25 (The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| not-computed | No design values are entered for southern-pine-no2 in 6x6, the beam. | 25 | draw 85 |
| refused | The template refuses it: hanger-outside-span, seat-too-close-to-frame | 20 | draw 78 (Hangers must be between the frames' inside faces (19-3/8" to 70-9/16" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: seat-too-close-to-frame, seats-too-close | 18 | draw 60 (Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hanger-outside-span, hangers-overlap, seat-too-close-to-frame, seats-too-close | 17 | draw 5 (The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Hangers must be between the frames' inside faces (15-5/8" to 34-5/8" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hanger-outside-span, seat-too-close-to-frame, seats-too-close | 15 | draw 11 (Hangers must be between the frames' inside faces (21-11/16" to 60-9/16" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hangers-overlap, seat-too-close-to-frame, seats-too-close | 11 | draw 39 (The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: hangers-overlap, seats-too-close | 10 | draw 61 (The two swings overlap. Move the swing centers apart or reduce the hanger spacing. The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg | 5 | draw 74 (The flush cut against the beam would be 4" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay.) |
| input-needed | Heaviest rider on each swing, with seat and chain, Maximum swing angle, Dynamic factor, Beam species and grade, Whether the beam lumber is incised, Beam moisture content, Leg species and grade, Whether the leg lumber is incised, Crossbar species and grade, Whether the crossbar lumber is incised, Gusset species and grade, Whether the gusset lumber is incised | 1 | Example: Worked example, no structural inputs |
| refused | The template refuses it: crossbar-below-grade, seat-too-close-to-frame | 1 | draw 421 (The crossbar's bottom edge (10-3/4" up) is at or below the ground at the uphill legs. Raise the crossbar. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg, hanger-outside-span, hangers-overlap, seat-too-close-to-frame, seats-too-close | 1 | draw 88 (The flush cut against the beam would be 3-5/8" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. The two swings overlap. Move the swing centers apart or reduce the hanger spacing. Hangers must be between the frames' inside faces (20-5/16" to 29-11/16" along the beam). Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg, seat-too-close-to-frame | 1 | draw 181 (The flush cut against the beam would be 4-1/16" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg, seat-too-close-to-frame, seats-too-close | 1 | draw 233 (The flush cut against the beam would be 4-1/8" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. Each seat needs at least 8" of space from the frame (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5). The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: flush-cut-through-leg, seats-too-close | 1 | draw 128 (The flush cut against the beam would be 4-1/8" deep, which goes through the 3-1/2" leg. Use thicker legs, a shallower beam, or less splay. The seats need at least 8" between them (CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005), p. 5).) |
| refused | The template refuses it: frames-do-not-fit | 1 | draw 2 (Two frames set 22-15/16" in from each end of a 52-3/4" beam overlap. Reduce the frame inset or lengthen the beam.) |

## Mechanisms

- Joints pinned, buried: 82 instances; 0 a mechanism along the beam and 0 another mechanism under the load along the beam; 0 swing load cases a mechanism along the beam and 0 another mechanism.
- Joints pinned, on pads: 20 instances; 20 a mechanism along the beam and 0 another mechanism under the load along the beam; 100 swing load cases a mechanism along the beam and 0 another mechanism.
- Joints rigid, buried: 82 instances; 0 a mechanism along the beam and 0 another mechanism under the load along the beam; 0 swing load cases a mechanism along the beam and 0 another mechanism.
- Joints rigid, on pads: 20 instances; 0 a mechanism along the beam and 0 another mechanism under the load along the beam; 0 swing load cases a mechanism along the beam and 0 another mechanism.

Pinned on pads, the solver returned a stiffness along the beam in 8 of 20 instances instead of reading the mechanism. Each is listed with the same instance's stiffness with rigid joints:

| Instance | Ground slope (in/ft) | Pinned, lb/in | Rigid, lb/in |
|---|---|---|---|
| draw 138 | 1.563 | 0.002581 | 148.7 |
| draw 239 | 1.447 | 0.003885 | 327.1 |
| draw 287 | 0.625 | 0.0003674 | 70.49 |
| draw 337 | -2.375 | 0.002159 | 231.8 |
| draw 410 | 0.688 | 0.000437 | 225.5 |
| draw 595 | 2.056 | 0.002031 | 187.6 |
| draw 617 | -2.129 | 0.002463 | 74.57 |
| draw 654 | -0.938 | 0.0007897 | 331 |

## Comparison with the sourced checks

### Leg axial load against #468

184 comparisons in 102 instances; 25 differ by more than 1.0%.

| Feet | Joints | Comparisons | Over tolerance | Smallest difference | Median | Largest |
|---|---|---|---|---|---|---|
| Buried | pinned | 82 | 0 | -0.27% | +0.18% | +0.65% |
| Buried | rigid | 82 | 23 | -14.26% | -0.12% | +1.43% |
| On pads | pinned | 0 | – | – | – | – |
| On pads | rigid | 20 | 2 | -3.31% | +0.05% | +0.71% |

Every comparison over the tolerance:

| Instance | Supports | Joints | Core P (lb) | Frame (lb) | Difference | Leg | Where |
|---|---|---|---|---|---|---|---|
| draw 435 | Both feet fixed at grade | rigid | 432.03 | 370.43 | -14.26% | left-back-leg-3 | splay 35.0°, beam height 68.00, burial 42.63, crossbar height 20.12, beam length 201.31, 4x6 legs, 4x8 beam |
| draw 793 | Both feet fixed at grade | rigid | 353.56 | 339.47 | -3.99% | right-front-leg-3 | splay 19.5°, beam height 128.55, burial 11.65, crossbar height 13.34, beam length 232.75, 4x6 legs, 2-ply 2x8 beam |
| draw 729 | Both feet fixed at grade | rigid | 407.64 | 391.64 | -3.93% | left-back-leg-3 | splay 33.2°, beam height 63.44, burial 40.44, crossbar height 41.63, beam length 184.63, 4x6 legs, 4x6 beam |
| draw 265 | Both feet fixed at grade | rigid | 402.26 | 386.60 | -3.89% | left-front-leg-3 | splay 27.7°, beam height 72.06, burial 10.40, crossbar height 22.19, beam length 143.83, 4x6 legs, 3-ply 2x8 beam |
| draw 615 | Both feet pinned on their pads | rigid | 434.38 | 419.99 | -3.31% | right-back-leg-3 | splay 34.1°, beam height 89.94, burial 0.00, crossbar height 15.64, beam length 230.29, 4x4 legs, 3-ply 2x6 beam |
| draw 282 | Both feet fixed at grade | rigid | 392.93 | 380.33 | -3.21% | left-front-leg-3 | splay 27.2°, beam height 139.38, burial 7.06, crossbar height 30.81, beam length 198.69, 4x6 legs, 4x8 beam |
| draw 32 | Both feet fixed at grade | rigid | 411.49 | 401.27 | -2.48% | left-front-leg-3 | splay 21.0°, beam height 120.25, burial 42.04, crossbar height 13.69, beam length 192.51, 4x6 legs, 4x8 beam |
| draw 776 | Both feet fixed at grade | rigid | 409.26 | 399.87 | -2.30% | left-back-leg-3 | splay 29.3°, beam height 75.44, burial 23.50, crossbar height 29.21, beam length 200.76, 4x6 legs, 2-ply 2x6 beam |
| draw 242 | Both feet pinned on their pads | rigid | 371.79 | 363.95 | -2.11% | left-front-leg-3 | splay 24.3°, beam height 83.89, burial 0.00, crossbar height 27.94, beam length 185.72, 4x6 legs, 4x6 beam |
| draw 249 | Both feet fixed at grade | rigid | 388.92 | 380.93 | -2.05% | right-front-leg-3 | splay 31.8°, beam height 127.56, burial 38.43, crossbar height 34.96, beam length 114.00, 4x6 legs, 2-ply 2x6 beam |
| draw 738 | Both feet fixed at grade | rigid | 363.73 | 356.47 | -2.00% | right-back-leg-3 | splay 20.4°, beam height 61.63, burial 33.69, crossbar height 21.25, beam length 171.89, 4x6 legs, 4x6 beam |
| draw 191 | Both feet fixed at grade | rigid | 402.46 | 395.53 | -1.72% | left-back-leg-3 | splay 28.1°, beam height 110.94, burial 35.22, crossbar height 17.53, beam length 222.25, 4x4 legs, 4x8 beam |
| draw 464 | Both feet fixed at grade | rigid | 387.99 | 381.33 | -1.72% | left-front-leg-3 | splay 26.2°, beam height 74.41, burial 18.00, crossbar height 34.75, beam length 168.94, 4x6 legs, 4x8 beam |
| draw 764 | Both feet fixed at grade | rigid | 451.01 | 443.49 | -1.67% | left-back-leg-3 | splay 33.3°, beam height 98.01, burial 5.88, crossbar height 40.09, beam length 196.95, 4x6 legs, 4x8 beam |
| draw 364 | Both feet fixed at grade | rigid | 389.80 | 383.83 | -1.53% | left-back-leg-3 | splay 26.3°, beam height 94.32, burial 19.89, crossbar height 31.63, beam length 208.56, 4x4 legs, 3-ply 2x6 beam |
| draw 645 | Both feet fixed at grade | rigid | 361.02 | 356.14 | -1.35% | right-front-leg-3 | splay 22.7°, beam height 63.50, burial 44.74, crossbar height 26.38, beam length 148.36, 4x4 legs, 4x6 beam |
| draw 703 | Both feet fixed at grade | rigid | 388.75 | 384.01 | -1.22% | right-back-leg-3 | splay 14.4°, beam height 133.45, burial 22.13, crossbar height 19.47, beam length 220.25, 4x6 legs, 3-ply 2x8 beam |
| draw 648 | Both feet fixed at grade | rigid | 395.35 | 390.59 | -1.20% | left-back-leg-3 | splay 32.3°, beam height 134.88, burial 2.37, crossbar height 59.13, beam length 202.70, 4x6 legs, 2-ply 2x8 beam |
| draw 579 | Both feet fixed at grade | rigid | 343.69 | 339.63 | -1.18% | right-front-leg-3 | splay 22.3°, beam height 90.00, burial 13.69, crossbar height 24.36, beam length 165.56, 4x4 legs, 4x6 beam |
| draw 363 | Both feet fixed at grade | rigid | 356.21 | 352.24 | -1.11% | right-back-leg-3 | splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam |
| draw 165 | Both feet fixed at grade | rigid | 376.54 | 380.41 | +1.03% | left-front-leg-3 | splay 13.4°, beam height 122.43, burial 44.69, crossbar height 101.14, beam length 172.63, 4x6 legs, 2-ply 2x6 beam |
| draw 212 | Both feet fixed at grade | rigid | 330.15 | 333.61 | +1.05% | left-front-leg-3 | splay 10.9°, beam height 94.38, burial 18.08, crossbar height 20.06, beam length 173.19, 4x6 legs, 3-ply 2x6 beam |
| draw 644 | Both feet fixed at grade | rigid | 369.62 | 373.71 | +1.11% | left-front-leg-3 | splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x6 beam |
| draw 628 | Both feet fixed at grade | rigid | 372.23 | 376.61 | +1.18% | right-front-leg-3 | splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam |
| draw 440 | Both feet fixed at grade | rigid | 398.42 | 404.10 | +1.43% | right-front-leg-3 | splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x6 beam |

### Foot uplift against #467

80 comparisons in 20 instances on pads; 3 differ by more than the tolerance.

Frame minus core: smallest -3.399 lb, median 0.000 lb, largest 3.399 lb.

Every comparison over the tolerance:

| Instance | Foot | Joints | Core (lb) | Frame (lb) | Difference (lb) | Where |
|---|---|---|---|---|---|---|
| draw 239 | right frame, back foot | rigid | 301.65 | 298.25 | -3.40 | splay 10.0°, beam height 76.69, burial 0.00, crossbar height 58.00, beam length 213.50, 4x4 legs, 4x8 beam |
| draw 239 | right frame, front foot | rigid | 284.47 | 281.50 | -2.97 | splay 10.0°, beam height 76.69, burial 0.00, crossbar height 58.00, beam length 213.50, 4x4 legs, 4x8 beam |
| draw 617 | left frame, front foot | rigid | 106.40 | 105.11 | -1.29 | splay 24.4°, beam height 118.69, burial 0.00, crossbar height 103.42, beam length 124.69, 4x4 legs, 2-ply 2x6 beam |

## Where each result is largest

### Sway along the beam per pound, joints pinned (in/lb)

82 instances. Smallest 0.0009486, median 0.006228, largest 0.02619.

Largest five:

- 0.02619: draw 353 (splay 33.6°, beam height 142.42, burial 8.20, crossbar height 44.00, beam length 151.93, 4x4 legs, 3-ply 2x6 beam)
- 0.02343: draw 520 (splay 31.3°, beam height 138.79, burial 1.27, crossbar height 58.44, beam length 193.39, 4x4 legs, 2-ply 2x6 beam)
- 0.02098: draw 163 (splay 34.5°, beam height 129.27, burial 20.44, crossbar height 16.63, beam length 172.98, 4x4 legs, 4x6 beam)
- 0.01988: draw 510 (splay 25.8°, beam height 136.96, burial 7.44, crossbar height 62.25, beam length 142.43, 4x4 legs, 3-ply 2x8 beam)
- 0.01618: draw 350 (splay 34.0°, beam height 120.88, burial 21.26, crossbar height 36.81, beam length 166.98, 4x4 legs, 3-ply 2x6 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 0.002755 | 0.01345 |
| Splay | 14.2 to 22.1 ° | 21 | 0.006383 | 0.01366 |
| Splay | 22.1 to 26.5 ° | 20 | 0.005505 | 0.01988 |
| Splay | 27.2 to 35.0 ° | 21 | 0.008791 | 0.02619 |
| Beam height | 61.6 to 74.4 in | 20 | 0.00194 | 0.00274 |
| Beam height | 75.4 to 100.2 in | 21 | 0.003248 | 0.006632 |
| Beam height | 100.7 to 122.3 in | 20 | 0.006855 | 0.01618 |
| Beam height | 122.4 to 142.4 in | 21 | 0.01298 | 0.02619 |
| Burial depth | 1.0 to 10.4 in | 20 | 0.006721 | 0.02619 |
| Burial depth | 11.4 to 22.1 in | 21 | 0.006739 | 0.02098 |
| Burial depth | 22.7 to 34.8 in | 20 | 0.005155 | 0.01411 |
| Burial depth | 35.2 to 47.7 in | 21 | 0.003382 | 0.01358 |
| Crossbar height | 12.8 to 26.4 in | 20 | 0.002863 | 0.02098 |
| Crossbar height | 29.2 to 46.1 in | 21 | 0.006076 | 0.02619 |
| Crossbar height | 46.6 to 60.0 in | 20 | 0.005303 | 0.02343 |
| Crossbar height | 61.4 to 116.6 in | 21 | 0.007104 | 0.01988 |

### Sway along the beam per pound, joints rigid (in/lb)

102 instances. Smallest 0.0003631, median 0.002106, largest 0.01543.

Largest five:

- 0.01543: draw 13 (splay 25.1°, beam height 128.94, burial 0.00, crossbar height 38.21, beam length 145.88, 4x4 legs, 3-ply 2x8 beam)
- 0.01419: draw 287 (splay 18.7°, beam height 136.19, burial 0.00, crossbar height 120.88, beam length 215.75, 4x6 legs, 4x6 beam)
- 0.01341: draw 617 (splay 24.4°, beam height 118.69, burial 0.00, crossbar height 103.42, beam length 124.69, 4x4 legs, 2-ply 2x6 beam)
- 0.01322: draw 563 (splay 33.0°, beam height 129.69, burial 0.00, crossbar height 64.75, beam length 132.38, 4x6 legs, 4x8 beam)
- 0.01239: draw 299 (splay 34.8°, beam height 99.56, burial 0.00, crossbar height 82.44, beam length 235.29, 4x4 legs, 2-ply 2x6 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 25 | 0.001569 | 0.006249 |
| Splay | 14.2 to 22.1 ° | 26 | 0.002106 | 0.01419 |
| Splay | 22.1 to 26.5 ° | 25 | 0.001924 | 0.01543 |
| Splay | 27.2 to 35.0 ° | 26 | 0.003137 | 0.01322 |
| Beam height | 61.6 to 76.7 in | 25 | 0.0005829 | 0.003228 |
| Beam height | 78.9 to 100.1 in | 26 | 0.001567 | 0.01239 |
| Beam height | 100.2 to 120.9 in | 25 | 0.002194 | 0.01341 |
| Beam height | 121.7 to 142.4 in | 26 | 0.003799 | 0.01543 |
| Burial depth | 0.0 to 2.4 in | 25 | 0.006249 | 0.01543 |
| Burial depth | 2.5 to 18.0 in | 26 | 0.001703 | 0.006931 |
| Burial depth | 18.1 to 33.6 in | 25 | 0.001641 | 0.005578 |
| Burial depth | 33.6 to 47.7 in | 26 | 0.001065 | 0.003884 |
| Crossbar height | 12.8 to 29.6 in | 25 | 0.0008611 | 0.01055 |
| Crossbar height | 30.8 to 46.6 in | 26 | 0.001862 | 0.01543 |
| Crossbar height | 47.0 to 64.8 in | 25 | 0.001908 | 0.01322 |
| Crossbar height | 65.5 to 120.9 in | 26 | 0.003527 | 0.01419 |

### Spread of sway: pinned over rigid (times)

82 instances. Smallest 2.48, median 3.43, largest 4.15.

Largest five:

- 4.15: draw 566 (splay 22.3°, beam height 67.50, burial 39.81, crossbar height 18.69, beam length 154.18, 4x4 legs, 4x8 beam)
- 4.14: draw 510 (splay 25.8°, beam height 136.96, burial 7.44, crossbar height 62.25, beam length 142.43, 4x4 legs, 3-ply 2x8 beam)
- 4.08: draw 34 (splay 17.1°, beam height 98.56, burial 22.69, crossbar height 37.56, beam length 192.81, 4x4 legs, 3-ply 2x8 beam)
- 4.07: draw 55 (splay 22.1°, beam height 107.50, burial 4.79, crossbar height 50.61, beam length 94.62, 4x6 legs, 3-ply 2x8 beam)
- 4.05: draw 159 (splay 16.0°, beam height 124.01, burial 31.91, crossbar height 80.30, beam length 134.95, 4x4 legs, 4x8 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 3.03 | 3.90 |
| Splay | 14.2 to 22.1 ° | 21 | 3.49 | 4.08 |
| Splay | 22.1 to 26.5 ° | 20 | 3.52 | 4.15 |
| Splay | 27.2 to 35.0 ° | 21 | 3.65 | 3.99 |
| Beam height | 61.6 to 74.4 in | 20 | 3.26 | 4.15 |
| Beam height | 75.4 to 100.2 in | 21 | 3.36 | 4.08 |
| Beam height | 100.7 to 122.3 in | 20 | 3.59 | 4.07 |
| Beam height | 122.4 to 142.4 in | 21 | 3.43 | 4.14 |
| Burial depth | 1.0 to 10.4 in | 20 | 3.61 | 4.14 |
| Burial depth | 11.4 to 22.1 in | 21 | 3.48 | 3.99 |
| Burial depth | 22.7 to 34.8 in | 20 | 3.04 | 4.08 |
| Burial depth | 35.2 to 47.7 in | 21 | 3.34 | 4.15 |
| Crossbar height | 12.8 to 26.4 in | 20 | 3.67 | 4.15 |
| Crossbar height | 29.2 to 46.1 in | 21 | 3.48 | 4.08 |
| Crossbar height | 46.6 to 60.0 in | 20 | 3.44 | 4.07 |
| Crossbar height | 61.4 to 116.6 in | 21 | 3.34 | 4.14 |

### Largest axial compression in a member, joints pinned (lb)

82 instances. Smallest 360.4, median 439.7, largest 1,092.7.

Largest five:

- 1,092.7: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x4 legs, 2-ply 2x6 beam); at right-front-leg-3, Pushed toward the front, where the back foot lifts most (φ = 40.91°); Both feet fixed at grade
- 1,022.8: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x6 beam); at left-front-leg-2, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 967.0: draw 440 (splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x6 beam); at right-back-leg-3, Pushed toward the back, where the front foot lifts most (φ = 41.61°); Both feet fixed at grade
- 841.4: draw 533 (splay 8.1°, beam height 131.00, burial 47.65, crossbar height 66.24, beam length 204.44, 4x4 legs, 3-ply 2x6 beam); at left-front-leg-3, Pushed toward the front, where the back foot lifts most (φ = 41.72°); Both feet fixed at grade
- 837.6: draw 554 (splay 7.0°, beam height 70.33, burial 1.79, crossbar height 34.50, beam length 220.06, 4x4 legs, 4x8 beam); at right-front-leg-2, Pushed toward the front, where the back foot lifts most (φ = 41.68°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 661.2 | 1,092.7 |
| Splay | 14.2 to 22.1 ° | 21 | 516.9 | 656.9 |
| Splay | 22.1 to 26.5 ° | 20 | 389.3 | 424.2 |
| Splay | 27.2 to 35.0 ° | 21 | 408.7 | 462.5 |
| Beam height | 61.6 to 74.4 in | 20 | 420.7 | 967.0 |
| Beam height | 75.4 to 100.2 in | 21 | 424.2 | 833.3 |
| Beam height | 100.7 to 122.3 in | 20 | 419.6 | 685.7 |
| Beam height | 122.4 to 142.4 in | 21 | 462.5 | 1,092.7 |
| Burial depth | 1.0 to 10.4 in | 20 | 409.1 | 837.6 |
| Burial depth | 11.4 to 22.1 in | 21 | 462.5 | 1,092.7 |
| Burial depth | 22.7 to 34.8 in | 20 | 510.3 | 1,022.8 |
| Burial depth | 35.2 to 47.7 in | 21 | 418.5 | 841.4 |
| Crossbar height | 12.8 to 26.4 in | 20 | 444.0 | 685.7 |
| Crossbar height | 29.2 to 46.1 in | 21 | 453.2 | 1,092.7 |
| Crossbar height | 46.6 to 60.0 in | 20 | 420.5 | 833.3 |
| Crossbar height | 61.4 to 116.6 in | 21 | 460.6 | 1,022.8 |

### Largest axial tension in a member, joints pinned (lb)

82 instances. Smallest 85.6, median 170.9, largest 720.3.

Largest five:

- 720.3: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x4 legs, 2-ply 2x6 beam); at right-front-leg-3, Pushed toward the back, where the front foot lifts most (φ = 40.90°); Both feet fixed at grade
- 654.2: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x6 beam); at left-back-leg-3, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 566.9: draw 440 (splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x6 beam); at right-back-leg-3, Pushed toward the front, where the back foot lifts most (φ = 41.52°); Both feet fixed at grade
- 514.7: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x4 legs, 2-ply 2x6 beam); at right-front-leg-3, Pushed toward the back, where the front foot lifts most (φ = 41.40°); Both feet fixed at grade
- 495.2: draw 533 (splay 8.1°, beam height 131.00, burial 47.65, crossbar height 66.24, beam length 204.44, 4x4 legs, 3-ply 2x6 beam); at left-front-leg-3, Pushed toward the back, where the front foot lifts most (φ = 41.68°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 384.3 | 720.3 |
| Splay | 14.2 to 22.1 ° | 21 | 223.1 | 321.0 |
| Splay | 22.1 to 26.5 ° | 20 | 143.5 | 179.7 |
| Splay | 27.2 to 35.0 ° | 21 | 115.1 | 160.3 |
| Beam height | 61.6 to 74.4 in | 20 | 161.6 | 566.9 |
| Beam height | 75.4 to 100.2 in | 21 | 179.7 | 514.7 |
| Beam height | 100.7 to 122.3 in | 20 | 160.6 | 353.1 |
| Beam height | 122.4 to 142.4 in | 21 | 165.8 | 720.3 |
| Burial depth | 1.0 to 10.4 in | 20 | 148.9 | 468.8 |
| Burial depth | 11.4 to 22.1 in | 21 | 165.8 | 720.3 |
| Burial depth | 22.7 to 34.8 in | 20 | 228.1 | 654.2 |
| Burial depth | 35.2 to 47.7 in | 21 | 147.2 | 495.2 |
| Crossbar height | 12.8 to 26.4 in | 20 | 157.7 | 377.9 |
| Crossbar height | 29.2 to 46.1 in | 21 | 167.5 | 720.3 |
| Crossbar height | 46.6 to 60.0 in | 20 | 170.9 | 514.7 |
| Crossbar height | 61.4 to 116.6 in | 21 | 196.6 | 654.2 |

### Largest bending moment in a member, joints pinned (in-lb)

82 instances. Smallest 12,635, median 29,148, largest 48,275.

Largest five:

- 48,275: draw 554 (splay 7.0°, beam height 70.33, burial 1.79, crossbar height 34.50, beam length 220.06, 4x4 legs, 4x8 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 48,225: draw 28 (splay 11.7°, beam height 120.28, burial 20.13, crossbar height 52.06, beam length 234.22, 4x6 legs, 4x8 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 45,642: draw 199 (splay 27.7°, beam height 87.44, burial 43.10, crossbar height 70.31, beam length 239.81, 4x6 legs, 4x8 beam); at beam-5, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 43,259: draw 703 (splay 14.4°, beam height 133.45, burial 22.13, crossbar height 19.47, beam length 220.25, 4x6 legs, 3-ply 2x8 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 41,961: draw 628 (splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 32,261 | 48,275 |
| Splay | 14.2 to 22.1 ° | 21 | 30,358 | 43,259 |
| Splay | 22.1 to 26.5 ° | 20 | 27,738 | 40,876 |
| Splay | 27.2 to 35.0 ° | 21 | 25,202 | 45,642 |
| Beam height | 61.6 to 74.4 in | 20 | 28,391 | 48,275 |
| Beam height | 75.4 to 100.2 in | 21 | 28,589 | 45,642 |
| Beam height | 100.7 to 122.3 in | 20 | 29,642 | 48,225 |
| Beam height | 122.4 to 142.4 in | 21 | 28,913 | 43,259 |
| Burial depth | 1.0 to 10.4 in | 20 | 31,683 | 48,275 |
| Burial depth | 11.4 to 22.1 in | 21 | 32,031 | 48,225 |
| Burial depth | 22.7 to 34.8 in | 20 | 26,352 | 41,961 |
| Burial depth | 35.2 to 47.7 in | 21 | 28,589 | 45,642 |
| Crossbar height | 12.8 to 26.4 in | 20 | 26,454 | 43,259 |
| Crossbar height | 29.2 to 46.1 in | 21 | 32,031 | 48,275 |
| Crossbar height | 46.6 to 60.0 in | 20 | 27,485 | 48,225 |
| Crossbar height | 61.4 to 116.6 in | 21 | 28,913 | 45,642 |

### Largest downward load on a foot, joints pinned (lb)

82 instances. Smallest 317.3, median 379.3, largest 1,080.5.

Largest five:

- 1,080.5: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x4 legs, 2-ply 2x6 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 40.90°); Both feet fixed at grade
- 1,009.7: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x6 beam); at left-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 951.9: draw 440 (splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x6 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.52°); Both feet fixed at grade
- 827.7: draw 533 (splay 8.1°, beam height 131.00, burial 47.65, crossbar height 66.24, beam length 204.44, 4x4 legs, 3-ply 2x6 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 41.68°); Both feet fixed at grade
- 824.5: draw 554 (splay 7.0°, beam height 70.33, burial 1.79, crossbar height 34.50, beam length 220.06, 4x4 legs, 4x8 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.68°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 638.7 | 1,080.5 |
| Splay | 14.2 to 22.1 ° | 21 | 485.2 | 628.1 |
| Splay | 22.1 to 26.5 ° | 20 | 349.7 | 387.6 |
| Splay | 27.2 to 35.0 ° | 21 | 354.6 | 381.1 |
| Beam height | 61.6 to 74.4 in | 20 | 366.7 | 951.9 |
| Beam height | 75.4 to 100.2 in | 21 | 379.5 | 821.3 |
| Beam height | 100.7 to 122.3 in | 20 | 371.8 | 665.1 |
| Beam height | 122.4 to 142.4 in | 21 | 423.8 | 1,080.5 |
| Burial depth | 1.0 to 10.4 in | 20 | 370.1 | 824.5 |
| Burial depth | 11.4 to 22.1 in | 21 | 423.8 | 1,080.5 |
| Burial depth | 22.7 to 34.8 in | 20 | 483.5 | 1,009.7 |
| Burial depth | 35.2 to 47.7 in | 21 | 370.6 | 827.7 |
| Crossbar height | 12.8 to 26.4 in | 20 | 374.2 | 665.1 |
| Crossbar height | 29.2 to 46.1 in | 21 | 389.0 | 1,080.5 |
| Crossbar height | 46.6 to 60.0 in | 20 | 374.6 | 821.3 |
| Crossbar height | 61.4 to 116.6 in | 21 | 420.5 | 1,009.7 |

### Largest pull on a foot, joints pinned (lb)

82 instances. Smallest 20.9, median 119.8, largest 710.6.

Largest five:

- 710.6: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x4 legs, 2-ply 2x6 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 40.91°); Both feet fixed at grade
- 643.6: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x6 beam); at left-front-foot, Pushed toward the back, where the front foot lifts most (φ = 41.19°); Both feet fixed at grade
- 554.0: draw 440 (splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x6 beam); at right-front-foot, Pushed toward the back, where the front foot lifts most (φ = 41.61°); Both feet fixed at grade
- 505.0: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x4 legs, 2-ply 2x6 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 41.45°); Both feet fixed at grade
- 484.7: draw 533 (splay 8.1°, beam height 131.00, burial 47.65, crossbar height 66.24, beam length 204.44, 4x4 legs, 3-ply 2x6 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 41.72°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 311.5 | 710.6 |
| Splay | 14.2 to 22.1 ° | 21 | 174.8 | 273.8 |
| Splay | 22.1 to 26.5 ° | 20 | 96.1 | 131.6 |
| Splay | 27.2 to 35.0 ° | 21 | 58.0 | 77.1 |
| Beam height | 61.6 to 74.4 in | 20 | 117.3 | 554.0 |
| Beam height | 75.4 to 100.2 in | 21 | 117.3 | 505.0 |
| Beam height | 100.7 to 122.3 in | 20 | 117.9 | 339.0 |
| Beam height | 122.4 to 142.4 in | 21 | 147.7 | 710.6 |
| Burial depth | 1.0 to 10.4 in | 20 | 91.4 | 458.5 |
| Burial depth | 11.4 to 22.1 in | 21 | 147.7 | 710.6 |
| Burial depth | 22.7 to 34.8 in | 20 | 191.7 | 643.6 |
| Burial depth | 35.2 to 47.7 in | 21 | 92.2 | 484.7 |
| Crossbar height | 12.8 to 26.4 in | 20 | 119.8 | 339.0 |
| Crossbar height | 29.2 to 46.1 in | 21 | 150.6 | 710.6 |
| Crossbar height | 46.6 to 60.0 in | 20 | 103.0 | 505.0 |
| Crossbar height | 61.4 to 116.6 in | 21 | 135.3 | 643.6 |

### Largest horizontal force on a foot, joints pinned (lb)

82 instances. Smallest 150.3, median 181.0, largest 261.1.

Largest five:

- 261.1: draw 163 (splay 34.5°, beam height 129.27, burial 20.44, crossbar height 16.63, beam length 172.98, 4x4 legs, 4x6 beam); at left-back-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 257.9: draw 633 (splay 34.7°, beam height 104.38, burial 41.63, crossbar height 82.71, beam length 175.19, 4x6 legs, 4x6 beam); at right-back-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 247.0: draw 764 (splay 33.3°, beam height 98.01, burial 5.88, crossbar height 40.09, beam length 196.95, 4x6 legs, 4x8 beam); at left-back-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 247.0: draw 353 (splay 33.6°, beam height 142.42, burial 8.20, crossbar height 44.00, beam length 151.93, 4x4 legs, 3-ply 2x6 beam); at right-front-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 244.7: draw 435 (splay 35.0°, beam height 68.00, burial 42.63, crossbar height 20.12, beam length 201.31, 4x6 legs, 4x8 beam); at left-front-foot, Bottom of the arc (φ = 0.00°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 170.8 | 203.2 |
| Splay | 14.2 to 22.1 ° | 21 | 182.6 | 198.5 |
| Splay | 22.1 to 26.5 ° | 20 | 177.5 | 196.2 |
| Splay | 27.2 to 35.0 ° | 21 | 210.8 | 261.1 |
| Beam height | 61.6 to 74.4 in | 20 | 178.6 | 244.7 |
| Beam height | 75.4 to 100.2 in | 21 | 182.6 | 247.0 |
| Beam height | 100.7 to 122.3 in | 20 | 181.4 | 257.9 |
| Beam height | 122.4 to 142.4 in | 21 | 180.2 | 261.1 |
| Burial depth | 1.0 to 10.4 in | 20 | 181.6 | 247.0 |
| Burial depth | 11.4 to 22.1 in | 21 | 181.3 | 261.1 |
| Burial depth | 22.7 to 34.8 in | 20 | 174.9 | 214.2 |
| Burial depth | 35.2 to 47.7 in | 21 | 182.0 | 257.9 |
| Crossbar height | 12.8 to 26.4 in | 20 | 185.2 | 261.1 |
| Crossbar height | 29.2 to 46.1 in | 21 | 180.7 | 247.0 |
| Crossbar height | 46.6 to 60.0 in | 20 | 175.4 | 223.8 |
| Crossbar height | 61.4 to 116.6 in | 21 | 180.7 | 257.9 |

### Largest moment at a buried foot, joints pinned (in-lb)

82 instances. Smallest 391, median 1,207, largest 6,256.

Largest five:

- 6,256: draw 628 (splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam); at right-front-foot, Pushed toward the back, where the front foot lifts most (φ = 45.53°); Both feet fixed at grade
- 5,678: draw 400 (splay 12.8°, beam height 75.88, burial 13.59, crossbar height 23.27, beam length 216.69, 4x6 legs, 3-ply 2x8 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 44.53°); Both feet fixed at grade
- 5,292: draw 776 (splay 29.3°, beam height 75.44, burial 23.50, crossbar height 29.21, beam length 200.76, 4x6 legs, 2-ply 2x6 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 51.64°); Both feet fixed at grade
- 4,582: draw 50 (splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x6 legs, 3-ply 2x6 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 43.98°); Both feet fixed at grade
- 4,402: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 44.93°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 2,462 | 5,678 |
| Splay | 14.2 to 22.1 ° | 21 | 1,533 | 6,256 |
| Splay | 22.1 to 26.5 ° | 20 | 857 | 2,066 |
| Splay | 27.2 to 35.0 ° | 21 | 668 | 5,292 |
| Beam height | 61.6 to 74.4 in | 20 | 1,616 | 4,402 |
| Beam height | 75.4 to 100.2 in | 21 | 1,716 | 6,256 |
| Beam height | 100.7 to 122.3 in | 20 | 900 | 2,209 |
| Beam height | 122.4 to 142.4 in | 21 | 842 | 3,307 |
| Burial depth | 1.0 to 10.4 in | 20 | 1,008 | 2,345 |
| Burial depth | 11.4 to 22.1 in | 21 | 1,529 | 5,678 |
| Burial depth | 22.7 to 34.8 in | 20 | 1,708 | 6,256 |
| Burial depth | 35.2 to 47.7 in | 21 | 997 | 4,582 |
| Crossbar height | 12.8 to 26.4 in | 20 | 1,379 | 5,678 |
| Crossbar height | 29.2 to 46.1 in | 21 | 1,533 | 5,292 |
| Crossbar height | 46.6 to 60.0 in | 20 | 1,091 | 6,256 |
| Crossbar height | 61.4 to 116.6 in | 21 | 1,133 | 4,582 |

### Largest axial compression in a member, joints rigid (lb)

102 instances. Smallest 761.0, median 1,861.5, largest 4,698.8.

Largest five:

- 4,698.8: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x4 legs, 2-ply 2x6 beam); at right-front-leg-1, Pushed toward the front, where the back foot lifts most (φ = 41.45°); Both feet fixed at grade
- 4,695.8: draw 188 (splay 15.4°, beam height 129.76, burial 11.44, crossbar height 116.62, beam length 215.73, 4x4 legs, 2-ply 2x6 beam); at right-back-leg-1, Pushed toward the back, where the front foot lifts most (φ = 44.85°); Both feet fixed at grade
- 3,980.0: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam); at right-back-leg-1, Pushed toward the back, where the front foot lifts most (φ = 44.94°); Both feet fixed at grade
- 3,808.7: draw 628 (splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam); at right-front-leg-1, Pushed toward the front, where the back foot lifts most (φ = 45.68°); Both feet fixed at grade
- 3,803.8: draw 6 (splay 18.9°, beam height 134.11, burial 15.50, crossbar height 65.45, beam length 232.71, 4x6 legs, 2-ply 2x6 beam); at right-back-leg-1, Pushed toward the back, where the front foot lifts most (φ = 46.64°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 25 | 2,502.9 | 4,698.8 |
| Splay | 14.2 to 22.1 ° | 26 | 2,313.3 | 4,695.8 |
| Splay | 22.1 to 26.5 ° | 25 | 1,795.6 | 2,922.9 |
| Splay | 27.2 to 35.0 ° | 26 | 1,415.0 | 2,881.0 |
| Beam height | 61.6 to 76.7 in | 25 | 1,948.4 | 3,980.0 |
| Beam height | 78.9 to 100.1 in | 26 | 2,182.5 | 4,698.8 |
| Beam height | 100.2 to 120.9 in | 25 | 1,636.8 | 2,840.3 |
| Beam height | 121.7 to 142.4 in | 26 | 1,998.9 | 4,695.8 |
| Burial depth | 0.0 to 2.4 in | 25 | 1,795.6 | 3,801.7 |
| Burial depth | 2.5 to 18.0 in | 26 | 1,794.9 | 4,698.8 |
| Burial depth | 18.1 to 33.6 in | 25 | 2,114.5 | 3,980.0 |
| Burial depth | 33.6 to 47.7 in | 26 | 1,861.5 | 3,646.1 |
| Crossbar height | 12.8 to 29.6 in | 25 | 1,856.3 | 3,980.0 |
| Crossbar height | 30.8 to 46.6 in | 26 | 1,950.4 | 3,801.7 |
| Crossbar height | 47.0 to 64.8 in | 25 | 1,752.8 | 4,698.8 |
| Crossbar height | 65.5 to 120.9 in | 26 | 1,850.5 | 4,695.8 |

### Largest axial tension in a member, joints rigid (lb)

102 instances. Smallest 234.0, median 627.2, largest 2,397.4.

Largest five:

- 2,397.4: draw 188 (splay 15.4°, beam height 129.76, burial 11.44, crossbar height 116.62, beam length 215.73, 4x4 legs, 2-ply 2x6 beam); at right-back-leg-1, Pushed toward the front, where the back foot lifts most (φ = 44.83°); Both feet fixed at grade
- 2,035.9: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x4 legs, 2-ply 2x6 beam); at right-front-leg-1, Pushed toward the back, where the front foot lifts most (φ = 41.40°); Both feet fixed at grade
- 1,830.6: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam); at right-back-leg-1, Pushed toward the front, where the back foot lifts most (φ = 44.93°); Both feet fixed at grade
- 1,822.0: draw 625 (splay 14.2°, beam height 78.88, burial 34.38, crossbar height 26.44, beam length 175.06, 4x4 legs, 3-ply 2x8 beam); at left-back-leg-1, Pushed toward the front, where the back foot lifts most (φ = 44.88°); Both feet fixed at grade
- 1,790.1: draw 342 (splay 15.0°, beam height 122.54, burial 2.38, crossbar height 46.10, beam length 229.25, 4x4 legs, 2-ply 2x6 beam); at right-front-leg-1, Pushed toward the back, where the front foot lifts most (φ = 44.69°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 25 | 637.2 | 2,035.9 |
| Splay | 14.2 to 22.1 ° | 26 | 881.4 | 2,397.4 |
| Splay | 22.1 to 26.5 ° | 25 | 623.7 | 1,360.1 |
| Splay | 27.2 to 35.0 ° | 26 | 566.6 | 1,473.7 |
| Beam height | 61.6 to 76.7 in | 25 | 644.8 | 1,830.6 |
| Beam height | 78.9 to 100.1 in | 26 | 909.9 | 2,035.9 |
| Beam height | 100.2 to 120.9 in | 25 | 540.0 | 1,347.5 |
| Beam height | 121.7 to 142.4 in | 26 | 719.3 | 2,397.4 |
| Burial depth | 0.0 to 2.4 in | 25 | 553.2 | 1,790.1 |
| Burial depth | 2.5 to 18.0 in | 26 | 634.6 | 2,397.4 |
| Burial depth | 18.1 to 33.6 in | 25 | 637.2 | 1,830.6 |
| Burial depth | 33.6 to 47.7 in | 26 | 652.9 | 1,822.0 |
| Crossbar height | 12.8 to 29.6 in | 25 | 707.0 | 1,830.6 |
| Crossbar height | 30.8 to 46.6 in | 26 | 625.6 | 1,790.1 |
| Crossbar height | 47.0 to 64.8 in | 25 | 610.0 | 2,035.9 |
| Crossbar height | 65.5 to 120.9 in | 26 | 630.4 | 2,397.4 |

### Largest bending moment in a member, joints rigid (in-lb)

102 instances. Smallest 8,126, median 18,673, largest 32,734.

Largest five:

- 32,734: draw 28 (splay 11.7°, beam height 120.28, burial 20.13, crossbar height 52.06, beam length 234.22, 4x6 legs, 4x8 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 32,072: draw 737 (splay 24.8°, beam height 101.50, burial 0.00, crossbar height 29.63, beam length 187.17, 4x4 legs, 2-ply 2x8 beam); at beam-3, Bottom of the arc (φ = 0.00°); Both feet pinned on their pads
- 32,053: draw 299 (splay 34.8°, beam height 99.56, burial 0.00, crossbar height 82.44, beam length 235.29, 4x4 legs, 2-ply 2x6 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet pinned on their pads
- 31,645: draw 703 (splay 14.4°, beam height 133.45, burial 22.13, crossbar height 19.47, beam length 220.25, 4x6 legs, 3-ply 2x8 beam); at beam-2, Bottom of the arc (φ = 0.00°); Both feet fixed at grade
- 31,428: draw 191 (splay 28.1°, beam height 110.94, burial 35.22, crossbar height 17.53, beam length 222.25, 4x4 legs, 4x8 beam); at beam-4, Bottom of the arc (φ = 0.00°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 25 | 18,439 | 32,734 |
| Splay | 14.2 to 22.1 ° | 26 | 19,202 | 31,645 |
| Splay | 22.1 to 26.5 ° | 25 | 19,132 | 32,072 |
| Splay | 27.2 to 35.0 ° | 26 | 17,945 | 32,053 |
| Beam height | 61.6 to 76.7 in | 25 | 16,776 | 30,516 |
| Beam height | 78.9 to 100.1 in | 26 | 19,948 | 32,053 |
| Beam height | 100.2 to 120.9 in | 25 | 18,791 | 32,734 |
| Beam height | 121.7 to 142.4 in | 26 | 18,338 | 31,645 |
| Burial depth | 0.0 to 2.4 in | 25 | 19,842 | 32,072 |
| Burial depth | 2.5 to 18.0 in | 26 | 20,420 | 29,378 |
| Burial depth | 18.1 to 33.6 in | 25 | 17,286 | 32,734 |
| Burial depth | 33.6 to 47.7 in | 26 | 17,071 | 31,428 |
| Crossbar height | 12.8 to 29.6 in | 25 | 17,286 | 32,072 |
| Crossbar height | 30.8 to 46.6 in | 26 | 19,778 | 30,516 |
| Crossbar height | 47.0 to 64.8 in | 25 | 19,132 | 32,734 |
| Crossbar height | 65.5 to 120.9 in | 26 | 18,514 | 32,053 |

### Largest downward load on a foot, joints rigid (lb)

102 instances. Smallest 317.6, median 388.8, largest 1,119.9.

Largest five:

- 1,119.9: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x4 legs, 2-ply 2x6 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 40.91°); Both feet fixed at grade
- 1,024.1: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x6 beam); at left-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.15°); Both feet fixed at grade
- 980.4: draw 440 (splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x6 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.52°); Both feet fixed at grade
- 886.7: draw 239 (splay 10.0°, beam height 76.69, burial 0.00, crossbar height 58.00, beam length 213.50, 4x4 legs, 4x8 beam); at left-front-foot, Pushed toward the front, where the back foot lifts most (φ = 42.88°); The lifting back feet released
- 846.9: draw 533 (splay 8.1°, beam height 131.00, burial 47.65, crossbar height 66.24, beam length 204.44, 4x4 legs, 3-ply 2x6 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 41.68°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 25 | 649.7 | 1,119.9 |
| Splay | 14.2 to 22.1 ° | 26 | 491.1 | 641.2 |
| Splay | 22.1 to 26.5 ° | 25 | 354.7 | 408.2 |
| Splay | 27.2 to 35.0 ° | 26 | 352.7 | 382.3 |
| Beam height | 61.6 to 76.7 in | 25 | 369.9 | 980.4 |
| Beam height | 78.9 to 100.1 in | 26 | 397.9 | 815.0 |
| Beam height | 100.2 to 120.9 in | 25 | 386.5 | 774.7 |
| Beam height | 121.7 to 142.4 in | 26 | 402.8 | 1,119.9 |
| Burial depth | 0.0 to 2.4 in | 25 | 408.2 | 886.7 |
| Burial depth | 2.5 to 18.0 in | 26 | 374.0 | 1,119.9 |
| Burial depth | 18.1 to 33.6 in | 25 | 480.9 | 1,024.1 |
| Burial depth | 33.6 to 47.7 in | 26 | 374.7 | 846.9 |
| Crossbar height | 12.8 to 29.6 in | 25 | 369.9 | 679.5 |
| Crossbar height | 30.8 to 46.6 in | 26 | 419.5 | 1,119.9 |
| Crossbar height | 47.0 to 64.8 in | 25 | 371.5 | 886.7 |
| Crossbar height | 65.5 to 120.9 in | 26 | 485.4 | 1,024.1 |

### Largest pull on a foot, joints rigid (lb)

102 instances. Smallest 22.3, median 131.4, largest 749.3.

Largest five:

- 749.3: draw 500 (splay 6.7°, beam height 132.88, burial 13.44, crossbar height 43.38, beam length 229.36, 4x4 legs, 2-ply 2x6 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 40.91°); Both feet fixed at grade
- 655.9: draw 644 (splay 6.8°, beam height 129.72, burial 27.90, crossbar height 91.94, beam length 168.63, 4x6 legs, 2-ply 2x6 beam); at left-front-foot, Pushed toward the back, where the front foot lifts most (φ = 41.19°); Both feet fixed at grade
- 578.8: draw 440 (splay 6.9°, beam height 74.44, burial 20.96, crossbar height 41.68, beam length 237.63, 4x4 legs, 4x6 beam); at right-back-foot, Pushed toward the front, where the back foot lifts most (φ = 41.52°); Both feet fixed at grade
- 503.8: draw 533 (splay 8.1°, beam height 131.00, burial 47.65, crossbar height 66.24, beam length 204.44, 4x4 legs, 3-ply 2x6 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 41.72°); Both feet fixed at grade
- 500.7: draw 239 (splay 10.0°, beam height 76.69, burial 0.00, crossbar height 58.00, beam length 213.50, 4x4 legs, 4x8 beam); at left-back-foot, Pushed toward the front, where the back foot lifts most (φ = 42.88°); The lifting back feet released

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 25 | 319.6 | 749.3 |
| Splay | 14.2 to 22.1 ° | 26 | 192.1 | 281.3 |
| Splay | 22.1 to 26.5 ° | 25 | 103.6 | 158.1 |
| Splay | 27.2 to 35.0 ° | 26 | 56.7 | 79.6 |
| Beam height | 61.6 to 76.7 in | 25 | 124.0 | 578.8 |
| Beam height | 78.9 to 100.1 in | 26 | 148.9 | 498.7 |
| Beam height | 100.2 to 120.9 in | 25 | 127.8 | 444.9 |
| Beam height | 121.7 to 142.4 in | 26 | 132.3 | 749.3 |
| Burial depth | 0.0 to 2.4 in | 25 | 170.7 | 500.7 |
| Burial depth | 2.5 to 18.0 in | 26 | 111.6 | 749.3 |
| Burial depth | 18.1 to 33.6 in | 25 | 183.0 | 655.9 |
| Burial depth | 33.6 to 47.7 in | 26 | 104.2 | 503.8 |
| Crossbar height | 12.8 to 29.6 in | 25 | 120.0 | 353.5 |
| Crossbar height | 30.8 to 46.6 in | 26 | 168.7 | 749.3 |
| Crossbar height | 47.0 to 64.8 in | 25 | 95.7 | 500.7 |
| Crossbar height | 65.5 to 120.9 in | 26 | 198.4 | 655.9 |

### Largest horizontal force on a foot, joints rigid (lb)

102 instances. Smallest 163.9, median 223.8, largest 346.3.

Largest five:

- 346.3: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.94°); Both feet fixed at grade
- 329.8: draw 628 (splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 45.68°); Both feet fixed at grade
- 318.7: draw 50 (splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x6 legs, 3-ply 2x6 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.05°); Both feet fixed at grade
- 311.5: draw 400 (splay 12.8°, beam height 75.88, burial 13.59, crossbar height 23.27, beam length 216.69, 4x6 legs, 3-ply 2x8 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.74°); Both feet fixed at grade
- 307.1: draw 239 (splay 10.0°, beam height 76.69, burial 0.00, crossbar height 58.00, beam length 213.50, 4x4 legs, 4x8 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 42.94°); The lifting front feet released

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 25 | 245.4 | 346.3 |
| Splay | 14.2 to 22.1 ° | 26 | 233.1 | 329.8 |
| Splay | 22.1 to 26.5 ° | 25 | 206.3 | 270.4 |
| Splay | 27.2 to 35.0 ° | 26 | 216.0 | 263.8 |
| Beam height | 61.6 to 76.7 in | 25 | 232.4 | 346.3 |
| Beam height | 78.9 to 100.1 in | 26 | 236.3 | 329.8 |
| Beam height | 100.2 to 120.9 in | 25 | 206.3 | 280.5 |
| Beam height | 121.7 to 142.4 in | 26 | 215.1 | 257.3 |
| Burial depth | 0.0 to 2.4 in | 25 | 249.9 | 307.1 |
| Burial depth | 2.5 to 18.0 in | 26 | 213.3 | 311.5 |
| Burial depth | 18.1 to 33.6 in | 25 | 216.2 | 346.3 |
| Burial depth | 33.6 to 47.7 in | 26 | 220.8 | 318.7 |
| Crossbar height | 12.8 to 29.6 in | 25 | 223.7 | 346.3 |
| Crossbar height | 30.8 to 46.6 in | 26 | 234.3 | 289.8 |
| Crossbar height | 47.0 to 64.8 in | 25 | 206.6 | 329.8 |
| Crossbar height | 65.5 to 120.9 in | 26 | 233.6 | 318.7 |

### Largest moment at a buried foot, joints rigid (in-lb)

82 instances. Smallest 1,083, median 3,656, largest 9,517.

Largest five:

- 9,517: draw 50 (splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x6 legs, 3-ply 2x6 beam); at left-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.05°); Both feet fixed at grade
- 9,020: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x4 legs, 2-ply 2x6 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 41.45°); Both feet fixed at grade
- 8,852: draw 628 (splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam); at right-front-foot, Pushed toward the front, where the back foot lifts most (φ = 45.68°); Both feet fixed at grade
- 7,679: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.94°); Both feet fixed at grade
- 7,574: draw 400 (splay 12.8°, beam height 75.88, burial 13.59, crossbar height 23.27, beam length 216.69, 4x6 legs, 3-ply 2x8 beam); at right-back-foot, Pushed toward the back, where the front foot lifts most (φ = 44.74°); Both feet fixed at grade

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | 5,995 | 9,517 |
| Splay | 14.2 to 22.1 ° | 21 | 5,066 | 8,852 |
| Splay | 22.1 to 26.5 ° | 20 | 3,274 | 5,026 |
| Splay | 27.2 to 35.0 ° | 21 | 2,607 | 5,000 |
| Beam height | 61.6 to 74.4 in | 20 | 4,185 | 7,679 |
| Beam height | 75.4 to 100.2 in | 21 | 4,582 | 9,517 |
| Beam height | 100.7 to 122.3 in | 20 | 3,058 | 5,654 |
| Beam height | 122.4 to 142.4 in | 21 | 3,621 | 7,542 |
| Burial depth | 1.0 to 10.4 in | 20 | 3,511 | 7,131 |
| Burial depth | 11.4 to 22.1 in | 21 | 4,670 | 9,020 |
| Burial depth | 22.7 to 34.8 in | 20 | 3,944 | 8,852 |
| Burial depth | 35.2 to 47.7 in | 21 | 3,409 | 9,517 |
| Crossbar height | 12.8 to 26.4 in | 20 | 3,509 | 7,679 |
| Crossbar height | 29.2 to 46.1 in | 21 | 4,582 | 7,372 |
| Crossbar height | 46.6 to 60.0 in | 20 | 3,716 | 9,020 |
| Crossbar height | 61.4 to 116.6 in | 21 | 3,459 | 9,517 |

### Spread of the largest compression: rigid against pinned (of pinned)

82 instances. Smallest +44.50%, median +305.92%, largest +663.76%.

Largest five:

- +663.76%: draw 188 (splay 15.4°, beam height 129.76, burial 11.44, crossbar height 116.62, beam length 215.73, 4x4 legs, 2-ply 2x6 beam)
- +632.29%: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam)
- +632.19%: draw 6 (splay 18.9°, beam height 134.11, burial 15.50, crossbar height 65.45, beam length 232.71, 4x6 legs, 2-ply 2x6 beam)
- +601.52%: draw 628 (splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam)
- +592.91%: draw 229 (splay 20.6°, beam height 90.27, burial 2.54, crossbar height 33.25, beam length 212.63, 4x4 legs, 2-ply 2x6 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | +280.99% | +632.29% |
| Splay | 14.2 to 22.1 ° | 21 | +403.59% | +663.76% |
| Splay | 22.1 to 26.5 ° | 20 | +349.04% | +516.20% |
| Splay | 27.2 to 35.0 ° | 21 | +251.40% | +541.57% |
| Beam height | 61.6 to 74.4 in | 20 | +330.26% | +632.29% |
| Beam height | 75.4 to 100.2 in | 21 | +346.62% | +601.52% |
| Beam height | 100.7 to 122.3 in | 20 | +283.79% | +423.20% |
| Beam height | 122.4 to 142.4 in | 21 | +293.56% | +663.76% |
| Burial depth | 1.0 to 10.4 in | 20 | +297.87% | +592.91% |
| Burial depth | 11.4 to 22.1 in | 21 | +324.98% | +663.76% |
| Burial depth | 22.7 to 34.8 in | 20 | +299.98% | +632.29% |
| Burial depth | 35.2 to 47.7 in | 21 | +329.08% | +541.57% |
| Crossbar height | 12.8 to 26.4 in | 20 | +330.26% | +632.29% |
| Crossbar height | 29.2 to 46.1 in | 21 | +302.41% | +592.91% |
| Crossbar height | 46.6 to 60.0 in | 20 | +305.92% | +601.52% |
| Crossbar height | 61.4 to 116.6 in | 21 | +283.23% | +663.76% |

### Spread of the largest bending moment: rigid against pinned (of pinned)

82 instances. Smallest -49.53%, median -36.50%, largest -13.09%.

Largest five:

- -13.09%: draw 510 (splay 25.8°, beam height 136.96, burial 7.44, crossbar height 62.25, beam length 142.43, 4x4 legs, 3-ply 2x8 beam)
- -16.05%: draw 159 (splay 16.0°, beam height 124.01, burial 31.91, crossbar height 80.30, beam length 134.95, 4x4 legs, 4x8 beam)
- -17.33%: draw 353 (splay 33.6°, beam height 142.42, burial 8.20, crossbar height 44.00, beam length 151.93, 4x4 legs, 3-ply 2x6 beam)
- -17.51%: draw 316 (splay 32.1°, beam height 100.06, burial 21.64, crossbar height 59.81, beam length 127.44, 4x6 legs, 3-ply 2x8 beam)
- -17.52%: draw 55 (splay 22.1°, beam height 107.50, burial 4.79, crossbar height 50.61, beam length 94.62, 4x6 legs, 3-ply 2x8 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | -44.26% | -27.37% |
| Splay | 14.2 to 22.1 ° | 21 | -39.41% | -16.05% |
| Splay | 22.1 to 26.5 ° | 20 | -34.79% | -13.09% |
| Splay | 27.2 to 35.0 ° | 21 | -28.54% | -17.33% |
| Beam height | 61.6 to 74.4 in | 20 | -41.91% | -28.70% |
| Beam height | 75.4 to 100.2 in | 21 | -36.58% | -17.51% |
| Beam height | 100.7 to 122.3 in | 20 | -30.38% | -17.52% |
| Beam height | 122.4 to 142.4 in | 21 | -34.22% | -13.09% |
| Burial depth | 1.0 to 10.4 in | 20 | -28.62% | -13.09% |
| Burial depth | 11.4 to 22.1 in | 21 | -36.49% | -17.51% |
| Burial depth | 22.7 to 34.8 in | 20 | -41.09% | -16.05% |
| Burial depth | 35.2 to 47.7 in | 21 | -37.28% | -21.80% |
| Crossbar height | 12.8 to 26.4 in | 20 | -33.86% | -21.51% |
| Crossbar height | 29.2 to 46.1 in | 21 | -36.49% | -17.33% |
| Crossbar height | 46.6 to 60.0 in | 20 | -36.89% | -17.51% |
| Crossbar height | 61.4 to 116.6 in | 21 | -36.38% | -13.09% |

### Spread of the largest pull on a foot: rigid against pinned (of pinned)

82 instances. Smallest -3.79%, median +2.60%, largest +8.27%.

Largest five:

- +8.27%: draw 367 (splay 5.5°, beam height 73.05, burial 30.01, crossbar height 52.69, beam length 160.96, 4x6 legs, 4x6 beam)
- +8.14%: draw 189 (splay 26.5°, beam height 83.31, burial 38.19, crossbar height 51.08, beam length 166.08, 4x6 legs, 3-ply 2x6 beam)
- +7.84%: draw 764 (splay 33.3°, beam height 98.01, burial 5.88, crossbar height 40.09, beam length 196.95, 4x6 legs, 4x8 beam)
- +7.77%: draw 316 (splay 32.1°, beam height 100.06, burial 21.64, crossbar height 59.81, beam length 127.44, 4x6 legs, 3-ply 2x8 beam)
- +7.67%: draw 625 (splay 14.2°, beam height 78.88, burial 34.38, crossbar height 26.44, beam length 175.06, 4x4 legs, 3-ply 2x8 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | +2.57% | +8.27% |
| Splay | 14.2 to 22.1 ° | 21 | +2.24% | +7.67% |
| Splay | 22.1 to 26.5 ° | 20 | +3.09% | +8.14% |
| Splay | 27.2 to 35.0 ° | 21 | +3.33% | +7.84% |
| Beam height | 61.6 to 74.4 in | 20 | +3.03% | +8.27% |
| Beam height | 75.4 to 100.2 in | 21 | +3.10% | +8.14% |
| Beam height | 100.7 to 122.3 in | 20 | +2.87% | +7.51% |
| Beam height | 122.4 to 142.4 in | 21 | +2.28% | +6.99% |
| Burial depth | 1.0 to 10.4 in | 20 | +3.06% | +7.84% |
| Burial depth | 11.4 to 22.1 in | 21 | +3.53% | +7.77% |
| Burial depth | 22.7 to 34.8 in | 20 | +2.03% | +8.27% |
| Burial depth | 35.2 to 47.7 in | 21 | +2.27% | +8.14% |
| Crossbar height | 12.8 to 26.4 in | 20 | +3.55% | +7.67% |
| Crossbar height | 29.2 to 46.1 in | 21 | +4.27% | +7.84% |
| Crossbar height | 46.6 to 60.0 in | 20 | +2.46% | +8.27% |
| Crossbar height | 61.4 to 116.6 in | 21 | +1.80% | +5.28% |

### Spread of the largest horizontal force on a foot: rigid against pinned (of pinned)

82 instances. Smallest -20.63%, median +13.38%, largest +103.57%.

Largest five:

- +103.57%: draw 302 (splay 7.3°, beam height 92.58, burial 11.94, crossbar height 51.25, beam length 185.31, 4x4 legs, 2-ply 2x6 beam)
- +100.72%: draw 363 (splay 13.8°, beam height 66.83, burial 30.94, crossbar height 20.88, beam length 203.81, 4x4 legs, 3-ply 2x6 beam)
- +88.58%: draw 50 (splay 12.0°, beam height 92.07, burial 39.18, crossbar height 75.56, beam length 225.00, 4x6 legs, 3-ply 2x6 beam)
- +80.96%: draw 628 (splay 16.0°, beam height 92.34, burial 31.75, crossbar height 54.87, beam length 199.82, 4x6 legs, 2-ply 2x6 beam)
- +71.78%: draw 400 (splay 12.8°, beam height 75.88, burial 13.59, crossbar height 23.27, beam length 216.69, 4x6 legs, 3-ply 2x8 beam)

By quarter of each parameter:

| Parameter | Range | Instances | Median | Largest |
|---|---|---|---|---|
| Splay | 5.4 to 14.0 ° | 20 | +37.87% | +103.57% |
| Splay | 14.2 to 22.1 ° | 21 | +18.58% | +80.96% |
| Splay | 22.1 to 26.5 ° | 20 | +9.74% | +32.51% |
| Splay | 27.2 to 35.0 ° | 21 | +0.71% | +26.54% |
| Beam height | 61.6 to 74.4 in | 20 | +31.11% | +100.72% |
| Beam height | 75.4 to 100.2 in | 21 | +21.30% | +103.57% |
| Beam height | 100.7 to 122.3 in | 20 | +5.72% | +22.69% |
| Beam height | 122.4 to 142.4 in | 21 | +6.52% | +41.57% |
| Burial depth | 1.0 to 10.4 in | 20 | +7.61% | +71.25% |
| Burial depth | 11.4 to 22.1 in | 21 | +18.58% | +103.57% |
| Burial depth | 22.7 to 34.8 in | 20 | +14.24% | +100.72% |
| Burial depth | 35.2 to 47.7 in | 21 | +11.74% | +88.58% |
| Crossbar height | 12.8 to 26.4 in | 20 | +9.64% | +100.72% |
| Crossbar height | 29.2 to 46.1 in | 21 | +21.30% | +71.25% |
| Crossbar height | 46.6 to 60.0 in | 20 | +13.19% | +103.57% |
| Crossbar height | 61.4 to 116.6 in | 21 | +7.81% | +88.58% |

## Every analyzed instance

Sway in in/lb along the beam; forces in lb and moments in in-lb, largest over the swing load cases; "–" where the case is a mechanism or the value is zero. Leg is the largest |frame − P| / P over the support cases; uplift the largest |frame − core| in lb.

| Instance | Splay ° | Height | Burial | Crossbar | Sway pinned | Sway rigid | Compression p / r | Moment p / r | Foot down p / r | Foot pull p / r | Foot horizontal p / r | Leg vs P p / r | Uplift vs core |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Example: Worked example, every input entered | 20.0 | 96.00 | 24.00 | 40.00 | 0.006076 | 0.001641 | 420 / 1,085 | 15,750 / 10,533 | 389 / 395 | 151 / 157 | 162 / 164 | 0.02% / 0.20% | – |
| Example: Two-ply 2x6 beam on pads, level ground, footprint depth | 19.9 | 96.00 | 0.00 | 40.00 | mechanism along the beam | 0.006707 | – / 1,661 | – / 10,984 | – / 406 | – / 171 | – / 234 | – / 0.07% | 0.00 |
| draw 6 | 18.9 | 134.11 | 15.50 | 65.45 | 0.009808 | 0.003512 | 520 / 3,804 | 39,934 / 22,207 | 485 / 492 | 189 / 195 | 193 / 256 | 0.34% / 0.94% | – |
| draw 12 | 32.8 | 76.04 | 0.00 | 37.61 | mechanism along the beam | 0.002818 | – / 1,155 | – / 14,272 | – / 326 | – / 56 | – / 206 | – / 0.59% | 0.16 |
| draw 13 | 25.1 | 128.94 | 0.00 | 38.21 | mechanism along the beam | 0.01543 | – / 1,094 | – / 15,638 | – / 377 | – / 113 | – / 245 | – / 0.44% | 0.80 |
| draw 21 | 19.6 | 113.81 | 0.00 | 28.25 | mechanism along the beam | 0.01055 | – / 1,224 | – / 13,209 | – / 451 | – / 189 | – / 250 | – / 0.27% | 0.78 |
| draw 28 | 11.7 | 120.28 | 20.13 | 52.06 | 0.006771 | 0.001947 | 662 / 2,669 | 48,225 / 32,734 | 642 / 650 | 304 / 312 | 171 / 207 | 0.13% / 0.27% | – |
| draw 32 | 21.0 | 120.25 | 42.04 | 13.69 | 0.007839 | 0.002103 | 493 / 1,429 | 26,080 / 18,556 | 454 / 456 | 152 / 154 | 192 / 188 | 0.32% / 2.48% | – |
| draw 34 | 17.1 | 98.56 | 22.69 | 37.56 | 0.006383 | 0.001564 | 517 / 2,115 | 23,019 / 17,448 | 486 / 494 | 175 / 183 | 183 / 206 | 0.16% / 0.12% | – |
| draw 43 | 18.0 | 125.81 | 0.98 | 97.06 | 0.01282 | 0.003542 | 575 / 1,796 | 23,877 / 17,329 | 540 / 547 | 218 / 224 | 199 / 214 | 0.65% / 0.84% | – |
| draw 50 | 12.0 | 92.07 | 39.18 | 75.56 | 0.003044 | 0.001119 | 616 / 3,646 | 41,504 / 21,883 | 594 / 588 | 258 / 252 | 169 / 319 | 0.21% / 0.42% | – |
| draw 55 | 22.1 | 107.50 | 4.79 | 50.61 | 0.005733 | 0.00141 | 407 / 1,011 | 15,772 / 13,008 | 370 / 375 | 123 / 128 | 173 / 177 | 0.33% / 0.13% | – |
| draw 86 | 14.0 | 79.25 | 32.65 | 66.64 | 0.002081 | 0.0005701 | 504 / 1,331 | 12,635 / 8,126 | 481 / 481 | 209 / 209 | 155 / 174 | 0.02% / 0.15% | – |
| draw 91 | 21.9 | 112.12 | 33.62 | 78.75 | 0.00638 | 0.001767 | 461 / 1,440 | 31,988 / 23,136 | 420 / 424 | 135 / 138 | 191 / 203 | 0.43% / 0.46% | – |
| draw 99 | 21.2 | 65.44 | 20.75 | 24.41 | 0.002121 | 0.0005456 | 403 / 2,359 | 23,215 / 14,687 | 367 / 368 | 122 / 124 | 171 / 232 | 0.06% / 0.65% | – |
| draw 129 | 14.2 | 118.25 | 10.32 | 42.25 | 0.006651 | 0.001759 | 657 / 2,496 | 29,902 / 21,998 | 628 / 641 | 269 / 281 | 198 / 230 | 0.51% / 0.56% | – |
| draw 138 | 22.2 | 93.65 | 0.00 | 74.80 | mechanism along the beam | 0.006726 | – / 2,923 | – / 22,485 | – / 401 | – / 141 | – / 258 | – / 0.13% | 0.31 |
| draw 141 | 27.3 | 121.69 | 21.69 | 57.13 | 0.008791 | 0.002453 | 390 / 1,596 | 35,791 / 25,698 | 347 / 349 | 73 / 76 | 183 / 194 | 0.14% / 0.29% | – |
| draw 159 | 16.0 | 124.01 | 31.91 | 80.30 | 0.01228 | 0.003028 | 539 / 778 | 20,125 / 16,895 | 513 / 518 | 229 / 234 | 166 / 167 | 0.17% / 0.19% | – |
| draw 163 | 34.5 | 129.27 | 20.44 | 16.63 | 0.02098 | 0.005578 | 463 / 1,412 | 23,259 / 17,286 | 381 / 382 | 52 / 53 | 261 / 254 | 0.48% / 0.53% | – |
| draw 164 | 28.8 | 84.69 | 36.75 | 61.44 | 0.003201 | 0.0009686 | 376 / 1,042 | 18,673 / 11,843 | 330 / 331 | 62 / 63 | 181 / 185 | 0.14% / 0.47% | – |
| draw 165 | 13.4 | 122.43 | 44.69 | 101.14 | 0.007104 | 0.002558 | 660 / 3,364 | 33,296 / 18,237 | 636 / 643 | 313 / 319 | 182 / 245 | 0.43% / 1.03% | – |
| draw 171 | 24.9 | 100.17 | 37.34 | 47.60 | 0.004874 | 0.001414 | 418 / 1,867 | 36,816 / 24,449 | 379 / 382 | 93 / 96 | 196 / 219 | 0.30% / 0.50% | – |
| draw 174 | 17.0 | 76.56 | 0.00 | 30.88 | mechanism along the beam | 0.003228 | – / 1,839 | – / 29,172 | – / 530 | – / 228 | – / 267 | – / 0.15% | 0.75 |
| draw 188 | 15.4 | 129.76 | 11.44 | 116.62 | 0.01366 | 0.004321 | 615 / 4,696 | 40,673 / 24,642 | 588 / 596 | 274 / 280 | 180 / 243 | 0.31% / 0.77% | – |
| draw 189 | 26.5 | 83.31 | 38.19 | 51.08 | 0.00285 | 0.0008766 | 424 / 1,583 | 24,126 / 15,132 | 380 / 383 | 80 / 87 | 192 / 222 | 0.58% / 0.25% | – |
| draw 191 | 28.1 | 110.94 | 35.22 | 17.53 | 0.01136 | 0.002847 | 403 / 1,772 | 40,191 / 31,428 | 356 / 357 | 67 / 70 | 196 / 198 | 0.08% / 1.72% | – |
| draw 197 | 31.9 | 104.13 | 34.38 | 65.47 | 0.006575 | 0.001704 | 406 / 948 | 15,770 / 12,137 | 345 / 345 | 54 / 55 | 214 / 212 | 0.33% / 0.04% | – |
| draw 199 | 27.7 | 87.44 | 43.10 | 70.31 | 0.003382 | 0.00101 | 419 / 2,685 | 45,642 / 29,035 | 371 / 374 | 60 / 61 | 194 / 245 | 0.23% / 0.23% | – |
| draw 212 | 10.9 | 94.38 | 18.08 | 20.06 | 0.003212 | 0.001048 | 594 / 2,250 | 27,531 / 15,975 | 570 / 576 | 266 / 273 | 190 / 238 | 0.04% / 1.05% | – |
| draw 228 | 25.4 | 128.25 | 5.00 | 105.06 | 0.00984 | 0.00309 | 384 / 2,026 | 34,267 / 22,023 | 347 / 348 | 102 / 103 | 177 / 190 | 0.27% / 0.30% | – |
| draw 229 | 20.6 | 90.27 | 2.54 | 33.25 | 0.005082 | 0.00168 | 477 / 3,304 | 34,968 / 20,054 | 438 / 448 | 159 / 169 | 194 / 274 | 0.32% / 0.32% | – |
| draw 239 | 10.0 | 76.69 | 0.00 | 58.00 | mechanism along the beam | 0.003057 | – / 1,657 | – / 22,746 | – / 887 | – / 501 | – / 307 | – / 0.53% | 3.40 |
| draw 242 | 24.3 | 83.89 | 0.00 | 27.94 | mechanism along the beam | 0.004487 | – / 1,776 | – / 21,293 | – / 352 | – / 114 | – / 246 | – / 2.11% | 0.18 |
| draw 249 | 31.8 | 127.56 | 38.43 | 34.96 | 0.01194 | 0.003428 | 390 / 1,081 | 15,852 / 10,428 | 332 / 332 | 64 / 65 | 204 / 190 | 0.14% / 2.05% | – |
| draw 262 | 17.4 | 100.65 | 23.13 | 46.63 | 0.004234 | 0.001436 | 459 / 1,779 | 30,358 / 17,528 | 430 / 433 | 172 / 175 | 164 / 188 | 0.03% / 0.45% | – |
| draw 265 | 27.7 | 72.06 | 10.40 | 22.19 | 0.002069 | 0.0005317 | 404 / 1,418 | 24,354 / 17,363 | 358 / 359 | 58 / 62 | 185 / 196 | 0.09% / 3.89% | – |
| draw 281 | 22.2 | 117.11 | 46.66 | 55.19 | 0.01137 | 0.003352 | 423 / 2,138 | 31,129 / 19,132 | 388 / 391 | 132 / 135 | 171 / 184 | 0.12% / 0.07% | – |
| draw 282 | 27.2 | 139.38 | 7.06 | 30.81 | 0.01387 | 0.003698 | 394 / 1,549 | 33,464 / 24,600 | 350 / 351 | 77 / 80 | 178 / 175 | 0.02% / 3.21% | – |
| draw 287 | 18.7 | 136.19 | 0.00 | 120.88 | mechanism along the beam | 0.01419 | – / 1,972 | – / 19,158 | – / 490 | – / 202 | – / 257 | – / 0.17% | 0.60 |
| draw 291 | 29.4 | 117.88 | 39.96 | 60.00 | 0.01358 | 0.003725 | 364 / 1,245 | 15,924 / 10,111 | 317 / 318 | 67 / 69 | 179 / 181 | 0.02% / 0.23% | – |
| draw 299 | 34.8 | 99.56 | 0.00 | 82.44 | mechanism along the beam | 0.01239 | – / 2,881 | – / 32,053 | – / 344 | – / 46 | – / 249 | – / 0.02% | 0.13 |
| draw 302 | 7.3 | 92.58 | 11.94 | 51.25 | 0.004672 | 0.001569 | 833 / 4,699 | 36,686 / 20,087 | 821 / 815 | 505 / 499 | 150 / 306 | 0.03% / 0.09% | – |
| draw 308 | 10.3 | 61.88 | 7.94 | 47.00 | 0.0009486 | 0.0003631 | 546 / 1,500 | 19,173 / 10,790 | 528 / 533 | 240 / 245 | 155 / 209 | 0.13% / 0.16% | – |
| draw 314 | 9.8 | 71.94 | 24.00 | 56.44 | 0.001449 | 0.0005138 | 640 / 2,503 | 26,323 / 13,839 | 621 / 625 | 286 / 290 | 172 / 288 | 0.46% / 0.76% | – |
| draw 316 | 32.1 | 100.06 | 21.64 | 59.81 | 0.005968 | 0.001497 | 423 / 1,070 | 23,410 / 19,310 | 358 / 359 | 46 / 50 | 224 / 221 | 0.37% / 0.12% | – |
| draw 331 | 11.5 | 102.64 | 12.87 | 16.38 | 0.006739 | 0.001726 | 686 / 1,186 | 19,416 / 14,101 | 665 / 680 | 339 / 354 | 171 / 170 | 0.20% / 0.05% | – |
| draw 337 | 8.8 | 98.75 | 0.00 | 69.75 | mechanism along the beam | 0.004315 | – / 1,905 | – / 19,842 | – / 812 | – / 476 | – / 257 | – / 0.04% | 0.22 |
| draw 342 | 15.0 | 122.54 | 2.38 | 46.10 | 0.0115 | 0.003715 | 589 / 3,802 | 35,463 / 20,298 | 564 / 572 | 261 / 269 | 171 / 237 | 0.16% / 0.18% | – |
| draw 350 | 34.0 | 120.88 | 21.26 | 36.81 | 0.01618 | 0.004432 | 416 / 1,194 | 24,593 / 18,832 | 345 / 346 | 39 / 42 | 232 / 231 | 0.18% / 0.21% | – |
| draw 353 | 33.6 | 142.42 | 8.20 | 44.00 | 0.02619 | 0.006931 | 447 / 999 | 21,627 / 17,880 | 372 / 373 | 51 / 55 | 247 / 246 | 0.56% / 0.46% | – |
| draw 363 | 13.8 | 66.83 | 30.94 | 20.88 | 0.00194 | 0.0006394 | 543 / 3,980 | 33,124 / 16,776 | 519 / 522 | 209 / 212 | 173 / 346 | 0.08% / 1.11% | – |
| draw 364 | 26.3 | 94.32 | 19.89 | 31.63 | 0.006632 | 0.001966 | 390 / 2,371 | 37,396 / 23,749 | 350 / 352 | 77 / 82 | 180 / 224 | 0.09% / 1.53% | – |
| draw 367 | 5.5 | 73.05 | 30.01 | 52.69 | 0.001485 | 0.0005348 | 801 / 1,805 | 26,017 / 14,194 | 790 / 829 | 444 / 481 | 155 / 196 | 0.37% / 0.81% | – |
| draw 379 | 5.4 | 67.50 | 36.94 | 40.80 | 0.001174 | 0.0003794 | 740 / 2,172 | 18,172 / 9,519 | 728 / 738 | 382 / 392 | 163 / 243 | 0.45% / 0.74% | – |
| draw 390 | 30.3 | 108.81 | 0.00 | 71.94 | mechanism along the beam | 0.007297 | – / 887 | – / 14,036 | – / 351 | – / 64 | – / 219 | – / 0.28% | 0.37 |
| draw 400 | 12.8 | 75.88 | 13.59 | 23.27 | 0.001792 | 0.0005328 | 530 / 2,791 | 32,491 / 18,910 | 506 / 497 | 183 / 176 | 181 / 312 | 0.05% / 0.09% | – |
| draw 410 | 13.7 | 98.61 | 0.00 | 74.27 | mechanism along the beam | 0.004435 | – / 1,171 | – / 14,603 | – / 582 | – / 281 | – / 250 | – / 0.07% | 0.33 |
| draw 418 | 23.9 | 70.81 | 16.75 | 25.56 | 0.00274 | 0.0007161 | 389 / 1,679 | 30,806 / 21,439 | 346 / 348 | 94 / 98 | 187 / 216 | 0.16% / 0.28% | – |
| draw 434 | 30.8 | 142.03 | 11.81 | 115.75 | 0.01504 | 0.004389 | 414 / 1,123 | 22,841 / 16,571 | 355 / 356 | 73 / 74 | 211 / 213 | 0.52% / 0.49% | – |
| draw 435 | 35.0 | 68.00 | 42.63 | 20.12 | 0.002193 | 0.0006399 | 433 / 1,856 | 34,945 / 21,766 | 355 / 360 | 21 / 22 | 245 / 194 | 0.27% / 14.26% | – |
| draw 440 | 6.9 | 74.44 | 20.96 | 41.68 | 0.002465 | 0.0008782 | 967 / 3,515 | 38,624 / 20,114 | 952 / 980 | 554 / 579 | 191 / 290 | 0.50% / 1.43% | – |
| draw 464 | 26.2 | 74.41 | 18.00 | 34.75 | 0.002125 | 0.0005916 | 389 / 1,910 | 34,880 / 23,357 | 349 / 354 | 72 / 74 | 181 / 214 | 0.17% / 1.72% | – |
| draw 487 | 12.2 | 122.33 | 23.13 | 44.53 | 0.007003 | 0.002478 | 655 / 2,915 | 41,647 / 22,989 | 633 / 643 | 310 / 320 | 176 / 216 | 0.19% / 0.54% | – |
| draw 500 | 6.7 | 132.88 | 13.44 | 43.38 | 0.01345 | 0.00433 | 1,093 / 3,680 | 32,031 / 18,439 | 1,080 / 1,120 | 711 / 749 | 169 / 238 | 0.31% / 0.61% | – |
| draw 510 | 25.8 | 136.96 | 7.44 | 62.25 | 0.01988 | 0.004796 | 362 / 1,457 | 26,513 / 23,044 | 326 / 326 | 85 / 87 | 167 / 172 | 0.02% / 0.12% | – |
| draw 520 | 31.3 | 138.79 | 1.27 | 58.44 | 0.02343 | 0.006841 | 376 / 2,170 | 38,480 / 26,321 | 322 / 322 | 60 / 61 | 195 / 201 | 0.00% / 0.61% | – |
| draw 533 | 8.1 | 131.00 | 47.65 | 66.24 | 0.01298 | 0.003884 | 841 / 3,224 | 37,530 / 23,658 | 828 / 847 | 485 / 504 | 158 / 224 | 0.08% / 0.17% | – |
| draw 548 | 22.1 | 80.96 | 41.37 | 57.56 | 0.00242 | 0.0008232 | 375 / 2,267 | 28,589 / 14,429 | 339 / 335 | 92 / 89 | 163 / 231 | 0.00% / 0.88% | – |
| draw 554 | 7.0 | 70.33 | 1.79 | 34.50 | 0.002185 | 0.0006078 | 838 / 3,371 | 48,275 / 30,516 | 825 / 845 | 459 / 478 | 157 / 270 | 0.18% / 0.47% | – |
| draw 563 | 33.0 | 129.69 | 0.00 | 64.75 | mechanism along the beam | 0.01322 | – / 761 | – / 16,529 | – / 355 | – / 57 | – / 229 | – / 0.23% | 0.38 |
| draw 566 | 22.3 | 67.50 | 39.81 | 18.69 | 0.002367 | 0.0005711 | 401 / 1,134 | 16,975 / 11,716 | 361 / 367 | 110 / 117 | 182 / 183 | 0.12% / 0.76% | – |
| draw 576 | 25.4 | 84.85 | 9.37 | 25.66 | 0.002987 | 0.0007525 | 383 / 985 | 15,044 / 11,807 | 346 / 348 | 79 / 84 | 192 / 192 | 0.28% / 0.23% | – |
| draw 579 | 22.3 | 90.00 | 13.69 | 24.36 | 0.005276 | 0.001554 | 389 / 1,655 | 26,564 / 16,676 | 353 / 355 | 117 / 120 | 168 / 179 | 0.05% / 1.18% | – |
| draw 594 | 12.3 | 73.06 | 34.75 | 12.75 | 0.001546 | 0.0005829 | 573 / 1,948 | 25,687 / 13,319 | 544 / 553 | 240 / 249 | 203 / 229 | 0.30% / 0.49% | – |
| draw 595 | 9.4 | 106.16 | 0.00 | 84.65 | mechanism along the beam | 0.005329 | – / 1,604 | – / 23,614 | – / 775 | – / 445 | – / 251 | – / 0.01% | 0.07 |
| draw 613 | 13.8 | 101.24 | 0.00 | 35.32 | mechanism along the beam | 0.006249 | – / 2,000 | – / 19,502 | – / 632 | – / 309 | – / 281 | – / 0.04% | 1.18 |
| draw 615 | 34.1 | 89.94 | 0.00 | 15.64 | mechanism along the beam | 0.008155 | – / 2,503 | – / 23,576 | – / 365 | – / 38 | – / 224 | – / 3.31% | 0.15 |
| draw 617 | 24.4 | 118.69 | 0.00 | 103.42 | mechanism along the beam | 0.01341 | – / 1,796 | – / 15,548 | – / 408 | – / 158 | – / 263 | – / 0.71% | 1.29 |
| draw 625 | 14.2 | 78.88 | 34.38 | 26.44 | 0.003248 | 0.0008053 | 603 / 3,189 | 34,324 / 25,149 | 575 / 594 | 236 / 255 | 184 / 268 | 0.34% / 0.14% | – |
| draw 628 | 16.0 | 92.34 | 31.75 | 54.87 | 0.003183 | 0.001285 | 543 / 3,809 | 41,961 / 21,706 | 514 / 514 | 215 / 213 | 182 / 330 | 0.33% / 1.18% | – |
| draw 629 | 26.2 | 111.69 | 5.27 | 52.88 | 0.006919 | 0.001924 | 384 / 1,623 | 40,044 / 29,378 | 344 / 346 | 81 / 84 | 178 / 192 | 0.12% / 0.68% | – |
| draw 633 | 34.7 | 104.38 | 41.63 | 82.71 | 0.007051 | 0.002224 | 454 / 1,637 | 29,383 / 18,791 | 373 / 375 | 44 / 46 | 258 / 264 | 0.45% / 0.03% | – |
| draw 644 | 6.8 | 129.72 | 27.90 | 91.94 | 0.007955 | 0.002632 | 1,023 / 3,018 | 25,885 / 14,932 | 1,010 / 1,024 | 644 / 656 | 174 / 209 | 0.58% / 1.11% | – |
| draw 645 | 22.7 | 63.50 | 44.74 | 26.38 | 0.00194 | 0.0006093 | 384 / 1,841 | 26,343 / 15,011 | 346 / 352 | 110 / 115 | 169 / 204 | 0.12% / 1.35% | – |
| draw 648 | 32.3 | 134.88 | 2.37 | 59.13 | 0.01454 | 0.003886 | 396 / 1,489 | 25,202 / 18,010 | 335 / 335 | 45 / 46 | 211 / 205 | 0.02% / 1.20% | – |
| draw 652 | 17.6 | 117.31 | 37.39 | 88.25 | 0.006661 | 0.002109 | 557 / 1,696 | 24,667 / 14,894 | 524 / 529 | 218 / 221 | 191 / 201 | 0.64% / 0.98% | – |
| draw 654 | 14.6 | 85.51 | 0.00 | 58.00 | mechanism along the beam | 0.003021 | – / 3,284 | – / 27,011 | – / 547 | – / 233 | – / 300 | – / 0.02% | 0.27 |
| draw 657 | 16.2 | 67.00 | 2.96 | 31.44 | 0.00133 | 0.0003997 | 513 / 2,581 | 36,395 / 21,544 | 482 / 480 | 171 / 169 | 180 / 262 | 0.29% / 0.94% | – |
| draw 678 | 24.6 | 66.06 | 7.10 | 43.44 | 0.001417 | 0.0004023 | 380 / 1,912 | 33,476 / 21,916 | 346 / 350 | 78 / 78 | 177 / 229 | 0.24% / 0.57% | – |
| draw 679 | 23.8 | 113.15 | 3.76 | 63.43 | 0.006791 | 0.001908 | 411 / 2,150 | 40,876 / 27,832 | 370 / 371 | 98 / 100 | 183 / 206 | 0.16% / 0.24% | – |
| draw 694 | 24.8 | 108.45 | 24.19 | 49.30 | 0.009621 | 0.002736 | 404 / 1,753 | 26,382 / 17,137 | 362 / 366 | 113 / 117 | 180 / 188 | 0.32% / 0.11% | – |
| draw 697 | 24.6 | 66.56 | 47.44 | 53.94 | 0.002386 | 0.000622 | 369 / 2,276 | 23,786 / 14,604 | 336 / 336 | 87 / 87 | 169 / 223 | 0.09% / 0.13% | – |
| draw 703 | 14.4 | 133.45 | 22.13 | 19.47 | 0.009523 | 0.002634 | 623 / 2,898 | 43,259 / 31,645 | 596 / 605 | 243 / 252 | 188 / 223 | 0.18% / 1.22% | – |
| draw 729 | 33.2 | 63.44 | 40.44 | 41.63 | 0.00158 | 0.0005689 | 409 / 1,989 | 30,438 / 15,905 | 342 / 347 | 34 / 35 | 222 / 257 | 0.08% / 3.93% | – |
| draw 737 | 24.8 | 101.50 | 0.00 | 29.63 | mechanism along the beam | 0.008822 | – / 2,840 | – / 32,072 | – / 387 | – / 127 | – / 270 | – / 0.19% | 0.43 |
| draw 738 | 20.4 | 61.63 | 33.69 | 21.25 | 0.001057 | 0.0004105 | 404 / 2,663 | 36,924 / 19,246 | 366 / 365 | 112 / 113 | 185 / 283 | 0.17% / 2.00% | – |
| draw 756 | 25.2 | 113.44 | 33.56 | 78.69 | 0.006669 | 0.002194 | 360 / 1,627 | 24,523 / 14,872 | 326 / 328 | 102 / 104 | 167 / 190 | 0.18% / 0.02% | – |
| draw 764 | 33.3 | 98.01 | 5.88 | 40.09 | 0.005842 | 0.001573 | 453 / 1,286 | 28,047 / 20,753 | 379 / 381 | 40 / 43 | 247 / 235 | 0.31% / 1.67% | – |
| draw 776 | 29.3 | 75.44 | 23.50 | 29.21 | 0.002231 | 0.0008611 | 411 / 2,441 | 30,805 / 15,782 | 359 / 370 | 64 / 67 | 199 / 242 | 0.24% / 2.30% | – |
| draw 781 | 23.6 | 125.12 | 32.06 | 91.88 | 0.01411 | 0.004177 | 406 / 2,102 | 28,913 / 17,373 | 367 / 368 | 116 / 117 | 172 / 184 | 0.12% / 0.10% | – |
| draw 793 | 19.5 | 128.55 | 11.65 | 13.34 | 0.009255 | 0.002654 | 455 / 2,538 | 24,227 / 14,138 | 424 / 423 | 148 / 147 | 168 / 179 | 0.11% / 3.99% | – |
