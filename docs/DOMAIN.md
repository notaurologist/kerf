# Domain Knowledge

Status: Draft v0.5

Background for anyone (human or agent) working on this project. This is not authoritative woodworking or safety guidance. Where something is marked **expert check**, the app should flag it for review by an experienced woodworker. Sources are listed at the end; add a source for any new safety-relevant claim.

## Lumber basics

- **Nominal vs. actual size.** Dimensional lumber is named by nominal size, which is larger than its actual size (a "2x4" is about 1-1/2 x 3-1/2 inches). Cut lists and geometry must use actual dimensions; shopping lists use nominal names.
- **Buyable lengths.** Lumber is sold in standard lengths (commonly 8, 10, 12, 16 feet). Shopping lists group parts into these, allowing for the saw kerf on each cut (about 1/8 inch for a typical blade, configurable) and for trimming factory ends, which are often not square or have checks.
- **Board stock.** Furniture hardwood is also sold surfaced at a fixed width, such as the boards a home center stocks. Their species and lengths vary by store, so each board stock records a name (such as "1x6 cherry"), its actual thickness and width, and the lengths the store sells (owner's decision on #278, November 2026). A template may suggest a standard size, such as a dry 1x6 at 3/4" by 5-1/2" (American Softwood Lumber Standard, PS 20-10, Table 3), for the owner to check against the store's boards (#317). A part can also be cut straight from board stock, with no panel, such as square leg stock bought ready to cut to length (owner, #338, #344). Hardwood from a lumber dealer is sold differently: in thickness classes (4/4, 5/4, 6/4, 8/4), rough or surfaced two sides (4/4 surfaces to 13/16"; Wood Handbook, Table 6-4), in random widths with only a minimum per grade (FAS at least 6"), and in lengths from 4 to 16 feet in 1-foot steps (Wood Handbook, ch. 6, pp. 6-3 to 6-4). It is sold by the board foot: nominal thickness in inches × width in feet × length in feet (American Softwood Lumber Standard, PS 20-10, 2.2). Kerf plans dealer boards at a width the owner can change, counts panel boards from it, and gives each panel's board the narrowest width that still glues up wide enough, (width + rip + 2a(n − 1)) / n. The shopping list adds board feet for each line, with a waste allowance for defects and offcuts (#296).
- **Edge-glued panels.** A part wider than a board is a panel: boards glued edge to edge, then ripped to its finished width and cut to its finished length. The boards run along the part's length, so its grain does too. Each glued edge is jointed straight and square first, losing the jointing allowance *a*; with *n* boards of width *w* there are *n* − 1 glue joints, so the glued width is *n·w* − 2*a*(*n* − 1). Kerf uses the fewest boards whose glued width covers the finished width plus the rip allowance: *n* = ⌈(width + rip − 2*a*) / (*w* − 2*a*)⌉. Each board is cut to the part's length plus a trim allowance at each end. Flattening the glued-up panel takes a flattening allowance off its thickness, so its boards must be at least the panel's thickness plus that allowance thick; a part of one board is not flattened, so it keeps the board's thickness (#319, #320). A part narrower than a board is one board ripped to width. The jointing, rip, trim, and flattening allowances have no published source, so a template suggests them as labeled rules of thumb the owner can change (`lumber/panel.ts`, #317). Each panel's boards are planned onto its board stock like any other pieces, with the same saw kerf and factory-end trim.
- **Species and treatment.** Outdoor projects need wood that resists rot and insects, either naturally (for example, cedar or redwood) or pressure-treated. [1]
- **Moisture and movement.** Wood expands and shrinks across the grain with humidity, far more than along its length. Pressure-treated lumber is often sold wet and shrinks as it dries. Designs that rigidly restrain cross-grain movement can crack. **Expert check** for any glued or tightly fastened cross-grain joints. See Wood movement.
- **Grain and defects.** Board selection matters: straightness, knots (especially near edges or at joints), checks, and twist. The knowledge base holds guidance by what a board does (every board that carries load, across a span, along its length, joined with bolts, in or on the ground), sourced to the Wood Handbook [9] and AWPA [10]; each template says which guides its parts need. Ground contact needs lumber treated to AWPA use category UC4A or higher, shown on the end tag [10].

## Wood movement

Dry wood keeps swelling and shrinking a little as indoor humidity changes through the year. Wide solid-wood parts, such as a tabletop or a cabinet side, have to be built so they can move. [9]

- **Direction.** Wood moves most along the growth rings (tangentially), about half as much across them (radially), and only slightly along the grain. So a flatsawn board moves most in its width, and a quartersawn board moves about half as much. Where the ring orientation isn't known, use the tangential value. [9, Ch. 4, pp. 4-7 and 4-11]
- **How much.** Within 6% to 14% moisture content, the change in a dimension is ΔD = D · C · (M_F − M_I), where D is the dimension at the start, M_I and M_F are the starting and ending moisture content in percent, and C is the species' dimensional change coefficient: C_T for flatsawn width, C_R for quartersawn width. Coefficients are per 1% moisture content, based on the dimension at 10%. [9, Ch. 13, Eq. 13-3, p. 13-16; Table 13-5, p. 13-17] Outside 6% to 14% the Handbook uses a different equation (Eq. 13-4), so Kerf keeps moisture content inside that range.
- **Variation.** These are averages. Individual boards vary with a coefficient of variation of about 15%, and commercial lumber is seldom perfectly flatsawn or quartersawn, so the equation will probably overestimate width change and underestimate thickness change. [9, Ch. 4, p. 4-11; Ch. 13, p. 13-16]
- **Moisture content indoors.** The Handbook recommends installing interior woodwork and furniture at an average of 8% moisture content in most of the United States, with individual pieces between 6% and 10%; 6% (4% to 9%) in the dry Southwest; and 11% (8% to 13%) in damp, warm coastal areas. [9, Ch. 13, Table 13-2 and Fig. 13-1, p. 13-5] These describe wood at installation, not the seasonal swing in a particular house. The range a plan uses is an input the owner confirms, not a hidden default.
- **Moisture content when bought.** Lumber can be wetter when bought than it will be indoors. Common softwood boards and dimension lumber are not normally dried to the indoor values, and "dry" lumber under the American Softwood Lumber Standard can be up to 19% [9, Ch. 13, p. 13-5]. Lumber for furniture is best stored where the humidity is controlled; stacking it on stickers brings it toward its service moisture content, and stock that is wetter at its ends than its middle splits or opens its glue joints after it is ripped or jointed and edge-glued [9, Ch. 13, p. 13-15]. So every plan with glued-up panels starts with a step to let the lumber settle indoors, stacked on strips, before any board is cut, with a moisture meter if the owner has one (a meter used properly reads within 1% of the true average [9, Ch. 13, p. 13-3]). It asks for no reading (owner's decision on #332, November 2026).
- **What Kerf computes.** For each solid-wood part whose movement a template allows for, the expected change across the grain from Eq. 13-3, given its species, ring orientation (flatsawn, quartersawn, or unknown, which uses C_T), and the moisture content range the owner confirms. The result is exact until display and is shown as an estimate with the variation above, in the structural review's Wood movement subsection (`Plan.movement`). Clearances that allow for movement, such as slot lengths and panel gaps, are derived from it (owner's decision on #276, October 2026).
- **Construction.** The Handbook says to design and install large solid pieces so they are free to move across the grain, and that narrow widths are preferable. [9, Ch. 13, p. 13-18] How a part is held so it can still move is below, under Joints that let wood move.
- **Glued joints.** As glued wood swells and shrinks, internal stresses develop that can damage the bond or the wood, for example where end grain is glued to cross grain. The Handbook says to keep them down by gluing pieces with compatible grain directions, of like species and similar moisture content, at the moisture content expected in service. [9, Ch. 10, p. 10-7] A plain joint of end grain to edge grain carries little load, so these joints need interlocking surfaces, such as a dado or a mortise and tenon. They develop large internal stresses as moisture changes, and should be protected from changes in moisture content in service. [9, Ch. 10, p. 10-17]
- **Joints that let wood move.** The Handbook gives the principle above but no clearances, and no other source Kerf has read gives a rule for sizing them (searched November 2026: the Wood Handbook 2021, FPL publications, and extension guides; R. Bruce Hoadley's *Understanding Wood* and Purdue's furniture engineering course text could not be read, so they are not cited). Woodworking guides agree on the methods but give different gaps. So Kerf sizes each clearance from its own movement estimate, ΔD over the owner's moisture range (above), plus a stated margin, and the plan says the clearance follows from that estimate rather than from a published rule (owner's decision on #292, November 2026):
  - **Screws in slotted holes**, Kerf's way of fastening a case or top to a base (owner, #292). Each slot runs in the direction the part moves, and is as long as the screw's shank is wide plus ΔD, plus a 1/16" margin (rule of thumb). The screw at the edge that must stay put, such as the front, goes in a round hole, so the part moves away from it; the farthest slot from it takes the whole ΔD. A screw is snug, not tight, so its head can slide.
  - **A panel floating in grooves**, as in a frame-and-panel door: the panel is not glued in its grooves, and is ΔD narrower than the space between the groove bottoms when it is at its widest, split evenly between its two edges, plus a 1/32" margin on each (rule of thumb). Its grooves are deep enough that the panel stays engaged when it is at its narrowest.
  - In data, each hole a screw passes through is round or slotted, with the slot's extra length and the way it runs (`Part.screwHoles`). Its methods drill the screw's clearance hole, as the screw maker gives it, and lengthen it into a slot, so Kerf needs no shank diameter of its own (#344).
  - Other methods, such as tabletop fasteners in a kerf and shop-made wooden buttons, do the same job. Kerf does not plan them yet.
- **Joint proportions.** No source Kerf has checked gives a limit for dado depth, so a template takes it as a parameter, and may suggest one as a labeled rule of thumb (#317). Where a dado weakens a part, such as back-to-back dadoes in a partition, the plan shows the wood left and flags it for an expert check (owner's decision on #283, October 2026).

Worked check from the Handbook: a flatsawn white fir board 9.15 in. wide at 8% grows by 9.15 × 0.00245 × (11 − 8) = 0.067 in. at 11%. [9, Ch. 13, p. 13-16]

## Measuring and marking

- Measure from a consistent reference end and face.
- Mark cut lines with the waste side indicated; the saw kerf (blade width) comes out of the waste side.
- For repeated parts, cut one, verify it, then use it (or a stop block) to mark the rest.
- Angles can be laid out with a rafter square or protractor; for repeated angles, a jig or set tool beats re-measuring.

## Operations

Operations are what needs to happen to a part. Methods are how, given specific tools. The knowledge base maps operations to methods. Operation types in code (`model/operations.ts`) cover what templates use: crosscut, miter, taper, joint edges, glue up, flatten, rip, dado, stopped dado, stopped rabbet, notch, cutout, mortise, tenon, screw holes, groove, rabbet, finger recess, bolt holes, ease edges, dry-fit, glue and clamp (an assembly), screw together (`fasten`, through holes already drilled), finish, dig holes, and level pads. A dry-fit and a glue-and-clamp name the parts they join and how far a clamp must open across them (`reach`), so a method can need clamps that open that far. A taper takes off width, which the part's face outline shows, or thickness, cut into the back face through the width, as a Shaker leg tapers on its two inside faces (`Taper.plane`, #338). A groove runs along a part's edge, such as the one a door's panel floats in; a rabbet is a step along an edge or end into one face, such as the one that leaves a panel's tongue; a finger recess is a shallow scoop in a face to pull with (#339). A stopped rabbet is a dado at a part's end, open there and at one edge and stopped short of the other. A mortise is a rectangular pocket in a face or an edge of one part; the tenon on another part's square end fits it, standing out from shoulders, with its cheeks taken off the two faces and its shoulders off the edges where it is narrower than the part (#343). Kerf's methods cut a mortise with a drill and chisel or a router, and a tenon with a hand saw or a router; a table saw is left out, since the sources Kerf has read give no guidance for the cuts it would take. Building mode draws a step whose operations join parts: a dry fit shows every part fitted and builds nothing, since it comes apart again (#313).

| Operation | Example methods by tool |
|---|---|
| Crosscut (square) | Miter saw; circular saw with rafter square or guide; hand saw |
| Angled crosscut (miter) | Miter saw set to angle; circular saw with rafter square at angle |
| Bevel cut | Miter saw or circular saw with bevel; table saw with tilted blade |
| Rip (cut along the grain) | Table saw; track saw; circular saw with straightedge guide or rip fence |
| Dado (a flat-bottomed groove reaching two opposite edges, housing another part) | Router along a clamped guide; circular saw kerfs and a chisel; hand saw and chisel |
| Stopped dado (reaching one edge and stopping short of the other, so it doesn't show) | Router along a guide with a stop, and a chisel to square the end; chisel and hand saw |
| Notch (a corner cut out through the thickness) | Band saw; jigsaw; hand saw |
| Cutout (a rectangle cut out of an end, such as between two feet) | Band saw; jigsaw and a chisel |
| Joint edges (a panel's glued edges, straight and square) | Jointer; table saw or track saw trimming a thin strip |
| Glue up (a panel's boards, edge to edge) | Clamps that open past the glued width, with or without cauls to hold the faces level |
| Flatten (a glued-up panel's faces) | Thickness planer as wide as the panel; sander |
| Taper (a straight cut along a part, partway across it, such as a flush cut) | Circular saw, jigsaw, or hand saw along a marked line; chisel or block plane to clean up |
| Bolt holes | Drill with spade or auger bit; drill guide for straight holes through thick stock. Each hole is 1/16" over its bolt (NDS 2024 12.1.3.2 allows 1/32" to 1/16"; `structural/boltHoles.ts`) |
| Counterbore (recess a bolt head or nut) | Forstner or spade bit, drilled before the through hole |
| Ease edges and splinters | Sander; block plane; router with roundover bit |
| Dig holes, or level pads (site work for parts set in or on the ground) | Post-hole digger and tamper; level |

A panel part (Edge-glued panels) gets its operations from its stock. Its boards are cut to length in the cutting steps, board by board. After that, in the template's step outline, its glued edges are jointed, the boards are glued up and the panel flattened, and the panel is ripped to width and its ends cut. A panel of one board is only cut to length and ripped. The gluing guidance follows the Wood Handbook [9, Ch. 10, pp. 10-3 and 10-14 to 10-16]: a cleanly cut edge, surfaced shortly before gluing, bonds best. Clamp pressure brings the edges together and spreads the glue thin, but too much starves the joint. Gaps make thick, weak glue lines. A panel surfaced too soon after gluing ends up with sunken glue lines, because the water from the glue has not yet dried out of the wood along each joint.

Each method in the knowledge base (`knowledge/methods.ts`) records: required tools, skills used, setup steps, technique steps, common mistakes, safety notes with their sources, and any flags. A required tool can be any of several tool types (a square to mark a line: combination or rafter), and can need a capability that covers a number from the operation, such as a miter saw's cut depth at least the stock's thickness, or a bit's reach at least half the hole's depth when the method drills from both sides. Method text names the operation's numbers as `{name}` and core fills them in, so the text holds no numbers of its own. Skills are in `knowledge/skills.ts`.

## Expert-check categories

The app flags steps and design choices in these categories. They are data in `knowledge/categories.ts`, each with what to ask an experienced builder, why, and the source for the hazard; templates' flags and methods' flags use the same list.

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
- **Beam deflection.** Superpose the single-load deflection curve: for a load P a distance b from the right support, deflection at x (measured from the left support, left of the load) is P·b·x·(L² - b² - x²) / (6·E·I·L), mirrored for points right of the load. Evaluate along the span and take the maximum. Symmetric hand check: δ = P·a·(3L² - 4a²) / (24·E·I) at midspan. Shown against a user-confirmed deflection limit (span divided by a number). The template says which load case deflection uses. Tabulated E for sawn lumber already includes shear deflection (NDS Appendix F.3.1), so bending deflection alone is computed. See Long-term loads for creep. The maximum is found exactly: between loads the curve is a cubic, so its maximum is at a load or where its slope is zero.
- **Adjustment factors.** Allowable stresses are the NDS reference design values with the factors that apply to the member as used, from conditions the template states: wet service (C_M), size (C_F), beam stability (C_L), temperature (C_t) if relevant, load duration (C_D), incising (C_i) if the lumber is incised, and repetitive member (C_r) only where several members share load. Every factor is listed on the result with its value, reason, and source, including factors equal to 1.0. C_L follows NDS 3.3.3 with the effective length for loads not listed in Table 3.3.3 (its footnote 1), and the unbraced length is the distance between supports that prevent rotation.
- **Hardware load vs. rating.** A computed load on one piece of hardware compared against the manufacturer's rated working load, shown as a margin.
- **Built-up beams.** The NDS 2024 has no provisions for built-up beams (only for built-up columns), so a beam of n identical plies is checked as one ply carrying 1/n of every load, with that ply's breadth for beam stability (decision 0013). Bending, shear, and deflection match the combined section; beam stability is lower than a combined section would get. The repetitive member factor is not applied. Ply fastening goes on the checklist.
- **Long-term loads.** A template marks which of its loads are long-term, such as records on a shelf. Total deflection is Δ_T = K_cr · Δ_LT + Δ_ST (NDS 2024 3.5.2, Eq. 3.5-1, p. 22), with K_cr = 1.5 for seasoned lumber in dry service, and 2.0 for unseasoned lumber or seasoned lumber in wet service. [4] The Wood Handbook adds that after several years creep may roughly equal the initial deflection, and that swings in temperature and humidity increase it. [9, Ch. 5, p. 5-39] Checks for a template that marks no long-term loads are immediate deflection only (owner's decision on #275, October 2026).
- **Members without design values.** Furniture species such as cherry and walnut are sold in appearance grades, not structural grades, so they have no NDS design values. For these members Kerf computes deflection only. E is the clear-wood average at 12% moisture content from the Wood Handbook, Table 5-3b. [9, Ch. 5, pp. 5-9 to 5-13] NDS adjustment factors don't apply, and the result says so.
  - These are averages from small, clear, straight-grained specimens. The Handbook says to review them for critical applications (p. 5-21).
  - Like NDS E, they include shear deflection (Table 5-3b note c), so bending deflection alone is computed.
  - Most properties increase as moisture content falls below 12% (p. 5-34), so indoor furniture at 6% to 10% is stiffer than the value used.
  - Clear-wood strength (modulus of rupture) isn't an allowable stress, so bending and shear for these members go on the checklist instead of being computed (owner's decision on #275).
  - A member is described by its actual breadth and thickness, such as a 3/4" panel laid flat, rather than a nominal lumber size.
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

Design values and adjustment factors come from the American Wood Council's National Design Specification (NDS) for Wood Construction and its supplement, 2024 editions. [4] They are stored as sourced, versioned data in `packages/core/src/design-values/`, each with a citation (table or section, page, and a link to AWC's free view-only copy) so the app can show where a number came from. Entered so far (October 2026): Southern Pine No.1 and No.2 dimension lumber, NDS Supplement Table 4B, checked row by row against SPIB's own table [5]; and the NDS factors for load duration, wet service, temperature, incising, size, and repetitive members. Furniture species (black cherry, black walnut, white oak, northern red oak, sugar maple, yellow-poplar) have their Wood Handbook dimensional change coefficients (Table 13-5) and clear-wood E at 12% (Table 5-3b), checked against the printed tables, and the NDS creep factor K_cr (3.5.2) is entered with them.

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
- **Part:** letter (A, B, C in cut-list order, the name drawings use), name, role, stock (nominal and actual size, or for a panel its finished size, board stock, board count, board length, glued width, and allowances), length, end cuts (miter and bevel per end, in the angle convention under Units), holes, dadoes, notches, and cutouts, quantity, board selection notes.
- **Hardware item:** type, size, quantity, notes, flag if structural, and the store group the template puts it in (for example, bolts and fittings), so the shopping list reads in the order of a trip through the store.
- **Operation:** an ID, type (from the operations table), part reference, how many times, and parameters (angle, depth, bolt diameter).
- **Method:** operation type, required tool types and capabilities, skills, steps, common mistakes, safety notes, flags, and which other methods for the same operation it is easier or more accurate than.
- **Tool:** a tool type from the library (`knowledge/tools.ts`) and the capabilities the owner entered for it (for example, a circular saw and the depth it cuts with the blade square). Each tool type lists the capabilities that change which method fits, with the kind and unit of each and where its value is read; none has a default, and a capability not entered is input needed. A capability is listed only if a method uses it. Inventory is a list of these, in the owner's order, with a name on each when a type appears more than once ("Long clamps"), plus other tools by name, which methods ignore. Tool names are generic: "rafter square," since "Speed Square" is a trademark. Each tool type also has a one- or two-sentence description, generic like its name, shown on the tool's own page (`#/tools/<id>`) with the details Kerf asks for about it and the methods that can use it.
- **Flag:** category (from expert-check categories), what to ask, why, and the parts and hardware it concerns, if any.
- **Geometry:** 3D positions and orientations of parts, used for isometric and exploded projection. Each part instance has a placement: a local frame (along its length from its first end, across its width from its reference edge, through its thickness) with its origin at the first end's long point. The part's shape in that frame follows from its own data (length, width, thickness, end cuts), so a placement and the cut list together draw it.
- **Structural check:** type (beam bending, shear, deflection, hardware), member or hardware reference, inputs with sources, formula, intermediate values, result, margin, assumptions.
- **Checklist item:** category, the specific design element it refers to, what to confirm, why, and the parts and hardware it concerns, if any.
- **Design values:** species, grade, size class, allowable stresses, modulus of elasticity, adjustment factors, source and edition.

## Units

- Imperial throughout (US lumber, personal use). Store lengths as decimal inches; display as feet, inches, and fractions rounded to 1/16. Angles in degrees.
- Rounding must be consistent and visible: a displayed fraction is never silently different from what other views show. Round once, at display, from the stored decimal values; never compute with rounded values. A total is rounded from the exact sum, so it can differ from the sum of rounded parts, and where that happens the display says so.
- **Entering lengths.** A length is typed as a plan writes it and read by core's `parseLength`: a number on its own is inches (`138`, `138.4`), a fraction joins inches with a hyphen or space (`138-3/8`), and feet take `'` (`11' 6-3/8"`). Fractions are tape fractions, halves to 64ths. Ambiguous text such as `11 6` is refused with a message rather than guessed. What is typed is kept exactly; a saved length is written back into its field without rounding (`lengthForEntry`). The standard and its reasons are in `docs/design/entry.html` (#67).
- **Angle convention.** Angles are stored and shown as miter-saw settings: 0° is a square cut, and the angle is measured from square. Each cut detail shows which face the angle is measured from. It also shows the angle between the cut line and the board's edge (90° minus the setting), which is what a protractor or sliding bevel reads against the edge. Mixing the two (for example, 15° vs. 75°) is the most likely cause of a recut. Methods lay out an angled line from two measured marks, never from a tool's angle scale: square a line across from the long point, then measure along the far edge to the short point, width · tan(setting) from that line. Whether a rafter square's degree scale reads from square like a saw is not confirmed (the owner has none to check), so no method text relies on it.

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

9. Forest Products Laboratory, Wood Handbook: Wood as an Engineering Material, FPL-GTR-282, 2021: Chapter 4 (Dimensional Stability, p. 4-7; Relationship between Moisture Content and Shrinkage, pp. 4-10 to 4-11), Chapter 5 (E from bending, p. 5-2; Table 5-3b, pp. 5-9 to 5-13; clear wood values, p. 5-21; Knots, pp. 5-27 to 5-28; moisture content, p. 5-34; Creep and Relaxation, p. 5-39), Chapter 7 (Knots, Slope of Grain, Checks and Splits, Shake, Decay, pp. 7-4 to 7-5; crooks in columns, p. 7-14), Chapter 8 (pp. 8-22 to 8-23), Chapter 10 (Moisture Content and Dimensional Changes, p. 10-7; End-to-Edge-Grain Joints, p. 10-17), Chapter 13 (Recommended Moisture Content, Table 13-2 and Fig. 13-1, p. 13-5; Warp, p. 13-13; Dimensional Changes in Wood, Eq. 13-3, p. 13-16; Table 13-5, p. 13-17; Interior Finish, p. 13-18): https://research.fs.usda.gov/treesearch/62200. Chapter 4 alone: https://research.fs.usda.gov/treesearch/62243. Chapter 5 alone: https://research.fs.usda.gov/treesearch/62244. Chapter 10 alone: https://research.fs.usda.gov/treesearch/62250. Chapter 13 alone: https://research.fs.usda.gov/treesearch/62261
10. American Wood Protection Association, Information for Homeowners (use categories and end tags), read October 2026: https://awpa.com/info/technical/homeowners
11. OSHA, Hand and Power Tools (OSHA 3080), 2002 (revised): guards (p. 5), and clamping the work and unplugging to change a blade or bit (p. 4): https://www.osha.gov/sites/default/files/publications/osha3080.pdf
12. OSHA, Woodworking eTool, read October 2026: handheld circular saws (kickback, supporting the work), table saws, routers, and jointers: https://www.osha.gov/etools/woodworking
13. OSHA, Wood Dust: Overview, read October 2026: https://www.osha.gov/wood-dust
14. U.S. Fire Administration, Pictograph: Store Oily and Solvent-Wet Rags in a Metal Container, last reviewed January 9, 2022: https://www.usfa.fema.gov/gallery/pictographs/pictograph98.html
15. Common Ground Alliance, 811 Before You Dig, read October 2026: https://811beforeyoudig.com/

Actual (dressed) lumber sizes come from NDS Supplement Table 1B (source 4), whose sizes conform to the American Softwood Lumber Standard, PS 20-20 (Supplement 3.1).

Also relevant: CPSC Public Playground Safety Handbook (Publication 325, 2025 edition), for public playgrounds rather than home use: https://www.cpsc.gov/s3fs-public/325_PublicPlaygroundSafetyHandbook2025_7-30-25_1.pdf
