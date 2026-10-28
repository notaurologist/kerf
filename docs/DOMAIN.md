# Domain Knowledge

Status: Draft v0.5

Background for anyone (human or agent) working on this project. This is not authoritative woodworking or safety guidance. Where something is marked **expert check**, the app should flag it for review by an experienced woodworker. Sources are listed at the end; add a source for any new safety-relevant claim.

## Lumber basics

- **Nominal vs. actual size.** Dimensional lumber is named by nominal size, which is larger than its actual size (a "2x4" is about 1-1/2 x 3-1/2 inches). Cut lists and geometry must use actual dimensions; shopping lists use nominal names.
- **Buyable lengths.** Lumber is sold in standard lengths (commonly 8, 10, 12, 16 feet). Shopping lists group parts into these, allowing for the saw kerf on each cut (about 1/8 inch for a typical blade, configurable) and for trimming factory ends, which are often not square or have checks.
- **Species and treatment.** Outdoor projects need wood that resists rot and insects, either naturally (for example, cedar or redwood) or pressure-treated. [1]
- **Moisture and movement.** Wood expands and shrinks across the grain with humidity, far more than along its length. Pressure-treated lumber is often sold wet and shrinks as it dries. Designs that rigidly restrain cross-grain movement can crack. **Expert check** for any glued or tightly fastened cross-grain joints.
- **Grain and defects.** Board selection matters: straightness, knots (especially near edges or at joints), checks, and twist. The app should include board selection guidance for each part's role.

## Measuring and marking

- Measure from a consistent reference end and face.
- Mark cut lines with the waste side indicated; the saw kerf (blade width) comes out of the waste side.
- For repeated parts, cut one, verify it, then use it (or a stop block) to mark the rest.
- Angles can be laid out with a speed square or protractor; for repeated angles, a jig or set tool beats re-measuring.

## Operations

Operations are what needs to happen to a part. Methods are how, given specific tools. The knowledge base maps operations to methods.

| Operation | Example methods by tool |
|---|---|
| Crosscut (square) | Miter saw; circular saw with speed square or guide; hand saw |
| Angled crosscut (miter) | Miter saw set to angle; circular saw with speed square at angle |
| Bevel cut | Miter saw or circular saw with bevel; table saw with tilted blade |
| Rip (cut along the grain) | Table saw; circular saw with straightedge guide or rip fence |
| Bolt holes | Drill with spade or auger bit; drill guide for straight holes through thick stock |
| Counterbore (recess a bolt head or nut) | Forstner or spade bit, drilled before the through hole |
| Ease edges and splinters | Sander; block plane; router with roundover bit |

Each method in the knowledge base records: required tools, skills used, setup steps, technique steps, common mistakes, and any flags.

## Expert-check categories

The app flags steps and design choices in these categories:

- **Table saw operations,** especially ripping, dadoes, kickback risk, and anything involving the blade guard or riving knife.
- **Router technique:** feed direction, bit choice, table vs. handheld.
- **Jointers, planers, lathes.**
- **Load-bearing or tip-prone designs:** spans, sag, anchoring, wall mounting, anything people sit on, hang from, or climb.
- **Dynamic loads:** swings, hammocks, anything that moves under load. Forces exceed body weight.
- **Wood movement** in glued or rigid cross-grain construction.
- **Finishes:** rags soaked in oil-based finishes can spontaneously combust and must be disposed of properly; ventilation and product instructions apply.
- **Dust and species:** some woods are irritants or sensitizers; dust collection and respiratory protection.

## Structural checks

Kerf computes a limited set of well-understood checks and lists everything else for confirmation. Every check shows inputs, formula, assumptions, adjustment factors, and source. Formulas and design values must be verified against the sources before implementation, and every check needs unit tests with worked examples checked by hand.

### Computed (sanity checks)

