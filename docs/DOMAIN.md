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

The checks are generic: they work on members, supports, and loads, and know nothing about a particular project. Each template supplies its structural model (which members, where they are supported, which loads act on them, and which load cases to check) and its own checklist items. The swing set's loads are under Swing set specifics, Loads.

### Computed (structural checks)

- **Beam model.** A simply supported span L between two supports, with any number of point loads at any positions and, optionally, a uniform load over the span (such as the member's own weight). Results come from superposition of the single-load cases (AWC Design Aid 6, Figures 1 and 8). Symmetric two-load formulas are kept as hand-check cases for the tests. Loads on overhangs beyond the supports are not checked.
- **Beam bending.** Maximum moment occurs where the shear changes sign: under a point load, or with a uniform load, between point loads where the shear crosses zero. Compute the moment at each such position from the support reactions and take the largest. Symmetric hand check: two equal loads P, each a distance a from its nearest support, M = P·a. Bending stress f_b = M / S (S = section modulus of the actual cross section), compared against the adjusted allowable bending stress for the species and grade.
- **Beam shear.** Maximum shear V is the larger support reaction (V = P in the symmetric case). Shear stress f_v = 3V / (2A) for a rectangular section, compared against the adjusted allowable shear stress. This is the same as the NDS 2024 form V ≤ Vr' = (2/3)·Fv'·b·d (Eq. 3.4-2). The NDS allowance to reduce loads within d of a support (3.4.2.2) is not used.
- **Beam deflection.** Superpose the single-load deflection curve: for a load P a distance b from the right support, deflection at x (measured from the left support, left of the load) is P·b·x·(L² - b² - x²) / (6·E·I·L), mirrored for points right of the load. Evaluate along the span and take the maximum. Symmetric hand check: δ = P·a·(3L² - 4a²) / (24·E·I) at midspan. Shown against a user-confirmed deflection limit (span divided by a number). The template says which load case deflection uses. Tabulated E for sawn lumber already includes shear deflection (NDS Appendix F.3.1), so bending deflection alone is computed; long-term creep (NDS 3.5.2) is not included. The maximum is found exactly: between loads the curve is a cubic, so its maximum is at a load or where its slope is zero.
- **Adjustment factors.** Allowable stresses are the NDS reference design values with the factors that apply to the member as used, from conditions the template states: wet service (C_M), size (C_F), beam stability (C_L), temperature (C_t) if relevant, load duration (C_D), incising (C_i) if the lumber is incised, and repetitive member (C_r) only where several members share load. Every factor is listed on the result with its value, reason, and source, including factors equal to 1.0. C_L follows NDS 3.3.3 with the effective length for loads not listed in Table 3.3.3 (its footnote 1), and the unbraced length is the distance between supports that prevent rotation.
- **Hardware load vs. rating.** A computed load on one piece of hardware compared against the manufacturer's rated working load, shown as a margin.
- **Built-up beams.** The NDS 2024 has no provisions for built-up beams (only for built-up columns), so a beam of n identical plies is checked as one ply carrying 1/n of every load, with that ply's breadth for beam stability (decision 0013). Bending, shear, and deflection match the combined section; beam stability is lower than a combined section would get. The repetitive member factor is not applied. Ply fastening goes on the checklist.
- **Results** are reported as margins under stated assumptions ("margin 2.1x" means the adjusted allowable value is 2.1 times the computed value), never as "safe" or "pass." There is no separate user safety factor; the margin is the number to judge with an experienced builder.

### Checklist only (not computed)

Generic categories; each template lists the specific items for its design.

- Bolted connections: bolt size, spacing, edge and end distances, washers, load direction relative to grain. Kerf places bolts by a stated rule and reports each distance against NDS 2024 Tables 12.5.1A to 12.5.1D (decision 0016); it does not compute a connection's capacity.
- Racking: whether the structure resists sideways forces.
- Tipping and anchoring: whether the structure can lift, tip, or walk, and what anchors are needed.
- Long-term condition: decay, checking, loosening hardware, inspection schedule.
- Lumber quality for structural parts: knots, grain slope, and defects.

### Inputs

Generic inputs, entered or confirmed by the user, never defaulted:

- Species and grade of each structural member (determines design values), and whether the lumber is incised (NDS 4.3.8; pressure-treated lumber sometimes is).
- Hardware rated loads, from manufacturer specifications.
- Deflection limit.

Templates add their own load inputs (for the swing set: riders, swing angle, dynamic factor).

Design values and adjustment factors come from the American Wood Council's National Design Specification (NDS) for Wood Construction and its supplement, 2024 editions. [4] They are stored as sourced, versioned data in `packages/core/src/design-values/`, each with a citation (table or section, page, and a link to AWC's free view-only copy) so the app can show where a number came from. Entered so far (October 2026): Southern Pine No.1 and No.2 dimension lumber, NDS Supplement Table 4B, checked row by row against SPIB's own table [5]; and the NDS factors for load duration, wet service, temperature, incising, size, and repetitive members.

## Swing set specifics

### Structure

- Typical form: a top beam supported at each end by an A-frame of two splayed legs, with braces, and ground anchors.
- The top beam is a single solid member or a built-up beam: two or three 2x boards fastened face to face (decision 0012). A built-up beam acts as one member only when the plies are fastened together as the design source requires. **Expert check** on the ply fastening (fastener type, size, spacing, and pattern).
- Leg splay is in one plane, perpendicular to the beam: legs meet the beam and the ground at an angle, so each end cut is a single angle, not a compound cut. (Legs that also lean outward along the beam would need compound cuts; not supported.) Metal A-frame brackets set the angle and simplify the joinery considerably; cutting the angles directly needs accurate angled cuts and careful bolt placement.
- **Expert check:** beam size and span for adult use (supported by the computed beam checks), leg and brace sizing, joinery and bolt sizing, anchoring (checklist only).

### Loads

The swing set's structural model, supplied by its template to the generic checks.

- **Swing load.** For a rider of weight W swinging to a maximum angle θ from vertical, the total chain tension at the bottom of the arc is W(3 - 2cos θ). At θ = 90° (swinging up to horizontal) that is 3W. Riders swinging in sync add together. It follows from two textbook results: released from rest at θ, the rider reaches the bottom at speed v with v² = 2gL(1 - cos θ) (conservation of energy), and the chain then carries the weight plus the centripetal force mv²/L, so T = W + 2W(1 - cos θ) (source 8). This is the smooth pendulum case only: snap loads from slack chains (bouncing, jerking) exceed it, so a user-confirmed dynamic factor is applied on top. No hidden default; the value is chosen with an experienced builder and shown on every result.
- **Per-hanger load.** Each swing hangs from two hangers. The swing load is split between them, assumed equal for a centered rider; the split is a stated assumption on every result that uses it.
- **Beam.** Supported at the two frame centerlines, with each hanger as a point load at its own position.
- **Load cases.** Strength checks (bending, shear, hardware) use the swing load with the dynamic factor. Deflection uses W(3 - 2cos θ) without it, since it describes normal use, not peak snap loads.
- **Service conditions.** A single outdoor beam: wet service applies, the repetitive-member factor does not, and load duration C_D is 1.0 (the NDS impact increase is not used).
- **Inputs:** the heaviest rider on each swing including seat and chain (0 for an empty swing, which covers the number of simultaneous riders), maximum swing angle, and dynamic factor. The beam's own weight is included as a uniform load, from its density at a moisture content the owner enters (Simpson, FPL-GTR-76 [7]).
- **Checklist items:** leg-to-beam bolts and gusset; racking of the A-frames and crossbars against side-to-side and fore-aft swing forces; anchoring or burial; lumber quality in the beam and legs.

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
- **Part:** letter (A, B, C in cut-list order, the name drawings use), name, role, stock (nominal and actual), length, end cuts (miter and bevel per end, in the angle convention under Units), holes, quantity, board selection notes.
- **Hardware item:** type, size, quantity, notes, flag if structural.
- **Operation:** type (from the operations table), part reference, parameters (angle, depth, hole size).
- **Method:** operation type, required tool types and capabilities, skills, steps, common mistakes, flags.
- **Tool:** type and capabilities (for example, circular saw with bevel up to 45 degrees). Inventory is a list of these.
- **Flag:** category (from expert-check categories), what to ask, why.
- **Geometry:** 3D positions and orientations of parts, used for isometric and exploded projection. Each part instance has a placement: a local frame (along its length from its first end, across its width from its reference edge, through its thickness) with its origin at the first end's long point. The part's shape in that frame follows from its own data (length, width, thickness, end cuts), so a placement and the cut list together draw it.
- **Structural check:** type (beam bending, shear, deflection, hardware), member or hardware reference, inputs with sources, formula, intermediate values, result, margin, assumptions.
- **Checklist item:** category, the specific design element it refers to, what to confirm, why.
- **Design values:** species, grade, size class, allowable stresses, modulus of elasticity, adjustment factors, source and edition.