- **Swing load.** For a rider of weight W swinging to a maximum angle θ from vertical, the total chain tension at the bottom of the arc is W(3 - 2cos θ). At θ = 90° (swinging up to horizontal) that is 3W. Riders swinging in sync add together. This is the smooth pendulum case only: snap loads from slack chains (bouncing, jerking) exceed it, so a user-confirmed dynamic factor is applied on top. No hidden default; the value is chosen with an experienced builder and shown on every result.
- **Per-hanger load.** Each swing hangs from two hangers. The swing load is split between them, assumed equal for a centered rider; the split is a stated assumption on every result that uses it.
- **Beam model.** Top beam as a simply supported span L, measured between the points where the A-frames support it (not necessarily the beam ends). Each hanger is a separate point load at its own position; positions do not have to be symmetric. Results come from superposition of the single-load cases. The symmetric two-load formulas below are kept as hand-check cases for the tests.
- **Beam bending.** Maximum moment occurs under one of the point loads; compute the moment at each load position from the support reactions and take the largest. Symmetric hand check: two equal loads P, each a distance a from its nearest support, M = P·a. Bending stress f_b = M / S (S = section modulus of the actual cross section), compared against the adjusted allowable bending stress for the species and grade.
- **Beam shear.** Maximum shear V is the larger support reaction (V = P in the symmetric case). Shear stress f_v = 3V / (2A) for a rectangular section, compared against the adjusted allowable shear stress.
- **Beam deflection.** Superpose the single-load deflection curve: for a load P a distance b from the right support, deflection at x (measured from the left support, left of the load) is P·b·x·(L² - b² - x²) / (6·E·I·L), mirrored for points right of the load. Evaluate along the span and take the maximum. Symmetric hand check: δ = P·a·(3L² - 4a²) / (24·E·I) at midspan. Deflection uses the pendulum load W(3 - 2cos θ) without the dynamic factor, since it describes normal use, not peak snap loads. Shown against a user-confirmed deflection limit (span divided by a number).
- **Adjustment factors.** Allowable stresses are the NDS reference design values with the factors that apply to a single outdoor beam: wet service (C_M), size (C_F), beam stability (C_L), and temperature (C_t) if relevant. Load duration C_D is 1.0; the NDS impact increase is not used. The repetitive-member factor C_r does not apply to a single beam. Every factor used is listed on the result.
- **Hardware load vs. rating.** Per-hanger load (with dynamic factor) compared against the manufacturer's rated working load for one hanger, shown as a margin.
- **Built-up beams.** Checked as one member with the combined section only under the conditions the design source sets for built-up members; verify those provisions in the NDS before implementing, and test with a two-ply worked example.
- **Results** are reported as margins under stated assumptions ("margin 2.1x" means the adjusted allowable value is 2.1 times the computed value), never as "safe" or "pass." There is no separate user safety factor; the margin is the number to judge with an experienced builder.

### Checklist only (not computed)

- Bolted connections: bolt size, spacing, edge and end distances, washers, load direction relative to grain.
- Racking: whether the A-frames and braces resist side-to-side and fore-aft swing forces.
- Tipping and anchoring: whether the frame can lift or walk, and what anchors are needed.
- Long-term condition: decay, checking, loosening hardware, inspection schedule.
- Lumber quality for structural parts: knots, grain slope, and defects in beams and legs.

### Inputs

- Species and grade of each structural member (determines design values).
- Rider weights and number of simultaneous riders.
- Maximum swing angle and dynamic factor.
- Hardware rated loads, from manufacturer specifications.
- Deflection limit, user-confirmed.

Design values and adjustment factors come from the American Wood Council's National Design Specification (NDS) for Wood Construction and its supplement. [4] Verify current editions and values before implementing; store them as sourced, versioned data, not constants in code.

## Swing set specifics

### Structure

- Typical form: a top beam supported at each end by an A-frame of two splayed legs, with braces, and ground anchors.
- The top beam is a single solid member or a built-up beam: two or three 2x boards fastened face to face (decision 0012). A built-up beam acts as one member only when the plies are fastened together as the design source requires. **Expert check** on the ply fastening (fastener type, size, spacing, and pattern).
- Leg splay is in one plane, perpendicular to the beam: legs meet the beam and the ground at an angle, so each end cut is a single angle, not a compound cut. (Legs that also lean outward along the beam would need compound cuts; not supported.) Metal A-frame brackets set the angle and simplify the joinery considerably; cutting the angles directly needs accurate angled cuts and careful bolt placement.
- **Expert check:** beam size and span for adult use (supported by the computed beam checks), leg and brace sizing, joinery and bolt sizing, anchoring (checklist only).

### Hardware

- Swing hangers and other suspension hardware should be rated for swing use, with manufacturer specifications followed for installation and load. The app computes a margin between the per-hanger load and the manufacturer's rating (see Structural checks) but does not certify loads. **Expert check.**
- Fasteners for outdoor structures must be corrosion-resistant and compatible with the lumber treatment used. **Expert check** when using pressure-treated lumber.

### Lumber and finish

- CPSC advises that wood for outdoor home playgrounds be naturally rot- and insect-resistant or treated, and notes that preservatives without arsenic are now used for residential pressure-treated wood. [1]
- Kids will touch every surface: sand and ease edges, and check for splinters and protruding hardware.

### Layout and clearances

Verified against the CPSC home handbook [1] (Publication 324, 2005) in October 2026. Page numbers are the handbook's printed page numbers.