## Units

- Imperial throughout (US lumber, personal use). Store lengths as decimal inches; display as feet, inches, and fractions rounded to 1/16. Angles in degrees.
- Rounding must be consistent and visible: a displayed fraction is never silently different from what other views show. Round once, at display, from the stored decimal values; never compute with rounded values. A total is rounded from the exact sum, so it can differ from the sum of rounded parts, and where that happens the display says so.
- **Entering lengths.** A length is typed as a plan writes it and read by core's `parseLength`: a number on its own is inches (`138`, `138.4`), a fraction joins inches with a hyphen or space (`138-3/8`), and feet take `'` (`11' 6-3/8"`). Fractions are tape fractions, halves to 64ths. Ambiguous text such as `11 6` is refused with a message rather than guessed. What is typed is kept exactly; a saved length is written back into its field without rounding (`lengthForEntry`). The standard and its reasons are in `docs/design/entry.html` (#67).
- **Angle convention.** Angles are stored and shown as miter-saw settings: 0° is a square cut, and the angle is measured from square. Each cut detail shows which face the angle is measured from. It also shows the angle between the cut line and the board's edge (90° minus the setting), which is what a protractor or sliding bevel reads against the edge. Mixing the two (for example, 15° vs. 75°) is the most likely cause of a recut. A speed square's degree scale is believed to read from square like a saw; confirm against the owner's square before the method text relies on it.

## Verification

- Structural checks: unit tests with worked examples checked by hand (see Structural checks).
- Geometry: the same standard. Each template has hand-checked worked examples for part lengths and angles, plus tests that the parts fit together: legs land on the computed footprint, leg tops meet the beam at the bracket or bolt positions, and brace ends meet the legs.

## Sources

1. CPSC, Outdoor Home Playground Safety Handbook (Publication 324): https://www.cpsc.gov/s3fs-public/324.pdf
2. Maryland State Department of Education, Playground Safety (summary of CPSC guidance): https://earlychildhood.marylandpublicschools.org:443/system/files/filedepot/3/playgroundsafety.pdf
3. PRISM, Identifying Playground Hazards (summary of CPSC public playground handbook): https://www.prismrisk.gov/member-services/guidance-and-resource-library/risk-simplified/prism-risk-simplified/identifying-playground-hazards/
4. American Wood Council, National Design Specification (NDS) for Wood Construction, 2024 edition, and the NDS Supplement: Design Values for Wood Construction, 2024 edition with addenda of February 2024 and March 2025. Free view-only copies: https://awc.org/publications/2024-nds/ and https://awc.org/publications/2024-nds-supplement/
5. Southern Forest Products Association, Southern Pine Reference Design Values based on SPIB grading rules, effective June 1, 2013 (corroborates NDS Supplement Table 4B): https://www.southernpine.com/wp-content/uploads/2023/09/TABLE01_L1.pdf
6. American Wood Council, Design Aid No. 6, Beam Design Formulas with Shear and Moment Diagrams (corroborates the beam formulas): https://awc.org/wp-content/uploads/2021/12/AWC-DA6-BeamFormulas-0710.pdf
7. Simpson, W. T., Specific Gravity, Moisture Content, and Density Relationship for Wood, USDA Forest Products Laboratory FPL-GTR-76, 1993: https://research.fs.usda.gov/download/treesearch/5914.pdf
8. Moebs, W., Ling, S. J., and Sanny, J., University Physics Volume 1, OpenStax, 2016: Example 8.7 (Simple Pendulum) and Section 6.3 (Centripetal Force), for the swing load: https://openstax.org/details/books/university-physics-volume-1

Actual (dressed) lumber sizes come from NDS Supplement Table 1B (source 4), whose sizes conform to the American Softwood Lumber Standard, PS 20-20 (Supplement 3.1).

Also relevant: CPSC Public Playground Safety Handbook (Publication 325, 2025 edition), for public playgrounds rather than home use: https://www.cpsc.gov/s3fs-public/325_PublicPlaygroundSafetyHandbook2025_7-30-25_1.pdf