- **Clear area:** play equipment at least 6 feet from any structure or obstacle, such as a house, fence, shed, tree, or pole (p. 2). Protective surfacing at least 6 feet beyond the equipment in all directions (p. 7).
- **Swing zones:** in front of and behind to-fro swings, keep structures away and extend surfacing to twice the height of the top bar the swing hangs from (pp. 2, 7). Kerf measures this from the beam's centerline and uses the height of the beam's underside (the pivot height); measuring to the top of the beam would add twice the beam depth.
- **Spacing:** at least 8 inches for swings with limited sideways motion, which Kerf applies between seats and between a seat and the frame; at least 8 inches between the surfacing and the underside of a seat (p. 5).
- **Seats:** lightweight; avoid heavy metal or wood seats (p. 4).
- **Anchors:** follow the manufacturer's instructions, and bury or cover anchors (p. 4).
- **Level site:** the handbook recommends a level location, and notes some sites need regrading (p. 2). A sloped site is a deliberate departure: **expert check**.

The site layout draws the frame's footprint at grade plus these zones, with each value configurable and its source shown.

### Hardware guidance from the handbook [1]

- Bolts and screws corrosion-resistant, fastened tightly, with lock washers, self-locking nuts, or other locking means (p. 3).
- Bolt ends capped, protruding no more than one bolt diameter past the nut (p. 3).
- S-hooks and other hooks closed to a gap less than the thickness of a dime; open hooks are acceptable only at the uppermost attachment point of a swinging element (p. 3).
- Hardware compatible with the wood's pressure treatment, since the treatment chemicals corrode some metals faster (p. 3).
- Check nuts and bolts twice a month; check seats, ropes, chains, and cables monthly (p. 5).

## Implications for the data model

- **Template:** parameters with types, ranges, and defaults; a pure function deriving parts, hardware, operations, and geometry; validation rules; a version that changes whenever outputs for the same parameters would change.
- **Project:** template and template version, parameter values, status (planned, in progress, built), structural check inputs, and the operations, methods, and skills used. Later projects use this history to refer back to earlier work.
- **Part:** name, role, stock (nominal and actual), length, end cuts (miter and bevel per end, in the angle convention under Units), holes, quantity, board selection notes.
- **Hardware item:** type, size, quantity, notes, flag if structural.
- **Operation:** type (from the operations table), part reference, parameters (angle, depth, hole size).
- **Method:** operation type, required tool types and capabilities, skills, steps, common mistakes, flags.
- **Tool:** type and capabilities (for example, circular saw with bevel up to 45 degrees). Inventory is a list of these.
- **Flag:** category (from expert-check categories), what to ask, why.
- **Geometry:** 3D positions and orientations of parts, used for isometric and exploded projection.
- **Structural check:** type (beam bending, shear, deflection, hardware), member or hardware reference, inputs with sources, formula, intermediate values, result, margin, assumptions.
- **Checklist item:** category, the specific design element it refers to, what to confirm, why.
- **Design values:** species, grade, size class, allowable stresses, modulus of elasticity, adjustment factors, source and edition.

## Units

- Imperial throughout (US lumber, personal use). Store lengths as decimal inches; display as feet, inches, and fractions rounded to 1/16. Angles in degrees.
- Rounding must be consistent and visible: a displayed fraction is never silently different from what other views show. Round once, at display, from the stored decimal values; never compute with rounded values. A total is rounded from the exact sum, so it can differ from the sum of rounded parts, and where that happens the display says so.
- **Angle convention.** Angles are stored and shown as miter-saw settings: 0° is a square cut, and the angle is measured from square. Each cut detail shows which face the angle is measured from. It also shows the angle between the cut line and the board's edge (90° minus the setting), which is what a protractor or sliding bevel reads against the edge. Mixing the two (for example, 15° vs. 75°) is the most likely cause of a recut. A speed square's degree scale is believed to read from square like a saw; confirm against the owner's square before the method text relies on it.

## Verification

- Structural checks: unit tests with worked examples checked by hand (see Structural checks).
- Geometry: the same standard. Each template has hand-checked worked examples for part lengths and angles, plus tests that the parts fit together: legs land on the computed footprint, leg tops meet the beam at the bracket or bolt positions, and brace ends meet the legs.

## Sources

1. CPSC, Outdoor Home Playground Safety Handbook (Publication 324): https://www.cpsc.gov/s3fs-public/324.pdf
2. Maryland State Department of Education, Playground Safety (summary of CPSC guidance): https://earlychildhood.marylandpublicschools.org:443/system/files/filedepot/3/playgroundsafety.pdf
3. PRISM, Identifying Playground Hazards (summary of CPSC public playground handbook): https://www.prismrisk.gov/member-services/guidance-and-resource-library/risk-simplified/prism-risk-simplified/identifying-playground-hazards/
4. American Wood Council, National Design Specification (NDS) for Wood Construction and NDS Supplement (design values). Verify current edition at awc.org.

Also relevant: CPSC Public Playground Safety Handbook (Publication 325, 2025 edition), for public playgrounds rather than home use: https://www.cpsc.gov/s3fs-public/325_PublicPlaygroundSafetyHandbook2025_7-30-25_1.pdf
