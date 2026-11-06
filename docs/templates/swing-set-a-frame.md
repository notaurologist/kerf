# Template: two-swing A-frame swing set

Status: v1, approved by the owner October 2026; template version 3 adds placements (#49); version 4 adds holes and joints and corrects the flush-cut marks (#50)

This is the geometry spec for the first template (`PRODUCT.md`, First template). The template code in `packages/core/src/templates/swing-set-a-frame/` implements exactly what is written here, and its tests use the worked example below. Structural checks (M2) and hangers and site layout (a later M1 change) build on it.

## Design covered by template version 1

Matches the owner's earlier build (photos reviewed October 2026).

- A top beam held by two A-frames, one near each end. The beam overhangs the frames. It is one solid member, or two or three 2x plies fastened face to face (decision 0012); the owner's earlier build used two 2x6s.
- **Legs cut flush to the beam.** The two legs of each A-frame rise alongside the beam, one against its front face and one against its back face. The inside of each leg's top is cut with a vertical face so it sits flush against the beam, and each leg's top is cut off level with the top of the beam. One bolt passes through the front leg, the beam, and the back leg.
- **A board under the beam** (a gusset) is fastened across both legs on the outside face of the frame, with its level top edge against the beam's underside. The beam rests on it and is also held by the bolt.
- **One crossbar per A-frame**, horizontal, fastened to the outside face of the legs (the face away from the swings). Its ends are cut at the splay angle, parallel to the legs' outer faces: flush with them before version 6, past them from version 6.
- **Ground that slopes front to back.** The ground is level along the beam, so the beam is the same height above the ground everywhere. The front legs are downhill. The beam stays level and each A-frame stays plumb, so the front legs are longer.
- **Feet either buried or on pads.** A burial depth of 0 means each foot sits on a level pad or footing with ground anchors. A depth greater than 0 means each leg continues that far below grade. Either way, each foot gets a level cut.

Template version 2 (#36) changes no geometry or number: it adds sources to the specific gravity G, the pendulum factor 3 − 2·cos θ, and the beam's breadth and depth in the structural working. Projects made with version 1 show the version notice listing those additions.

Template version 4 (#50) adds holes, bolt areas, the flush cut, and each end cut's reference edge as part data (Holes and joints, below), and rewrites the flush-cut note as two marks a builder can measure. The earlier note measured the start along the wrong line (Top of the leg). No dimension changes.

Template version 3 (#49) adds a 3D placement for every part instance (Placements, below) for the isometric and exploded views. It changes no other output; projects made with version 2 show the version notice listing the placements as new.

Template version 5 (#66) letters the parts in cut-list order. No dimension changes.

Template version 6 (#93, decision 0016) runs the crossbar and gusset ends past the legs, far enough for 7D of end distance at every bolt, and places those bolts as holes in the boards and legs (Bolt layout, below). The crossbar and gusset get longer; the cut list, shopping list, placements, and expert checks change with them. Each bolted joint's distances are reported against NDS 2024.

Template version 7 (#53) adds what to look for when choosing each part's board (Board selection, below). No number changes.

Template version 8 (#103) adds the operations each part and the site need (Operations, below). No number changes.

Template version 9 (#110) drills each bolt hole 1/16" over its bolt, as NDS 2024 12.1.3.2 requires (from 1/32" to 1/16" over). Before, each hole was drawn and recorded at the bolt's own diameter. Holes and bolt-hole operations now carry both sizes, and each cut detail labels them ("Drill 9/16" holes for 1/2" bolts"). Kerf uses 1/16" because spade and auger bits come in sixteenths, so a bit exists for any bolt sized in sixteenths. Bolt sizes, positions, and distances do not change; a plan made before version 9 keeps its holes at the bolt's diameter until it is regenerated.

Template version 10 (#51) names the parts and hardware each flag and checklist item concerns (Flags, below), so a build step shows the flags for its work. No number or wording changes; a plan made before version 10 shows its flags in the structural review only until it is regenerated.

Template version 11 (#58) stores the board plan's kerf and end trim, which cutting steps state. Every plan before it used 1/8" and 1/2", and reading one sets those, so nothing changes.

Template version 12 (#59) puts each hardware item in a store group (Hardware, below), so the store checklist reads lumber, then bolts and fittings, then swing hardware, then ground anchors. It also rewords each bolt's note as #68's audit asked ("1/2" through-bolt. Length: at least ..."). No number changes; a plan made before version 12 shows its hardware as one list until it is regenerated.

Template version 13 gives the bending check's position of the largest moment its own working step, in inches through the length formatter like every other length, instead of a three-decimal number in the moment's label. No number changes.

Template version 17 (#430) stores a plan without the part lists it leaves empty, such as a beam's tapers. Reading a plan fills them back in, so nothing a plan shows changes.

Template version 18 (#417) names, in the structural working, the input behind each entered value (the rider weights, swing angle, beam moisture content, dynamic factor, and deflection limit), and in the bolt layout the parameters behind each joint's bolt size and count, so a value Kerf suggested says so until the owner confirms it. The leg-to-beam checklist item no longer calls its bolt size entered. No number changes.

Template version 19 (#459) changes only how the build steps read, a change in generic code: when no method fits the owner's tools, a step lists every method for each operation, closest to the tools owned first, and the plan says when the toolbox is empty. Stored output is the same.

Template version 20 (#455) rewords the leg's flush-cut note: it calls the cut a taper, as its build step does, and gives one measurement for each mark (the top cut's mark along the top cut from the corner, without the same point measured square from the edge). Board drawings now draw each piece's angled ends, and the legs' cut details name their ends Top and Foot. No number changes.

Template version 21 (#457) changes only how the build steps read, a change in generic code: every method that uses a power tool says to wear eye protection, and hearing protection too for saws, routers, jointers and planers, and the leg taper cut with a circular saw marks where the blade stops and says to let the blade stop before lifting the saw. Stored output is the same.

Template version 23 (#445) supports the beam, in the structural checks, at the middle of each gusset's top edge instead of at the frame centerlines (Structural model, below). The beam rests on the gussets, and the leg-to-beam bolt sits in a hole 1/16" over its size, so the gussets take the load first. The span grows by one leg's thickness plus one gusset's: 92.5 to 97.5 in the worked example, whose bending margin falls from 1.08 to 0.98. No part, cut, or bolt moves.

Template version 22 (#449) gives each bolt the length to buy (Hardware, below) and names its shopping line by it ("1/2" × 10" through-bolt"), with the grip and the lengths that fit as the line's note. Each hardware line now carries its item's notes, which both shopping lists show, and the hardware notes name the fastener materials IRC 2021 R317.3.1 allows in treated lumber. No part, cut, or check changes.

Template version 24 (#514) keeps each bolt's range of lengths that fit, and each bolt line's bolt and the items on it, so a bolt bought before a change can be compared with the new grip (`progress/resets.ts`). No number changes.

Template version 25 (#450) moves the note about a shorter board onto its lumber line, and gives each lumber line what else to buy when the store has none of its boards (Not in stock, below). No part, cut, or check changes.

Template version 26 (#464) changes words only. The buried-legs flag and the ground-contact board guide ask whether the legs need AWPA use category UC4B (heavy duty) rather than UC4A: AWPA U1-25 lists UC4A for ground-contact parts that are not critical and UC4B for parts that are critical or hard to replace, or where wood decays fast (`DOMAIN.md`, source 20). The buried-legs checklist item also asks what each leg's end stands on and whether the backfill or concrete sheds water from the wood; no extension or treated-wood council source for figures was found, so it gives none. The C_D reason cites Table 2.3.2, footnote 2, beside 4.3.13: NDS 2024 states the 1.6 cap in both. No number changes.

Template version 27 (#447) marks every part as treated lumber, so every cut and bolt hole is field-treated, as IRC 2021 R317.1.1 requires (Operations and Build steps, below): a step after easing the edges coats every cut, and each bolt's holes are coated right after they are drilled, before the bolt goes in. The shopping list adds the preservative (Hardware, below). No part, cut, or check changes.

Template version 28 (#456) also measures the gusset's bolts against the beam's weight, which pushes down across the gusset's grain (Bolt layout, below). Before, the gusset was measured only for load along its grain, which left the top edge, the loaded edge under the beam, at 1.5D where NDS 2024 sets 4D. In the worked example the top gusset bolt is 1.8125 (3.6D) from the top edge, under 2", so the gusset's expert check names it. No part, cut, or bolt moves.

Template version 29 (#446) takes the beam's bending at each swing hanger on the net section the hanger's bolt holes leave (NDS 2024 3.1.2.1; Structural model, below). The hangers are the beam's point loads, so their holes fall where the moment is largest. How the hangers mount is a new hardware input, read at the store and with no default: one bolt down through the beam, bolts sideways through a bracket, or another way. Its bolts are listed with the other bolts, and their holes are drilled in the beam in a step of their own. In the worked example, a 1/2" bolt in a 9/16" hole at each hanger takes the bending margin from 0.98 to 0.83. A plan made before version 29 has no mounting, so on regenerating its bending says the mounting is needed.

Template version 30 (#493) writes each bolt flag's count and size as the bolt layout row does: "Crossbar to leg, 2 × 1/2\" bolts", which read as 2-1/2" bolts before. A flag's progress key is its ask, so regenerating clears a tick on these flags in the structural review. No number changes.

Template version 31 (#451) adds the work after the beam is bolted, which the steps used to leave out: standing the A-frames up and bracing them, plumbing them and backfilling the leg holes or anchoring the feet, tightening every bolt and capping its end, and hanging the swings (Operations and Build steps, below). The steps that tighten the bolts, anchor the feet, and hang the swings carry the CPSC home handbook's rules for that work as notes. A new expert check states both orders the frame can go up in, for the owner to choose with an experienced builder (Flags, below). No part, cut, or check changes.

Template version 32 (#466) gives the beam's bending in the next deeper stock, with each one's margin and break-even dynamic factor, beside the plan's own (Structural model, Deeper stock, below). The owner chose this on #466 so the stock can be chosen against the factor; Kerf still does not choose the stock. In the worked example the 4x6 reaches margin 1.0 at a factor of 1.645, a 4x8 at 2.655, and three plies of 2x8 at 2.086. The plan's own numbers do not change.

Template version 33 (#467) computes, for legs on pads, the fore-and-aft force the swings put on each frame and the uplift it gives at each foot, and checks the pull on one ground anchor against the anchor's rated pull-out, a new hardware input with no default (Structural model, below). The owner chose this on #467 (November 3, 2026); `PRODUCT.md` narrows its non-goal to match. The ground-anchor checklist item now asks about the soil, the anchors' fastening to the legs, and sliding, which stay uncomputed. No part, cut, or bolt moves.

Template version 34 (#468) checks the longer leg as a column in compression parallel to grain (NDS 2024 3.6.3 and 3.7.1; Structural model, Legs, below), with the legs' species and grade and whether they are incised as new structural inputs, read at the store beside the leg boards. In the worked example, which has buried legs, the front leg's ℓe/d along the beam is 63.4. That is over the NDS limit of 50, so the check is not computed and says why. On pads no NDS end condition holds the legs along the beam, so it says that instead. The beam's other stock sizes are still offered against the beam and hanger checks alone. The ground anchor check's assumption about the legs' weight now says it is left out for want of a moisture content, not a species, since the legs now have one. No other output changes; a plan made before version 34 has no leg check until it is regenerated.

Template version 35 (#524) measures the crossbar and gusset bolts' spacing along the leg as spacing between rows (Table 12.5.1D) instead of between bolts in a row (Table 12.5.1B). Under racking the load crosses the leg's grain, and the bolts lie along it, so each bolt is a row of its own (12.1.2.4; Figure 12G draws rows across the grain for this load). In the worked example the row's value goes from 3D (1.5) to (5ℓ + 10D)/8 = 1.5625, and the bolts stay 2.926 and 3.858 apart, so no flag or suggestion changes. No part, cut, or bolt moves.

Template version 36 (#526) takes the beam's shear beside each swing hanger too, not only at the supports (Structural model, Shear at the hangers, below). A bolt down through the beam leaves a net section, as for bending (NDS 2024 3.1.2.1). Bolts across the beam that the seat hangs from are a connection, and NDS 2024 3.4.4.1 takes shear there on the depth below the bolts. Shear just inside an outer hanger is nearly the support reaction. In the worked example, a 1/2" bolt down through the 4x6 takes the shear margin from 3.51 to 2.98; with 3/8" bolts across the two-ply 2x6, 1-1/2" above its bottom, it goes from 3.02 to 0.83. Shear now waits for the hanger mounting as bending does, and with another mounting it is not computed.

Template version 37 (#536) measures the leg's bolts at the gusset joint against the beam's weight (Bolt layout, below). The beam's weight loads the leg at α to its grain, mostly along it, and before this the leg was measured only across its grain. Two rows are added: the leg's end distance above the top gusset bolt, against the rows for a bolt bearing away from the end (Table 12.5.1A, 2D and 4D), and the spacing of the gusset bolts along the leg's grain (Table 12.5.1B, 3D and 4D). In the worked example both are over every row, 7.374 (14.7D) and 3.858 (7.7D), so no flag changes. No part, cut, or bolt moves.

Template version 40 (#686, decision 0021) plans each stock's boards to buy the fewest feet the search finds, and each lumber line says whether that is proven; the list notes that offcuts run short. The worked examples' boards are the same, since first-fit decreasing already bought the fewest feet for them. No part, cut, or check changes.

Template version 42 (#742) gives the checklist's racking item the reason the frame analysis exploration found (#545, #741). On pads, nothing in the frames themselves holds them along the beam: each foot can turn on its pad and each frame about its leg-to-beam bolt, so how tightly the bolts clamp, the ground anchors, or corner braces keep the frames from leaning. Buried legs hold the frames by bending at grade, and how far the frames lean depends on how tightly the bolts clamp. The item gives no number, since no source gives a load along the beam or a limit on how far the frames may lean. No part, cut, or check changes.

Not covered in version 1: metal A-frame brackets, legs with seat cuts under the beam, corner braces, a gusset on the inside face, crossbar ends cut square, and ground that slopes along the beam.

## Coordinates

- **x** runs along the beam, from the left end (x = 0) to the right end (x = L), looking at the swings from the front.
- **y** runs front to back. The beam's centerline is y = 0; the front (downhill, where the swings swing toward the viewer) is negative y.
- **z** is up. z = 0 is the ground directly under the beam (y = 0). Because the ground is level along the beam, this holds at every x.
- Lengths in decimal inches, angles in degrees (`DOMAIN.md`, Units).

## Parameters

| Parameter | Symbol | Meaning |
|---|---|---|
| Beam length | L | Overall length of the beam |
| Beam height | H | Height of the underside of the beam above the ground directly under it. This is the pivot height the hangers hang from. |
| Splay | α | Angle of each leg from vertical. Can be entered as an angle, or as a footprint depth (the plan-view distance between the outer faces of the front and back legs where they meet the ground), from which α is solved. |
| Beam stock | bw × bd | Actual width (horizontal) and depth (vertical); the beam stands on edge |
| Beam plies | n | 1 for a solid beam; 2 or 3 for a built-up beam of 2x stock, where bw is n times the board's thickness |
| Leg stock | w × t | Actual dimensions; w is measured toward the beam (in the plane of the A-frame), t along the beam |
| Crossbar stock | cw × ct | cw is the crossbar's vertical depth, ct its thickness along the beam |
| Crossbar height | zc | Height of the crossbar's top edge above z = 0 |
| Gusset | gh, gt | Height below the beam, and thickness |
| Frame inset | e | Distance from each beam end to the outside face of that frame's legs (the beam overhang) |
| Ground slope | g | Inches the ground falls per foot of horizontal distance toward the front. 0 is level ground; negative means the front is uphill. |
| Burial depth | d | How far each leg extends below grade, measured vertically. 0 for pads. |
| Swing centers | x₁, x₂ | Position of each swing's center along the beam |
| Hanger spacing | s_h | Distance between a swing's two hangers along the beam |
| Seat width | s_w | Side-to-side width of a seat |
| Seat height | h_s | Height of the seat's underside above the ground under the beam, at rest |
| Hardware | | Bolt diameters and counts, and how the swing hangers mount, confirmed with an experienced builder or read at the store; on pads, ground anchors per foot and one anchor's rated pull-out, read from the anchor maker. No defaults (see Hardware) |

The ground is the line z_g(y) = k·y with k = g / 12, the same at every x.

Every number has a range in the parameter schema (#421, November 2, 2026). Those that had none take one from the beam's: crossbar height and seat height at most 144 (the tallest beam), frame inset at most 120 (half the longest beam), swing centers 0 to 240, hanger spacing and seat width at most 240, and a footprint depth at most 360, past anything a 35° splay reaches from the tallest beam and deepest burial (about 280). Each is wider than Validation already allows, so no plan changes and the template version stays the same. One ground anchor's rated pull-out, added in version 33, is at most 10,000 lb, past any swing set anchor that gives a rating (one kit claims 2,500).

## Derived geometry

Each A-frame is symmetric about y = 0 above the ground, so these formulas are given for the back leg (positive y). The front leg is the mirror image, except at the foot, where its own ground height applies: replace k with −k.

### Leg faces

The leg's inner face, before the flush cut, passes through the beam's lower back corner (bw/2, H), so the flush cut removes nothing at the beam's underside and the most at its top.

- Inner face: y_in(z) = bw/2 + (H − z)·tan α.
- Outer face: y_out(z) = y_in(z) + w / cos α.

### Top of the leg

- **Level cut** at the top of the beam, z = H + bd, across the leg from the flush face to the outer face.
- **Flush cut:** a vertical face at y = bw/2, from the beam's underside (z = H) to the top. On the leg it is a straight cut through the thickness, between two marks measured from the top corner of the inner edge:
  - on the inner edge, bd / cos α down from the corner (where the inner face meets the beam's underside);
  - on the top cut, bd·tan α from the corner, which is bd·sin α in from the inner edge, square to it.

  The cut runs at α to the inner edge. Its two ends are bd·cos α apart along the leg's axis, which is not a distance to mark: measuring that far down the edge instead starts the cut too high and leaves wood that hits the beam (corrected in template version 4, #50).
- **Wood left at the top of the beam:** w − bd·sin α, square to the face. At the bolt (mid-depth of the beam): w − (bd/2)·sin α.
- **Bolt:** horizontal, through both legs and the beam at mid-depth of the beam. Grip length (through all three): bw + 2·(w / cos α − (bd/2)·tan α). The leg's outer face is not square to the bolt, so the head and nut bear on a face tilted α; that goes on the confirmation checklist (washers, counterbore, or bevel washer).

### Where the leg meets the ground

The leg's centerline passes through Q = (bw/2 + w / (2·cos α), H) and runs downward along (sin α, −cos α). It meets the ground at height z_g:

- s = (Q_z − k·Q_y) / (cos α + k·sin α), z_g = Q_z − s·cos α.

### Foot

The foot's level cut is at z_b = z_g − d: at grade for pads, or d below grade for buried legs.

- Length of leg below grade, along the leg: d / cos α.

### Leg length

Both end cuts are level, so they are parallel and the leg is a parallelogram.

- **Each edge, top cut to foot cut:** (H + bd − z_b) / cos α. This is the measurement to mark along either edge.
- **Overall length (stock needed, long point to long point):** (H + bd − z_b) / cos α + w·tan α.

### Footprint at grade

Where each leg's outer face meets the ground: y = (bw/2 + w / cos α + H·tan α) / (1 + k·tan α) for the back leg, and the same with −k for the front leg. The footprint depth is the sum of the two distances from y = 0. This is the layout to mark on the ground, and the value solved against when splay is entered as a footprint.

### Cut settings (miter-saw convention, `DOMAIN.md`)

| Cut | Setting | Angle to the edge |
|---|---|---|
| Leg top (level) | α | 90° − α |
| Leg foot (level) | α | 90° − α |
| Flush cut | taper along the leg | α |
| Crossbar ends | α | 90° − α |
| Gusset sides | α | 90° − α |

The flush cut is a taper along the leg, not a crosscut, so it has no miter setting; the method step (M6) handles how to make it.

### Crossbar

Horizontal, on the outside face of the legs. Each end runs p_c past the leg's outer face, parallel to it (template version 6; Bolt layout below). Before version 6 the ends were flush (p_c = 0).

- Top edge: 2·(y_out(zc) + p_c). Bottom edge (overall, stock needed): 2·(y_out(zc − cw) + p_c).

### Gusset

A trapezoid with its top edge against the beam's underside (z = H) and its sides p_g past the legs' outer faces, parallel to them (template version 6).

- Top width: 2·(y_out(H) + p_g). Bottom width: 2·(y_out(H − gh) + p_g). Height: gh.
- One per frame, on the outside face.

### Bolt layout

Where the crossbar and gusset bolts go, and their distances against NDS 2024 (template version 6; #93, decision 0016). D is the bolt diameter at that joint and n the bolts per joint, both entered.

- **Bolt line:** the leg's centerline. Along a board it is w / (2·cos α) from the leg's outer face.
- **Past the leg:** p = max(0, 7D − w / (2·cos α)), so every bolt is 7D from the board's end along its grain, the full-value end distance whichever way the bolt bears (NDS 2024 Table 12.5.1A, softwood). The end cut stays parallel to the leg.
- **Across the board:** bolt i (from 0) at v = (i + 1/2)·width / n from the bottom edge: one in the middle of each equal strip.
- **In the board:** u = v·tan α + p + w / (2·cos α) from the first end; mirrored from the second.
- **In the leg:** v = w/2, u = (H + bd + (w/2)·sin α − z) / cos α, where z is the bolt's height (the board's bottom plus its v).
- **Distances reported** for each joint, each against the NDS 2024 rows that could apply (Tables 12.5.1A to 12.5.1D and 12.5.1.3), with the table and page. Which load direction each row covers:
  - **Load along the board's grain** (racking, both boards): the board's end distance (along the grain on the bolt's line; both bearing directions), edge distance (Table 12.5.1C, 1.5D), spacing between rows (Table 12.5.1D, 1.5D), and the spread of the outermost bolts across the grain (12.5.1.3, 5").
  - **Load across the leg's grain** (the same racking load, which meets the leg at 90° − α): the leg's edge distance, against both a loaded edge (4D) and an unloaded one (1.5D), since the load can reverse, and the spacing of its bolts along the leg, (width / n) / cos α. A row is bolts in line with the load (12.1.2.4), and the bolts lie along the leg's grain, across this load, so each is a row of its own and the spacing is between rows (Table 12.5.1D, perpendicular: 2.5D for ℓ/D ≤ 2, (5ℓ + 10D)/8 between, 5D for ℓ/D ≥ 6, with ℓ/D as for the edge distance; version 35, #524). Figure 12G draws the same case: under load across the grain, rows are spaced along it. The 5" limit of 12.5.1.3 is across the grain, so it does not apply along the leg.
  - **The beam's weight, across the gusset's grain** (gusset only, version 28, #456): the beam bears down on the gusset's top edge, so the gusset's bolts bear up toward that edge. The top edge is the loaded edge and the bottom edge the unloaded one (Table 12.5.1C: 4D and 1.5D; NDS 2024 Figure 12G draws the same case). Reported: the end distance (Table 12.5.1A, perpendicular: 2D and 4D), the edge distance to the top edge, gh − v for the top bolt, against 4D, and to the bottom edge, v for the bottom bolt, against 1.5D. A row is bolts in line with the load (12.1.2.4), so a joint's bolts are one row, on the leg's centerline at α to the load; their spacing along that line, (gh / n) / cos α, is measured against Table 12.5.1B, perpendicular (3D). Table 12.5.1D, spacing between rows, needs two rows at a joint, and the layout has one. The owner chose this one-row reading on #525 (November 2026) over counting the bolts' offset along the grain, 3.625 · tan α = 1.319 in the worked example, as two rows, which no bolt size the form offers would meet. The crossbar carries no beam weight and gets none of these.
  - **The beam's weight, in the leg** (gusset joint only, version 37, #536): the gusset's bolts carry the beam's weight down into each leg, at α to the leg's grain. NDS 2024 has rows only for load parallel and perpendicular to grain; 12.5.1.2 takes the smallest geometry factor of any condition that applies, so the leg is measured against both. The part across the grain, sin α of the load, pushes toward the leg's inner edge, which the leg's edge distance above already measures against 4D. The part along the grain, cos α of the load, adds two rows. The bolts push the leg down, away from its top, so the end distance is measured against Table 12.5.1A's rows for a bolt bearing away from the end (compression: 2D and 4D), and not the 7D for bearing toward it. It runs along the grain on the bolts' line, from the top bolt to where the wood ends: the flush cut, which the line meets w / (2·sin α) above the beam's underside, or the top cut if that is lower (bd). The gusset's bolts lie on the leg's centerline, so for load along its grain they are one row, (gh / n) / cos α apart, measured against Table 12.5.1B, parallel (3D, and 4D for full value). Table 12.5.1C's 1.5D for an edge under load along the grain is less than the 4D the edge distance is already measured against, so it is not repeated. NDS 2024 12.5.1.2(b) and Figure 12E cover a load at an angle to the bolt's axis, not to the grain, and do not apply: every bolt here is square to the members it joins.
  - For the leg-to-beam bolt, the beam's end and edge distances, the swing loads crossing the beam's grain; in the leg that bolt runs through the leg's width at an angle, which the tables do not describe.
- **Loads assumed** for choosing rows: as listed above. Load direction can reverse under racking, so those end distances list both directions and the leg's edge distance lists both a loaded and an unloaded edge. The beam's weight always pushes down. Softwood lumber.
- **Expert check:** one per joint with a distance under a row's value, naming the distance and the rows.

Worked example (1/2" bolts, two per joint): p = 1.638; crossbar bolts 1.375 and 4.125 up, 2.75 apart, 3.5 (7.0D) from each end; gusset bolts 1.8125 and 5.4375 up, 3.625 apart; the leg's edge distance is 1.75 (3.5D) to each edge, under the 4D (2") NDS gives for an edge the load pushes toward, so both joints carry an expert check. The bolts in the leg are 2.75 / 0.93969 = 2.926 apart along it. ℓ is the lesser of the bolt's length in the leg (3.5) and in the crossbar (1.5), so ℓ/D = 3 and Table 12.5.1D gives (5·1.5 + 10·0.5)/8 = 1.5625 between rows; 2.926 is over it. The gusset's bolts are 3.858 apart along the leg against the same 1.5625 (the gusset is 1.5 thick). The leg-to-beam bolt is 13.75 from the beam's end and 2.75 from each edge.

Under the beam's weight (version 28), the gusset's end distance is 3.5 (7.0D), over 4D (2"). The top bolt is 7.25 − 5.4375 = 1.8125 (3.6D) from the top edge, under 4D (2"), so the gusset's expert check names it as well as the leg's edge distance. The bottom bolt is 1.8125 (3.6D) from the bottom edge, over 1.5D (0.75). The two bolts are 3.625 / 0.93969 = 3.858 (7.7D) apart along the leg's centerline, over 3D (1.5). The gusset joint reports 10 distances, 2 under a row's value.

In the leg (version 37), the bolts' line meets the flush cut 1.75 / 0.34202 = 5.117 above the beam's underside, at z = 101.117, under the top cut at 101.5. The top gusset bolt is at z = 96 − 1.8125 = 94.1875, so its end distance is (101.117 − 94.1875) / 0.93969 = 7.374 (14.7D), over 4D (2"). The bolts are 3.858 (7.7D) apart along the leg's grain, over 4D (2"). The gusset joint now reports 12 distances, still 2 under a row's value. At a 10° splay the line would meet the flush cut 1.75 / 0.17365 = 10.078 up, past the top cut at 5.5, so the end distance runs to the top cut: (101.5 − 94.1875) / 0.98481 = 7.425.

### Positions along the beam

- Left frame legs occupy x from e to e + t; right frame legs from L − e − t to L − e.
- The gusset and the crossbar sit on the outside face (x < e on the left frame).
- Frame centerlines, where the leg-to-beam bolts go, are at x = e + t/2 and L − e − t/2.
- The gusset's top edge is under the beam from x = max(0, e − gt) to e on the left frame, mirrored on the right. The structural checks support the beam at the middle of that edge (Structural model, Beam).

### Swings

- **Hangers:** two per swing, at x_i ± s_h/2. These are the beam's load points for the structural checks.
- **Seat edges:** x_i ± s_w/2.
- **Chain length to set:** H − h_s, from the hanger's pivot to the seat's underside. The hanger hardware's own drop comes out of this; measure it before cutting or adjusting chain.

### Placements

Where each part instance sits in 3D, for drawing (template version 3). Each part has a local frame (`DOMAIN.md`, Geometry; `Placement` in `model/types.ts`):

- **along**: the part's length, from its first end to its second (the cut list's end order);
- **across**: its width, from its reference edge (the edge on which the first end cut has its long point);
- **through**: its thickness, so the frame is right-handed;
- **origin**: the corner where the first end meets the reference edge, on the face where *through* starts.

The part's outline follows from its own data: the first end cut runs u = v·tan(setting), the second u = length − (width − v)·tan(setting) for parallel ends or u = length − v·tan(setting) otherwise.

| Part | First end, reference edge | Origin | along, across, through |
|---|---|---|---|
| Beam, ply i (from 0) | Left end, bottom edge | (0, bw/2 − i·bw/n, H) | +x, +z, −y |
| Back leg | Top, inner edge | (x_f, bw/2 − bd·tan α, H + bd) | (0, sin α, −cos α), (0, cos α, sin α), +x |
| Front leg | Top, inner edge | (x_f + t, −(bw/2 − bd·tan α), H + bd) | (0, −sin α, −cos α), (0, −cos α, sin α), −x |
| Crossbar | Front end, bottom edge | (x_o, −(y_out(zc − cw) + p_c), zc − cw) | +y, +z, +x |
| Gusset | Front end, bottom edge | (x_o, −(y_out(H − gh) + p_g), H − gh) | +y, +z, +x |

- **Instances:** instance 0 is the left frame and instance 1 the right.
- **Legs:** x_f = e for the left frame and L − e − t for the right. The front leg's thickness runs toward −x so its frame stays right-handed.
- **Crossbar and gusset:** they sit on each frame's outside face, so x_o = e − thickness for the left frame and L − e for the right.
- **Inner face at the top:** the legs' inner face at the top cut, bw/2 − bd·tan α, is inside the beam; the flush cut removes that wood. The placement is of the blank before the flush cut, which #50 adds as part data.



Plan view, values from the CPSC home handbook (`DOMAIN.md`, Layout and clearances), each shown with its source:

- **Frame footprint at grade:** x from 0 to L (the beam), y from −(front outer at grade) to +(back outer at grade).
- **Clear area:** the footprint plus 72 inches on every side.
- **Swing zones:** for each swing, x across its seat (x_i ± s_w/2), y from −2·H to +2·H.
- The area to keep clear of structures and cover with surfacing is the union of the clear area and the swing zones.

### Hardware

Every structural connection is a through-bolt with a flat washer at each end and a locking nut, following the CPSC home handbook (`DOMAIN.md`, Hardware guidance). Sizes and counts are inputs confirmed with an experienced builder, never defaults. The template computes quantities and grip lengths (the thickness of wood each bolt passes through).

| Connection | Inputs | Quantity | Grip |
|---|---|---|---|
| Leg to beam | diameter | 1 per frame | bw + 2·(w / cos α − (bd/2)·tan α) |
| Crossbar to leg | diameter, bolts per joint | 4 joints | ct + t |
| Gusset to leg | diameter, bolts per joint | 4 joints | gt + t |
| Beam plies (built-up beams only) | diameter, total count | as entered | bw |
| Swing hangers, one bolt down through the beam | diameter | 4 | bd, plus the hanger's plate |
| Swing hangers, bolts sideways through a bracket | diameter, bolts per hanger, hole height | 4 × bolts per hanger | bw, plus the bracket's two sides |

- **Bolt length** (version 22, #449): at least the grip plus two washers and the nut, and no more than one bolt diameter past the nut (CPSC p. 3). Kerf takes the washers as USS flat washers at their largest thickness (ASME B18.21.1-2009) and the nut as a nylon-insert locknut at its largest height (ASME B18.16.6-2008, Table 1), so L_min = grip + 2·washer + nut and L_max = L_min + D (`structural/boltLength.ts`). The length to buy is the shortest half inch from L_min to L_max, or the shortest quarter inch when no half inch is in it; for the diameters the form offers, a quarter inch always is, since D ≥ 3/8. The shopping line names the bolt by that length, and its note gives the grip and the range, rounded inward to the 1/16 (`formatLimit`), so any bolt the store has in that range fits. Worked example, 1/2" bolts (washer 0.132, nut 0.609): the leg-to-beam bolt's grip 8.947 gives 9.820 to 10.320, so 10", noted as 9-7/8" to 10-5/16"; the crossbar and gusset bolts' grip 5 gives 5.873 to 6.373, so 6". With 5/8" leg bolts (washer 0.160, nut 0.765): 10.032 to 10.657, so 10-1/2". With a 4x8 beam, the leg-to-beam grip falls by 1.75 · tan 20° = 0.637, to 8.310, so a 1/2" bolt fits from 9.183 to 9.683 (9-1/2"), and a reset note on 10" bolts bought for the 4x6 says they are too long for it (#514).
- **Per bolt:** two flat washers, one locking nut, and one cap for the exposed end.
- **Swing hangers:** 4, rated for swing use. Their rating is a structural input checked in M2.
- **Hanger mounting** (version 29, #446): how each hanger fastens to the beam, read on its package or instructions, with no default (hard rule 3). It is one of: one bolt down through the beam, on its centerline; bolts sideways through the beam, through a bracket's two sides, in one row at a height read off the bracket (its holes' centers above the beam's underside); or another way, such as screws, lag screws, or a clamp. A bolted mounting asks the bolt's diameter, and sideways bolts also how many per hanger. Each hole is the bolt plus 1/16" (NDS 2024 12.1.3.2, as for every bolt since version 9). A sideways hole must lie within the beam's depth; a height that puts it past the top or bottom is refused. Until the mounting is entered, the plan lists no hanger bolts and the beam's bending check says the mounting is needed.
- **Hanger bolts** (version 29): listed with the other bolts, with two washers, a locking nut, and a cap, like every bolt. The hanger's own plate or bracket is in the grip, and only the hanger says how thick it is, so the line gives the wood's grip (bd down through the beam, bw across it), says to add the hanger, and names no length to buy. Many hangers come with their bolts, and the note says to check those against this length.
- **Swing seats:** 2, lightweight (CPSC p. 4), with chain set to the chain length.
- **Ground anchors:** for pads (d = 0) only, anchors per foot as entered, 4 feet. Buried legs need none. Until the count is entered the anchors are listed with no quantity, marked as waiting for it (version 16, #406), so a plan on pads can be made before the store. One anchor's rated pull-out, in pounds, is entered beside the count (version 33, #467) for the anchor check (Structural model); it has no default and is never suggested (hard rule 3). Many anchor kits print no rating, and the help says to ask the maker.
- All hardware corrosion-resistant and compatible with the lumber's pressure treatment (CPSC p. 3).
- **Treated lumber** (version 22, #449): IRC 2021 R317.3.1 requires fasteners, including nuts and washers, in preservative-treated wood to be hot-dip galvanized steel (zinc coating to ASTM A153), stainless steel, silicon bronze, or copper, and its exception 2 allows mechanically galvanized steel to ASTM B695 Class 55 or heavier for fasteners other than nails, staples, and timber rivets. The hardware notes name these. Its exception 1 exempts steel bolts 1/2" and larger; Kerf does not use it, since CPSC asks for corrosion-resistant hardware on a play set. The IRC is a code for houses, read here as the reference for which materials suit treated lumber.
- **Preservative** (version 27, #447): one wood preservative for cut ends, in its own store group, "Paint and stain", for the field treatment below. Its notes say IRC 2021 R317.1.1 requires it, to choose one labeled for treating cuts in treated wood, and that copper naphthenate suits any treated lumber while boron is only for wood off the ground and out of the rain. They give AWPA M4-06's figures for copper naphthenate: at least 2.0% copper as metal, or 1.0% where that is not readily available (7.1.1). IRC 2021 refers to M4-15, which is sold and could not be read; the 2006 edition was read in full. Secondary summaries that give only 2% or only 1% each quote half of 7.1.1.
- **Notes on the lines** (version 22): each item's notes are carried to its shopping line, and the plan's list and Shopping mode show them under it.
- **Store groups** (version 12): the bolts and their washers, nuts, and caps are "Bolts and fittings"; the hangers and seats are "Swing hardware"; the ground anchors are "Ground anchors"; the preservative is "Paint and stain" (version 27). The store checklist shows them in that order, after the lumber.
- **Read at the store** (#390): the beam's species and grade (from the grade stamp) and whether it is incised are asked beside the lumber lines that hold the beam, the legs' the same way beside the lines that hold the legs (version 34), the hanger rating beside the swing hangers, how the hangers mount (and, when bolted, the bolt diameter, and for sideways bolts the count and hole height) beside the swing hangers, and, on pads, the ground anchors per leg foot and one anchor's rated pull-out beside the anchors (`storeReadings.ts`). Each says where to look, and once entered, shows the value with a link to change it.

### Tools for the work

The tool-type library (`packages/core/src/knowledge/tools.ts`, #85) is checked against this table: every tool here is in the library, and the library has nothing this work could not use. Operations as data are #103; methods, which choose among these tools, are #104.

| Work | Parts | Tools that could do it |
|---|---|---|
| Measure and mark lengths, end cuts, and the flush-cut marks | all | tape measure, combination square, rafter square, sliding bevel (angles to the edge), chalk line (the flush cut along a leg) |
| Square crosscuts | beam | miter saw, circular saw, hand saw |
| Angled crosscuts at the splay angle | legs (top and foot), crossbars, gussets | miter saw, circular saw, hand saw; laid out with a rafter square or sliding bevel |
| The flush cut along the inside of each leg's top | legs | circular saw, jigsaw, or hand saw to cut; chisel or block plane to clean up |
| Bolt holes through thick stock (leg, beam, leg; boards and legs) | all bolted parts | drill/driver with auger or spade bits, drilled from one side or both depending on reach; clamps hold the parts while drilling |
| Tighten bolts and locking nuts, once the frame is set | all bolted parts | socket wrench, impact driver (run down, finished by hand) |
| Ease edges and splinters | all | sander, block plane |
| Treat cuts and bolt holes with preservative | all | none from the library: a brush, a tray to stand ends in, or a small bottle to pour into holes |
| Lay out the footprint and set the frames level and plumb | site | tape measure, string line, line level, level |
| Dig for buried legs, or level pads | site | post-hole digger, shovel, tamper |
| Stand the A-frames up and hold them plumb with temporary braces | legs, crossbars, gussets | level; drill/driver or impact driver to screw the braces on, or clamps |
| Backfill buried legs in layers | site | shovel, tamper (or the shovel's handle), level |
| Anchor feet on pads | site | shovel to cover the anchors; a sledgehammer for driven anchors (screw-in anchors are turned with a bar, not a library tool) |
| Hang the swings | beam | stepladder, pliers, tape measure |

### Operations

What needs doing, before any choice of how (`DOMAIN.md`, Operations; methods are #104). Generic code makes the cuts and bolt holes from the parts and hardware, so their numbers are the cut list's own; the template adds the rest.

| Operation | Parts | From |
|---|---|---|
| Crosscut (square) | beam, both ends | each end cut with setting 0 |
| Miter at the splay angle | legs (top and foot), crossbars and gussets (both ends) | each angled end cut |
| Taper: the flush cut | each leg | the leg's taper; it runs the beam's depth bd at α to the edge |
| Bolt holes | leg to beam (through leg, beam, leg); crossbar and gusset to legs | each through-bolt item: its quantity, diameter, and grip as the depth |
| Bolt holes: the swing hangers | beam | the hanger bolts: down through the beam at each hanger, placed on the beam's centerline at x_i ± s_h/2; or across it, drilled through the bracket's holes at its mark, so not placed (version 29) |
| Ease edges | every part | CPSC: kids touch every surface (`DOMAIN.md`, Lumber and finish) |
| Treat cuts | every part | each part's ends and flush cut, since every part is treated lumber (IRC 2021 R317.1.1; `DOMAIN.md`, Field treatment) |
| Treat bolt holes | each through-bolt item's holes | after its bolt holes, through the treated parts it joins (all of them) |
| Dig holes (d > 0), or level pads (d = 0) | one per leg | burial depth d |
| Raise (version 31) | 2, each A-frame: legs, crossbar, gusset | `height` H + bd, how far up the legs reach |
| Backfill (d > 0), or anchor (d = 0) (version 31) | one per leg | burial depth d |
| Tighten bolts (version 31) | one per through-bolt item, as drilled | each bolt-holes operation's count and diameter (`tighteningOperations`) |
| Hang (version 31) | 2 seats | `height` h_s, the seat's underside above the ground |

Worked example: the flush cut is √((5.853 − 0.685)² + 1.881²) = 5.500 = bd long at 20° to the leg's edge. Holes: 2 leg-to-beam holes 8.947 deep (the grip), 8 crossbar and 8 gusset holes 5 deep, and 4 hanger holes 9/16" across and 5.5 deep, down through the beam at 30, 50, 70, and 90. Four holes 24 deep. Field treatment: 3 cuts on each leg (top, foot, flush cut) and 2 on the beam, each crossbar, and each gusset; the same 2 + 8 + 8 + 4 bolt holes, 9/16" across. Putting it up: 2 A-frames raised, reaching 96 + 5.5 = 101.5; 4 holes backfilled 24 deep; 2 leg-to-beam, 8 crossbar, 8 gusset, and 4 hanger bolts tightened, all 1/2"; 2 seats hung 16 above the ground.

Every part is treated: the beam checks take a waterborne preservative treatment (NDS 4.3.13, Structural model), and the legs stand in or on the ground. The generic operations follow from each part's `treated` flag and are added after the template's own (`treatmentOperations`).

### Build steps

Cutting goes board by board in the board plan's order (#58): generic code makes one step per board, listing its pieces in the order they come off it, with each piece's end cuts and flush cut. The template orders the steps after cutting (`steps.ts`, #105). Methods are chosen from the tool inventory by generic code (`ARCHITECTURE.md`, Method selection).

| Step | Operations | Expert checks |
|---|---|---|
| Cut board 1, 2, ... (one per board), titled with what comes off it ("Cut board 6, a 2x6 10' long: 2 × Crossbar") | the end cuts and flush cuts of its pieces | |
| Ease the edges of every part | ease edges, every part | from the method (dust) |
| Treat every cut with preservative (version 27) | treat cuts, every part | |
| Dig the leg holes, or Level the pads | dig holes or level pads | load-bearing design |
| Bolt the crossbars and gussets across the legs | crossbar and gusset bolt holes, each followed by treating them | load-bearing design |
| Drill the swing hanger holes in the beam (once the mounting is bolted, version 29) | hanger bolt holes, then treating them | load-bearing design, dynamic loads |
| Stand the frames up and brace them (version 31) | raise, both A-frames | load-bearing design |
| Bolt the beam between the leg tops | leg-to-beam bolt holes, then treating them | load-bearing design, dynamic loads |
| Plumb the frames and backfill the leg holes, or Plumb the frames and anchor the feet (version 31) | backfill or anchor | load-bearing design |
| Tighten every bolt and cap its end (version 31) | tighten bolts, every through-bolt item | load-bearing design |
| Hang the swings (version 31) | hang | dynamic loads |

Each step also shows the plan's own flags for its work (Flags, below).

The cuts are treated after the edges are eased, since rounding a corner also opens wood the treatment may not have reached, and before the site work, so a leg's foot is coated before it goes in the ground. AWPA M4-06 5.2 asks for the end of a column in ground contact to be an original untrimmed end or field-treated; the leg's foot is cut at the splay angle, so it is treated.

The assembly order is the owner's to choose with an experienced builder, and a flag on the step that stands the frames up states both (Flags, below). Until then the steps follow the first: bolt the crossbars and gussets across each pair of legs on the ground, stand each A-frame up and brace it, then lift the beam onto the gussets and drill and bolt it between the leg tops there. The other order lays the A-frames on their sides, bolts the beam between them on the ground, and tips the whole frame up.

The frame is plumbed and its legs backfilled or its feet anchored before the bolts are tightened, since a tightened bolt holds the frame as it stands. The braces stay on until the legs are set.

Each step that puts the frame up carries the rules the CPSC home handbook (Pub. 324, 2005, read November 2026) gives for its work, as notes (`StepOutline.notes`):

- **Anchor the feet:** follow the anchor maker's instructions, and bury or cover the anchors (p. 4).
- **Tighten every bolt:** tighten all connections, with a locking nut on every bolt (pp. 3 and 4); cap every exposed bolt end, which stands no more than one diameter past the nut (p. 3); check the nuts and bolts twice a month and tighten them as needed, with the caps in place (p. 5).
- **Hang the swings:** close S-hooks and all other hooks to a gap less than the thickness of a dime, with an open hook only at the uppermost attachment (p. 3); lightweight seats (p. 4); at least 8 inches between the surfacing and a seat's underside (p. 5); no rope that can untwist or separate (p. 8); seats and chains checked monthly (p. 5).

The generic methods carry their own sourced safety notes: two or more people for the lift (OSHA Electrical Contractors eTool, Heavy Lifting), backfill in shallow layers tamped firm with the post plumb and the top mounded (NRCS Colorado, Conservation Practice Standard 382, December 2014), bolts checked again as the wood dries, since it shrinks across the grain (Wood Handbook, ch. 4, p. 4-7), and a stepladder locked open on level ground, never stood on at its top step (OSHA 29 CFR 1926.1053). No published interval for tightening again as treated lumber dries was found; the CPSC's twice a month covers it.

Worked example, the boards (`steps.test.ts`; 1/2" trim per end and 1/8" kerf per piece): the beam alone on a 12' 4x6, leaving 144 − (1 + 120.125) = 22.875; each leg on its own 12' 4x4, since two do not fit; both crossbars on a 10' 2x6 (1 + 2 · 59.118 = 119.236); both gussets on an 8' 2x8, leaving 96 − (1 + 2 · 19.627) = 55.746. A leg's cuts are done once on its board, a crossbar's twice on the board that holds both.

Worked example, two inventories (`steps.test.ts`): a shop with a miter saw that cuts a 4x4, a jigsaw, and auger bits reaching 10" uses the miter saw for every end cut, the jigsaw for the flush cuts, and drills every hole from one side. A kit with a circular saw cutting 2-3/8" and spade bits reaching 6" cuts the 4x4s from two faces (2-3/8" ≥ 3-1/2" / 2), the 2x boards in one pass, drills the board holes (5") from one side and the leg-to-beam holes (8.947) from both sides (6 ≥ 4.47), and is offered the auger and longer spade bits as easier and more accurate. The angled-line offset on a 4x4 is 3.5 · tan 20° = 1.274, shown as 1-1/4"; on a 2x6, 5.5 · tan 20° = 2.002, shown as 2". Both, and an empty toolbox, brush on the field treatment, since its methods need no tool from the library.

### Board selection

Each part lists the board selection guides that apply to it, from the knowledge base (`packages/core/src/knowledge/boardSelection.ts`), and the shopping list carries them by part ID.

| Part | Guides | Why |
|---|---|---|
| Beam | every board that carries load; across a span; joined with bolts | It spans between the frames and is bolted to the legs. |
| Legs | every board that carries load; along its length; joined with bolts; in or on the ground | They carry the beam down to the ground and are bolted at the top. A leg stands in or on the ground whether it is buried or on a pad, so it always gets the ground-contact guide. |
| Crossbars, gussets | every board that carries load; joined with bolts | They are bolted across the legs. |

### Not in stock

Each lumber line lists what else to buy when the store has none of its boards (version 25, #450). Generic code gives the other lengths (`DOMAIN.md`, Buyable lengths). The template gives one stock parameter, the beam's. The beam checks also read the legs' and gussets' sizes, through the span between the gussets, but a margin from them says nothing about whether a leg or gusset is strong enough, so those parts and the crossbars get no other size. The legs' check (version 34) reads the beam's size through its weight and width, but says nothing of the beam, so beam sizes are measured against the beam and hanger checks only, and the legs get no other size: their check is not computed in the worked example, so there is no margin to keep. A beam size is offered when the whole plan generates with it and the lowest margin among the beam checks is no lower than the plan's now, with that margin; while those checks need structural inputs, the line says another size changes the plan and its margin follows once they are entered. Changing a size changes the plan, so it opens the field in Edit.

Worked example (`lists.test.ts`, every input entered): the beam's 12' line also takes a 10' board that measures at least 121-1/8", a 14', or a 4x8 beam (margin 1.6x, bending, against 0.98 with the 4x6); the legs' line takes 14' boards; the crossbars' 10' line takes two 8's or a 12'; the gussets' 8' line a 10'. A 4x4 or 6x6 beam lowers the margin and is not offered.

### Drawings

The drawings (#90) are drawn from the stored outputs; no number in them is new.

- **Isometric and exploded views:** true isometric, the viewer above the front-left corner (toward −x, −y). The ground is the plane z = k·y through the point under the beam; leg faces below it are drawn as hidden lines, with a grade line where they meet it. The chains (from each hanger at the beam's underside down to the seat height) and the seats are phantom lines.
- **Exploded view:** the beam pulled up 30, each crossbar and gusset pulled 24 outward along the beam (−x for the left frame, +x for the right), each with a guideline from where it goes. The legs stay.
- **Cut details:** one per part, from its cut-list data, holes, and taper.
- **Site layout:** the clear area and swing zones as zones with their CPSC sources, the frame footprint as an outline, the beam, and the seats.
- **Action drawings** (Building mode, #118): one per assembly step, from the same view and the exploded view's pulls. "Bolt the crossbars and gussets across the legs" adds the legs in place and the crossbars and gussets pulled 24 outward, each with an arrow back to where it goes. "Bolt the legs to the beam" adds the beam pulled up 30 with an arrow down to it, on the frames already built. The chains and seats are left out until the beam is up. Hand check: the beam's 30 pull moves it 30 · 2/√6 = 24.495 up the page; a crossbar's 24 pull toward −x moves it 24/√2 = 16.971 left and 24/√6 = 9.798 down.

Hand check, worked example: the beam's top front corner at its left end, (0, −1.75, 101.5), projects to page (1.75/√2, −(−1.75 + 2·101.5)/√6) = (1.237, −82.160), with page y down.

## Joints (decision 0020)

The template says where each part runs and how its bolts lie. The joints in core's `joints/` give the rest (`templates/swing-set-a-frame/joints.ts`, template version 38, #626):
- **Trims:** each part is cut to a plane at each end, which gives its end cuts, length, marked edges, and placement.
  - The beam's plies are square at x = 0 and L.
  - The legs are cut level with the top of the beam, and level at the foot cut.
  - The crossbars and gussets run front to back on each frame's outside face, cut parallel to the legs' outer faces, the distance past them that Bolt layout gives.
- **Bolted laps:** each bolt is given by its line and the parts it passes through, in order. Its holes are where the line runs inside each part, and its grip is the sum of them.
  - Leg to beam: the bolt runs level at the beam's mid-depth on the frame's centerline, from back to front, drilled from each leg's outer edge and each ply's back face.
  - Crossbar and gusset: the bolts run across the frame on the leg's centerline, through the board and then the leg.
  - Vertical hanger bolts run down through the beam's centerline.

The ply bolts and the horizontal hanger bolts are drilled where the plies or bracket put them, so they are not placed. The leg's flush cut is the template's.

The legs', crossbars', and gussets' lengths come from the trims alone: each part's length, and its marked edges (a leg's inner edge, a board's top and bottom edges). The formulas for them in Derived geometry are how to check the trims by hand; the template does not compute them separately. A plan stores the trimmed lengths in its geometry as `edgeLength` and `overallLength` for each leg, `topEdge` and `bottomEdge` for the crossbar, and `topWidth` and `bottomWidth` for the gusset. Validation, the structural model, and the hardware lines do not read them. The bolt layout needs only how far each board runs past the leg.

Each bolt's grip comes from the bolted laps alone (#644). The hardware lines are made after the joints run, so the leg-to-beam, crossbar, gusset, and vertical hanger bolt lines take their grips from them, and the bolt lengths and notes follow; only the ply bolts and horizontal hanger bolts, which are not placed, take the beam's breadth. The grip formula in Derived geometry (bw + 2·(w / cos α − (bd/2)·tan α)) is how to check the leg-to-beam grip by hand. A plan stores that grip as `boltGrip`, which the flags and the structural checklist read. No output changed, so the template version stays 39.

The joints compute their trigonometry another way from the template's formulas, so some numbers differ in their last bits, at most 2.8 × 10⁻¹⁴" in the worked examples. Everything a plan shows is the same, string for string, but the stored numbers differ: the template version moved to 38 when the joints first cut the parts (#626), and to 39 when the stored lengths came from them (#642).

## Starting questions

A new project can start from a few plain questions (#163). Kerf asks only what it cannot know, fills in the rest from the worked example and stated rules of thumb, and opens the form filled in, with the preview. Each suggested value says where it came from. Nothing is saved until Create. `questions.ts` implements this section.

| Question | Sets |
|---|---|
| Who will ride: only kids, or kids and adults | Beam height, from a rule of thumb, capped by the depth |
| Heaviest rider on each swing, with seat and chain | The rider weights, a structural input, as answered (hard rule 3) |
| Open space: length along the beam, depth front to back | Beam length and swing centers; caps the beam height |
| Ground: level, or sloped front to back and by how much | Ground slope g (0 for level) |
| Leg feet: on pads or buried | Burial depth d |

Three structural inputs are suggested with no question, each stored with its basis and unconfirmed until the owner ticks it in the structural review or changes it (hard rule 3 as amended in #355 and #417; #388). Saving the form does not confirm them. The bolt sizes the bolt layout check suggests are treated the same way.

| Input | Suggested | Basis |
|---|---|---|
| Maximum swing angle | 90°, chains level with the beam | The largest angle the pendulum model takes, so the largest load it gives: 3 − 2·cos 90° = 3. A stated bound, not a guess at how high anyone swings. |
| Deflection limit | 240 (span / 240) | International Building Code (2021), Table 1604.3, floor members, l/240 under dead plus live load, read at codes.iccsafe.org. The deflection check's load is dead plus live (the swing load and the beam's own weight). A swing beam is not in the table, so the note says the limit is borrowed from the closest member type. |
| Beam moisture content | 30% | The fiber saturation point of Simpson's density equations (FPL-GTR-76, 1993, Eq. 4), which `woodDensity` already uses. The plan treats the beam as wet service, outdoors and uncovered; the note says pressure-treated lumber is often sold wetter and weighs more. |

The review in #355 proposed asking "Will the beam stand outdoors, uncovered?" to set the moisture. The plan already treats the beam as wet service whatever the answer, so the question would change only the beam's weight; it is left out until the wet-service factor follows an answer too.

Bolts (#389): for each joint, the largest diameter the form offers (3/8" to 3/4") whose distances in the bolt layout below are all within NDS 2024 Tables 12.5.1A to 12.5.1D on the suggested frame, and two bolts per crossbar and gusset joint, the worked example's count. Basis: NDS 2024, those tables; note: Kerf computes no bolt capacity, so settle the size with an experienced builder. Hand check, worked example: a board's bolts are 3-1/2 / 2 = 1-3/4" from the leg's loaded edge, and 4D is 1-1/2" for 3/8" and 2" for 1/2", so 3/8" at the crossbars and gussets; the gusset's top bolt is 7-1/4 / 4 = 1-13/16" from its top edge, loaded under the beam's weight (version 28), which gives the same 3/8"; the leg-to-beam bolt is 5-1/2 / 2 = 2-3/4" from the beam's edges, and 4D is 2-1/2" for 5/8" and 3" for 3/4", so 5/8". The two-ply 2x6 beam gives the same. With no frame (parameters the template rejects), the sizes stay empty.

Not suggested: ply bolts (no published schedule gives bolts; IRC 2021 R507.5 nails deck beam plies, two rows of 10d at 16" on center, and the help says so), ground anchors (the anchor maker's instructions), and the structural inputs only the owner or what they buy can say (species and grade, incised, hanger rating; #390 prompts for these at the store), and the dynamic factor, for which no published value was found; the review and the field show the factor at which each strength check reaches margin 1.0 instead (#401). Stock comes from the worked example and is never sized from the loads; the preview shows its margin under the owner's loads, and the break-even dynamic factor for it and for the next deeper stock (#466; Structural model, Deeper stock), so the owner can choose another (`PRODUCT.md`, Non-goals).

### Rules

The space means open ground with nothing in it, so the CPSC clear area and swing zones (Site layout, `DOMAIN.md`, Layout and clearances) must fit inside it.

- **Beam height H.** Rule of thumb: 96 (8 ft) for kids only, 120 (10 ft) with adults. No published source gives a conventional height for home swing sets; the owner accepted a labeled rule of thumb (October 30, 2026). What was looked at: kit listings around 8 ft tall and builders' write-ups of adult-use frames at about 10 ft. The swing zones run 2·H in front of the beam and 2·H behind, so the depth D allows at most H = floor(D / 4). If that is less than the rule of thumb, Kerf suggests floor(D / 4) and says it was lowered to fit the depth, citing the CPSC zones.
- **Beam length L.** The worked example's 120. The clear area adds 72 at each end, so the length A allows at most floor(A − 144). If that is less than 120, Kerf suggests it and says it was shortened to fit the length. Two swings need at least shortestBeam = 3·max(8 + s_w/2 + e + t, 8 + s_w) = 3·max(8 + 10 + 12 + 3.5, 28) = 100.5 with the worked example's seats, inset, and legs (the CPSC 8" seat gaps, Validation).
- **Smallest space (#458).** The answers are refused, with the error on the field, when no beam fits. Along the beam the space must give the shortest beam rounded up as the suggestion is, ceil(100.5) = 101, plus the clear area at each end: 101 + 144 = 245 (20' 5"). Front to back it must give the swing zones of the schema's lowest beam: 4 · 60 = 240 (20' 0"). The errors read "Length along the beam must be at least 20' 5" for two swings and their clear area." and "Depth, front to back, must be at least 20' 0" for the swing zones of the lowest beam Kerf draws, 5' 0"."
- **Swing centers.** Rule of thumb: at L/3 and 2·L/3, to the nearest 1/16. The worked example is the case L = 120: 40 and 80.
- **Crossbar height zc.** Rule of thumb: the worked example's share of the beam height, floor(H · 40/96).
- **Ground slope, burial depth.** g as answered (0 for level). Pads give d = 0; buried legs the worked example's 24, with a note to settle the depth with an experienced builder (the plan flags it).
- **From the worked example:** beam 4x6, one ply; legs 4x4; crossbar 2x6; gusset 2x8; splay 20° as an angle; frame inset 12; seat width 20; seat height 16 (chains adjust it, so no question). Hanger spacing is the seat width (rule of thumb: chains hang straight).

The clear area stays inside the swing zones front to back for every suggestion: with α = 20°, half the footprint plus 72 is under 2·H for any H of 60 or more, even on the steepest slope. Tests generate each worked set below and check that the clear area and swing zones fit the space.

### Worked examples (hand-checked)

| | Kids only | Kids and adults | A small yard | The smallest space |
|---|---|---|---|---|
| Riders, weights | kids; 90, 110 | kids and adults; 220, 110 | kids and adults; 200, 90 | kids; 90, 110 |
| Space, length × depth | 30' × 40' (360 × 480) | 30' × 40' | 21' × 28' (252 × 336) | 20' 5" × 20' 0" (245 × 240) |
| Ground, feet | level, pads | sloped 1 in/ft, buried | level, buried | level, pads |
| H: rule, floor(D/4) | 96; 120 → **96** | 120; 120 → **120** | 120; 84 → **84**, with a note | 96; 60 → **60**, with a note |
| L: floor(A − 144) | 216 → **120** | 216 → **120** | 108 → **108**, with a note | 101 → **101**, with a note |
| Swing centers | 40, 80 | 40, 80 | 36, 72 | 33-11/16, 67-5/16 |
| Crossbar height | floor(96 · 40/96) = 40 | floor(120 · 40/96) = 50 | floor(84 · 40/96) = 35 | floor(60 · 40/96) = 25 |
| g, d | 0, 0 | 1, 24 | 0, 24 | 0, 0 |

The small yard's notes: "Lowered to fit your 28' 0" depth. The usual height, 10' 0", needs 40' 0" front to back for its swing zones." and "Shortened to fit your 21' 0" length along the beam. The worked example's beam, 10' 0", needs 22' 0" with the clear area at each end." Its seats at 108 are 36 − 10 − 15.5 = 10.5 from each frame and 72 − 36 − 20 = 16 apart, both over 8. The smallest space's centers are 101/3 = 33.667 and 202/3 = 67.333, to the nearest 1/16; its seats are 33-11/16 − 10 − 15.5 = 8-3/16 from each frame and 67-5/16 − 33-11/16 − 20 = 13-5/8 apart. One sixteenth less along the beam (244-15/16) or front to back (239-15/16) is refused with the error above; the usability audit's 14' × 26' 6" is refused along the beam, 168 < 245.

## Validation

Rejected combinations, each with a message saying which values conflict:

- w − bd·sin α ≤ 0 (the flush cut would go through the leg). Less than 1 inch left also gets an **expert check** flag.
- The crossbar overlaps the gusset (zc > H − gh), or its bottom edge is at or below grade at the back (uphill) leg.
- Ground so steep that a leg meets the ground at or above the beam.
- 2·(e + t) ≥ L (the frames don't fit on the beam).
- More than one ply of anything other than 2x stock.
- A seat closer than 8 inches to the other seat or to a frame's inside face (CPSC).
- A seat underside less than 8 inches above the ground (CPSC).
- A seat at or above the beam (h_s ≥ H), which leaves no chain to hang it from.
- Hangers of the two swings overlapping, or a hanger outside the span between the frames' inside faces.
- A built-up beam without ply bolts. Pads without an anchor count generate, with the anchors' quantity still needed (#406).
- Any length, stock dimension, or angle outside its range in the parameter schema.

## Flags

- The leg-to-beam bolt and the flush cut: **expert check** on bolt size, the wood left at the bolt, and bearing on the tilted outer face.
- Buried legs (d > 0): **expert check** on burial depth, and on lumber rated for ground contact (UC4A, or UC4B if the legs are critical or hard to replace, AWPA U1-25), since decay is fastest at the ground line.
- Pads (d = 0): **expert check** on ground anchors (`DOMAIN.md`, Tipping and anchoring).
- Built-up beam (n > 1): **expert check** on how the plies are fastened together.
- Sloped ground (g ≠ 0): **expert check**, since the CPSC handbook recommends a level site.
- Bolt layout and projecting board ends: **expert checks** from the bolt layout (Bolt layout, above).
- The order the frame goes up in (version 31): **expert check** stating both orders (Build steps, above), why each is hard (the beam lifted H onto braced frames and drilled from a ladder, or the whole frame lifted at once), and OSHA's two or more people for a load over 50 pounds.

Each flag and checklist item names the parts and hardware it concerns (#51). A build step shows a plan flag on the first step that drills for its hardware, or else the first that works on one of its parts (`ARCHITECTURE.md`, Method selection):

| Flag | Parts | Hardware | Build step |
|---|---|---|---|
| Leg-to-beam bolt and flush cut | legs, beam | leg-to-beam bolts | Bolt the beam between the leg tops |
| Thin flush cut | legs | | First board with a leg |
| Built-up beam | beam | ply bolts | Bolt the beam between the leg tops |
| Sloped ground | legs | | First board with a leg |
| Buried legs | legs | | First board with a leg |
| Pads | legs | ground anchors | First board with a leg |
| Crossbar or gusset bolt distances | that board, legs | its bolts | Bolt the crossbars and gussets across the legs |
| Projecting board ends | the boards that project | their bolts | Bolt the crossbars and gussets across the legs |
| The order the frame goes up in | legs, beam | leg-to-beam bolts | Stand the frames up and brace them, where the template places it (`Flag.step`) |

Leg length depends on the slope and the burial depth, so those are asked before the legs are cut. Ground anchors have no drilling operation, so the pads flag goes with the legs.

## Worked example (hand-checked)

Inputs: L = 120, H = 96, α = 20°, beam 4x6 on edge (bw = 3.5, bd = 5.5), legs 4x4 (w = 3.5, t = 3.5), crossbar 2x6 (cw = 5.5) at zc = 40, gusset from a 2x8 (gh = 7.25, gt = 1.5), e = 12, ground falling g = 1" per foot toward the front (k = 1/12), burial depth d = 24.

| Quantity | Value |
|---|---|
| sin α, cos α, tan α | 0.34202, 0.93969, 0.36397 |
| Flush cut depth at the top, square to the face | 5.5·0.34202 = 1.881 |
| Wood left at the top of the beam | 3.5 − 1.881 = 1.619 |
| Wood left at the bolt | 3.5 − 0.941 = 2.559 |
| Flush cut length along the leg | 5.5·0.93969 = 5.168 |
| Bolt grip | 3.5 + 2·(3.7246 − 1.0009) = 8.947 |
| Q | (3.6123, 96) |
| Back (uphill) leg meets ground | s = (96 − 0.3010) / (0.93969 + 0.02850) = 98.843; z_g = 96 − 98.843·0.93969 = 3.118 |
| Back foot cut height z_b | 3.118 − 24 = −20.882 |
| Back leg edge, top cut to foot cut | (101.5 + 20.882) / 0.93969 = 130.236 |
| Back leg overall length | 130.236 + 3.5·0.36397 = 131.510 (131-1/2") |
| Front (downhill) leg meets ground | z_g = −3.313 |
| Front foot cut height z_b | −27.313 |
| Front leg edge, top cut to foot cut | 137.080 |
| Front leg overall length | 138.354 (138-3/8") |
| Leg length below grade | 24 / 0.93969 = 25.540 |
| Footprint at grade | 39.226 + 41.680 = 80.906 |
| Past each leg, crossbar and gusset (p_c = p_g, 1/2" bolts) | 7·0.5 − 3.5 / (2·0.93969) = 3.5 − 1.862 = 1.638 |
| Crossbar top edge, bottom edge | 51.714 + 2·1.638 = 54.989, 55.718 + 2·1.638 = 58.993 (59") |
| Gusset top, bottom, height | 14.225, 19.502 (19-1/2"), 7.25 (one per frame) |
| Cut settings | Leg top, leg foot, crossbar ends, and gusset sides 20.0°; flush cut a taper at 20.0° to the face |

With d = 0 (pads), the same inputs give back legs of 105.970 (106") and front legs of 112.814 (112-13/16"). Tests cover both.

Part letters (template version 5, #66) follow the cut list's order: A beam (or beam ply), B back legs, C front legs, D crossbars, E gussets. Each pair shares one letter, as it shares one cut-list row. The cut list and every drawing take the letter from the part.

### Placements

Origins (x, y, z) for the worked example, with tan α = 0.36397:

| Part | Instance 0 (left frame) | Instance 1 (right frame) |
|---|---|---|
| Beam | (0, 1.75, 96) | |
| Back leg | (12, 1.75 − 5.5·0.36397 = −0.252, 101.5) | (120 − 12 − 3.5 = 104.5, −0.252, 101.5) |
| Front leg | (15.5, 0.252, 101.5) | (108, 0.252, 101.5) |
| Crossbar | (12 − 1.5 = 10.5, −58.993 / 2 = −29.496, 40 − 5.5 = 34.5) | (108, −29.496, 34.5) |
| Gusset | (10.5, −19.502 / 2 = −9.751, 96 − 7.25 = 88.75) | (108, −9.751, 88.75) |

The back legs run along (0, 0.34202, −0.93969). Fit tests place the parts this way for this example, its version on pads, the edge of range, and a three-ply beam on level ground, and check:
- each leg's top cut is level with the top of the beam;
- each leg's inner face passes the beam's lower corner;
- each leg's outer face meets the ground at the footprint;
- each leg's foot cut is at z_b on both edges;
- the crossbar and gusset corners lie on the legs' outer faces;
- the gusset's top is at the beam's underside;
- the beam plies fill the beam's width.

### Holes and joints

| Quantity | Value |
|---|---|
| Flush cut marks | inner edge 5.5 / 0.93969 = 5.853 (5-7/8") down from the top corner; top cut 5.5·0.36397 = 2.002 (2") from that corner, 5.5·0.34202 = 1.881 (1-7/8") in from the edge |
| Flush cut as written before version 4 | starting 5.168 down the edge ends 1.661 in from it, 0.22" short: the leg would hit the beam |
| Leg bolt hole | enters the outer edge (2.75 + 3.5·0.34202) / 0.93969 = 4.200 down, at mid-thickness 1.75; 3.7246 − 1.0009 = 2.724 long |
| Beam holes | u = 13.75 and 106.25, v = 2.75 |
| Hole size (version 9) | every hole 0.5 + 1/16 = 0.5625 (9/16") for the 1/2" bolts, within NDS 12.1.3.2's 1/32" to 1/16" over |
| Crossbar bolt holes (Bolt layout) | v = 1.375 and 4.125; u = v·0.36397 + 3.5 = 4.000 and 5.001 from the front end, 58.993 − v·0.36397 − 3.5 = 54.993 and 53.992 from the back |
| Leg holes for the crossbar bolts | v = 1.75; u = (101.5 + 1.75·0.34202 − z) / 0.93969 at z = 35.875 and 38.625: 70.474 and 67.547 |
| Leg holes for the gusset bolts | at z = 90.5625 and 94.1875: 12.276 and 8.419 |

### Swings and layout

With swings centered at x = 40 and 80, hangers 20 apart, seats 20 wide, and seat height 16:

| Quantity | Value |
|---|---|
| Hangers | 30, 50, 70, 90 |
| Frame inside faces | 12 + 3.5 = 15.5 and 120 − 15.5 = 104.5 |
| Seat to frame, left and right | 30 − 15.5 = 14.5; 104.5 − 90 = 14.5 |
| Seat to seat | 70 − 50 = 20 |
| Chain length to set | 96 − 16 = 80 |
| Footprint at grade | x 0 to 120, y −41.680 to 39.226 |
| Clear area | x −72 to 192, y −113.680 to 111.226 |
| Swing zones | x 30 to 50 and 70 to 90, y −192 to 192 |

### Hardware

With every bolt 1/2", 2 bolts per crossbar and gusset joint, each hanger on one bolt down through the beam, buried legs:

| Item | Quantity | Grip |
|---|---|---|
| Leg-to-beam bolts | 2 | 8.947 |
| Crossbar bolts | 4 joints × 2 = 8 | 1.5 + 3.5 = 5 |
| Gusset bolts | 4 joints × 2 = 8 | 1.5 + 3.5 = 5 |
| Swing hanger bolts | 4 | 5.5, plus the hanger |
| 1/2" flat washers | 2 × 22 = 44 | |
| 1/2" locking nuts and caps | 22 each | |
| Swing hangers, seats | 4, 2 | |

On pads with 1 anchor per foot, add 4 ground anchors. With the two-ply 2x6 beam and 6 ply bolts, add 6 bolts with a 3" grip, 12 washers, 6 nuts, and 6 caps. The third fixture example hangs each hanger from a bracket with two 3/8" bolts sideways through the beam, 1-1/2" up: 8 bolts with a 3" grip plus the bracket, and their 3/8" washers, nuts, and caps.

### Edge of range

Every range at or near its limit: L = 240, H = 144 (maximum), α = 35° (maximum), a two-ply 2x6 beam (bw = 3.0, bd = 5.5), 4x4 legs, ground falling 3" per foot toward the back (g = −3, the steepest allowed, front uphill), burial depth 48 (maximum), crossbar 2x6 at zc = 100, gusset from a 2x8, swings at 80 and 160.

| Quantity | Value |
|---|---|
| Flush cut depth at the top | 5.5·0.57358 = 3.155 |
| Wood left at the top | 3.5 − 3.155 = 0.345 (expert-check flag: under 1") |
| Bolt grip | 7.694 |
| Back (now downhill) leg: meets ground, foot cut | z_g = −31.658, z_b = −79.658 |
| Back leg overall length | 282.202 |
| Front (now uphill) leg: meets ground, foot cut | z_g = 22.226, z_b = −25.774 |
| Front leg overall length | 216.421 |
| Footprint at grade | 129.223 + 90.722 = 219.945 |
| Past each leg | 3.5 − 3.5 / (2·cos 35°) = 1.364 |
| Crossbar top edge, bottom edge | 75.891, 83.593 |
| Gusset top, bottom | 14.273, 24.426 |

The back legs are longer than a 16 ft board; the shopping list reports that as an issue instead of dropping them.

### Built-up beam check

The same inputs with the beam as two 2x6 plies (bw = 3.0, bd = 5.5). The flush cut depends only on bd, so it is unchanged. Everything that depends on the beam's width changes, including the leg lengths on a slope, because the legs sit closer to the centerline:

| Quantity | Value |
|---|---|
| Bolt grip | 3.0 + 2·(3.7246 − 1.0009) = 8.447 |
| Q | (1.5 + 1.8623, 96) = (3.3623, 96) |
| Back leg meets ground | s = (96 − 0.2802) / 0.96819 = 98.865; z_g = 96 − 98.865·0.93969 = 3.098 |
| Back leg overall length | 131.531 |
| Front leg overall length | 138.331 |
| Footprint at grade | 38.983 + 41.422 = 80.405 |
| Crossbar top edge, bottom edge | 54.489, 58.493 |
| Gusset top, bottom | 13.725, 19.002 |

Tests compare template output with these values to within 0.001 inch and 0.01°.

## Structural model

Added in M2. The structural review is computed from the template output and the owner's structural inputs by `structuralReview` in `structural.ts`. It is separate from `generate`, so adding it did not change the template output or its version. The generic checks it feeds are described in `DOMAIN.md`, Structural checks.

### Inputs

None has a default (decision 0001). A missing input makes every check that needs it report "input needed".

| Input | Used by |
|---|---|
| Beam species and grade (Southern Pine No.1 or No.2, NDS Supplement 2024 Table 4B) | Bending, shear, deflection, legs (the beam's weight) |
| Whether the beam lumber is incised | Bending, shear, deflection |
| Beam moisture content in service, percent (for the beam's weight) | Bending, shear, deflection, legs |
| Heaviest rider on each swing, including seat and chain (0 for an empty swing) | All |
| Maximum swing angle θ from vertical | All |
| Dynamic factor | Bending, shear, hanger, legs |
| Deflection limit, span divided by N | Deflection |
| Swing hanger rated working load, from the manufacturer | Hanger |
| Swing hanger mounting, from its package (a hardware parameter, Hardware above) | Bending, shear |
| Leg species and grade (Southern Pine No.1 or No.2, NDS Supplement 2024 Table 4B) | Legs |
| Whether the leg lumber is incised | Legs |

On pads, the anchor check also needs two hardware parameters (Hardware, above): the ground anchors per leg foot and one anchor's rated pull-out. Like the inputs, neither has a default.

### Loads and load cases

- **Swing load:** chain tension at the bottom of the arc T = W·(3 − 2·cos θ). For a pendulum of length r released from rest at θ, the speed at the bottom gives v² = 2·g·r·(1 − cos θ), and T = W + W·v²/(g·r) = W·(3 − 2·cos θ). It is 1·W at rest, 2·W at 60°, and 3·W at 90°.
- **Per hanger:** T / 2, assuming a centered rider. Both swings are taken at the bottom of their arcs together.
- **Strength** (bending, shear, hanger, legs): per-hanger load times the dynamic factor.
- **Break-even dynamic factor** (#401): each strength check also reports the dynamic factor at which its margin reaches 1.0, with every other input as entered (`DOMAIN.md`, Structural checks). For the hanger it is the rating over the smooth-swing load on the most loaded hanger. For bending and shear it is solved from the check, since the beam's weight is not multiplied: C = (allowable − the weight's part) / the hangers' part at factor 1. It is shown with the check and under the dynamic factor's field in Edit, and it is reported while the factor is still missing; the checks stay "input needed" until the factor is entered.
- **Deflection:** per-hanger load without the dynamic factor.
- **Beam:** supported where it bears, with a point load at each hanger, `swings.hangersX`. The gusset is fitted with its top edge against the beam's underside, and the leg-to-beam bolt sits in a hole 1/16" over its size (Hole size, version 9), so the gusset is what the beam meets first. The bolt carries part of the reaction only if the gusset settles (its own bolts are in oversize holes too) or the wood crushes; that moves the support inward and shortens the span, so the gusset position is the longer of the two. Each support is at the middle of the part of the gusset's top edge under the beam, b_g = min(gt, e) long: x = e − b_g/2 and L − e + b_g/2 (`beamSupports` in `structural.ts`, version 23, #445). NDS 2024 3.2.1 (p. 17) takes a simple beam's span "from face to face of supports, plus ½ the required bearing length at each end". The faces are the gussets' inner faces, L − 2e apart, and the required bearing length can be no more than the bearing there is, b_g, so the span to the middle of each gusset, L − 2e + b_g, is the longest the clause allows. Kerf uses it rather than computing the required bearing length, which needs a bearing check it does not make; the longer span gives the larger moment and deflection. With e = 0 no gusset is under the beam, and it is supported at the bolts, `geometry.supportsX`. Before version 23 the supports were the frame centerlines, which put the span 2.5 short at each end in the worked example. The unbraced length for beam stability is the span, since each frame holds the beam against rotation (a checklist item). The beam's own weight is a uniform load over the span, not multiplied by the dynamic factor; the overhangs' weight is left out, which slightly raises the moment between the supports.
- **Net section at the hangers** (version 29, #446): NDS 2024 3.1.2.1 (p. 16), read November 3, 2026: "The net section area is obtained by deducting from the gross section area the projected area of all material removed by boring, grooving, dapping, notching, or other means. The net section area shall be used in calculating the load carrying capacity of a member". The hangers are the point loads, so each hanger's hole is at a section where the moment is at a peak. Bending is f_b = M/S (Eq. 3.3-1) at the largest moment on the gross section and at each hanger on its net section, and the margin is from the largest of these. With the bolt centered under the hanger the load is not eccentric at that section, which the clause also asks about. NDS chapter 4 (sawn lumber) adds nothing on bored holes. `netSection` in `structural/netSection.ts`:
  - **Down through the depth:** the hole takes D_h from the breadth: S_net = (b − D_h)·d²/6. In a built-up beam the hole is centered on the whole beam, and each ply loses the part of the hole within it; the check takes the ply that loses most (both plies of two lose D_h/2 at the seam, the middle ply of three loses D_h), which still carries an equal share of the load (decision 0013).
  - **Across the breadth:** the hole removes a band D_h tall across every ply, its center h above the bottom. The neutral axis moves to the centroid of what is left: ȳ = (b·d·d/2 − b·D_h·h) / (b·(d − D_h)), I_net = b·d³/12 + b·d·(d/2 − ȳ)² − (b·D_h³/12 + b·D_h·(h − ȳ)²), and S_net = I_net / max(ȳ, d − ȳ). Bending is taken at the hanger's position with one hole in the section; a bracket with bolts one above another is not covered, and is entered as another mounting.
  - **Another mounting:** bending and shear are not computed, with the reason, since Kerf cannot say what the screws or clamp remove. Deflection is computed as before.
  - Deflection uses the gross section.
- **Shear at the hangers** (version 36, #526): shear is f_v = 3·V/(2·b·d) at the supports on the gross section, as before, and also beside each hanger. There V is the larger of the shears just either side of the hanger, R1 − w·x less the hanger loads to its left, and less its own load on its right side. Just inside an outer hanger that is the support reaction less the weight of the beam between them. NDS 2024 3.4.2 (p. 19) gives Vr' = 2/3·Fv'·b·d for a rectangle, and the check takes f_v = 3·V/(2·A_v), with A_v the area that resists shear there, so the margin Fv'/f_v is Vr'/V. `shearSection` in `structural/netSection.ts`:
  - **Down through the depth:** the net section, A_v = (b − D_h)·d, by 3.1.2.1 as for bending, and each ply of a built-up beam loses what bending takes from it. The bolt's washer bears on the beam's top, so the load is applied to the top face, not through a bolt loaded sideways, and 3.4.4 does not apply.
  - **Across the breadth:** the seat hangs from the bolts, which load the beam sideways across its grain. NDS 2024 3.4.4.1 (p. 21), read November 3, 2026, covers bending members fastened with bolts, including members carrying a load hung from them (Figure 3E): Vr' = 2/3·Fv'·b·d_e where the connection is at least 5d from the member's end (Eq. 3.4-9), and Vr' = 2/3·Fv'·b·d_e·(d_e/d)² where it is closer (Eq. 3.4-8). d_e is "depth of member, less the distance from the unloaded edge of the member to the center of the nearest bolt"; with the load hanging, the unloaded edge is the top, so d_e = h, the bolts' height above the bottom. So A_v = b·d_e or b·d_e·(d_e/d)², with the hanger's distance from the beam's nearer end, min(x, L − x), against 5d. Bolts low in the beam leave little depth: this is where wood splits along the grain below a hung load. 3.4.3 (notches and taper cuts) does not apply, since no wood is cut from a face. The hole itself is not deducted from b·d_e, as Eq. 3.4-8 and 3.4-9 do not.
  - With bolts one above another, the lowest sets d_e. Kerf takes one row (Net section at the hangers, above), so a bracket with more is entered as another mounting.
  - C_L stays the gross member's, since beam stability is a property of the whole member between its braces.
- **Deeper stock** (version 32, #466; owner's decision on #466, 3 November 2026): bending also reports its margin and break-even dynamic factor with the beam in the next deeper stock, every other input as entered, so the owner can choose the stock against the factor. Kerf lists; it does not choose (Starting questions above). The next deeper stock is every beam the template can build, a solid beam of any size or two or three plies of a 2x size, whose depth is the smallest Kerf has above the beam's and whose breadth is no less than its breadth, narrowest first (`deeperBeams` in `deeperStock.ts`). For a 4x6 (5.5 deep, 3.5 wide) that is a 4x8 and three plies of 2x8; two plies of 2x8 (3.0 wide) and one 2x8 are narrower. Nothing Kerf has is deeper than 7-1/4, so a 4x8 or a beam of 2x8 plies has none, and the review says so. Each size is generated in full, so a size whose flush cut would go through the legs is left out, and so is a size with no design values (a 6x6, a timber size, Table 4D) or no break-even factor. A built-up size is generated without ply bolts when the plan has none, since bending does not read them. The list is given while bending has a break-even factor, including while only the factor is missing; then each size has its factor and no margin. The shopping list's other beam sizes when the store has none (Not in stock, above) are separate and unchanged.
- **Uplift at the feet** (pads only, version 33, #467): on the way down from θ, at angle φ from vertical, the chain carries T = W·(3·cos φ − 2·cos θ): v² = 2·g·r·(cos φ − cos θ) from the energy, and T = W·cos φ + W·v²/(g·r) from the centripetal force (the same sources as the swing load, at φ instead of the bottom). Its fore-and-aft part F = T·sin φ pushes the beam toward the front or the back, in the plane of each A-frame, and its vertical part V = T·cos φ pushes down. Both act at the hangers, (y, z) = (0, H).
  - **Each frame's share:** the share of each hanger's load the beam's span gives that frame, with the supports of the beam checks: W_f = Σ (W_i / 2)·(x_far − x_i) / (x1 − x0), and half the beam's whole weight, D = w·L / 2, at y = 0.
  - **Feet:** where each leg's centerline meets the ground (Where the leg meets the ground; on pads the foot is at grade): the back foot at y_b = Q_y + (H − z_b)·tan α, z_b its ground height, and the front foot at y_f = −(Q_y + (H − z_f)·tan α).
  - **Moments:** pushed toward the back, the frame pivots on its back foot and the front foot lifts. The lifting foot bears nothing, so it has no friction, and the whole fore-and-aft reaction is at the pivot. Moments about the pivot (OpenStax University Physics Vol. 1, 12.1 and 12.2) give the front foot's reaction R_f = [(V + D)·y_b − F·(H − z_b)] / (y_b − y_f). Pushed toward the front, R_b = [(V + D)·(−y_f) − F·(H − z_f)] / (y_b − y_f). Writing each as R = (V + D)·c_v − F·c_h, the uplift at a foot with the dynamic factor C is U = C·S − D·c_v, where S = −W_f · min over 0 ≤ φ ≤ θ of (3·cos φ − 2·cos θ)·(c_v·cos φ − c_h·sin φ).
  - **Where the minimum is:** found numerically, by golden-section search on [0, θ]. It is not where the fore-and-aft force peaks (φ = 45° for θ = 90°), since the vertical part, which holds the foot down, falls faster there. On level ground with θ = 90° it is closed form: c_v = 1/2, c_h = h/2 with h = H / b and b = y_b, and the minimum is 0.75·(1 − √(1 + h²)) at φ = 90° − ½·atan h.
  - **Check:** a hardware load against its rating (`DOMAIN.md`, Structural checks). The load on one anchor is (C·S − D·c_v) / n with n anchors per foot, at the foot where it is largest, against one anchor's rated pull-out. The dynamic factor multiplies the swing part only, as it leaves the beam's weight alone in bending, so the break-even factor is (n·R_rated + D·c_v) / S. When the load is zero or less no foot lifts and no margin is reported. The working also gives, without the dynamic factor, each foot's uplift and the largest fore-and-aft force on each frame over the swing, W_f · max sin φ·(3·cos φ − 2·cos θ), which is at cos φ = (cos θ + √(cos² θ + 18)) / 6.
  - **Weight:** the beam's weight comes from the entered species, grade, and moisture content, as in the beam checks. The legs', crossbars', and gussets' weight would also hold the feet down, but no species is entered for them, so it is left out, which makes the uplift larger.
  - **Assumptions stated on the result:** both swings at the same φ at the same time (riders in sync, as the other checks take them at the bottom together); a centered rider; the frame's own inertia left out; the anchor holds its rating in this soil, fastened to the leg as its maker specifies. Sliding (the frame walking) is not computed and stays on the checklist, as do buried legs, which have no anchor to rate.
- **Service conditions:** wet service (outdoors, uncovered), C_t = 1.0 (no sustained heat above 100°F), C_D = 1.0 (the impact increase is not used, and the NDS bars factors above 1.6 for lumber treated with water-borne preservatives, 4.3.13 and Table 2.3.2, footnote 2), no repetitive member factor (one beam).
- **Beam weight:** w = ρ·A / 1728 lb/in, with A the cross-section of all plies and ρ the density at the entered moisture content M from Simpson, FPL-GTR-76: G_b = G / (1 + 0.265·G) with G = 0.55 from Table 4B, then ρ = 62.4·G_b·(1 + M/100) at or above 30%, divided by (1 − 0.265·a·G_b) with a = (30 − M)/30 below 30%. The NDS Supplement 3.1.3 formula agrees within 0.3% up to 30%; above 30% it reads low, because it keeps shrinking the volume of wood that no longer swells.
- **Built-up beam:** each ply carries an equal share of every load, including the beam's weight (decision 0013).

### Legs

Version 34 (#468) checks the leg that is longer above grade as a solid column (`DOMAIN.md`, Column compression). Both legs of a frame carry the same load, so the longer one, the downhill one, has the lower margin; on level ground the two are the same and the check names "Legs". NDS 2024 sections read for it: 3.6.3 (compression parallel to grain, net and gross section), 3.7.1.1 to 3.7.1.5 (effective length, slenderness, the limit of 50, Eq. 3.7-1), all p. 23; Appendix G, G.1 to G.4 and Table G1 (p. 183); Table 4.3.1 (p. 31), Table 4.3.8 (p. 32), and Table 2.3.3 (p. 13) for which factors apply to Fc; and Supplement Table 4B's wet service and size factors (p. 39): C_M = 0.8 for Fc unless Fc ≤ 750 psi, and C_F = 1.0 for every Southern Pine size Kerf offers.

- **Load per leg:** P = (C · R_s + R_w) / (2 · cos α). R_s is the beam's larger support reaction under the swing loads alone, which the dynamic factor C multiplies. R_w = w · L_beam / 2 is half the beam's whole weight, overhangs included, which it does not. Each frame's load is shared equally by its two legs, along their axes. The legs', crossbars', and gussets' own weight is left out, and so is the swing's push toward the front and back, which loads one leg of a frame more than the other.
- **In the A-frame's plane** (d = w, the leg's width toward the beam): the crossbar and gusset tie the splayed legs into triangles, so each holds the leg from moving sideways at the middle of its height, zc − cw/2 for the crossbar and H − gh/2 for the gusset. The leg is taken as free to turn there: Table G1 case d, Ke = 1.0. ℓ is the longer of (zc − cw/2 − z_g) / cos α, from the leg's centerline at the ground to the crossbar, and (H − gh/2 − zc + cw/2) / cos α, from the crossbar to the gusset.
- **Along the beam** (d = t), buried legs (d > 0): the leg is taken as fixed at grade. At the top the frame can lean along the beam and turn about the single leg-to-beam bolt, so the top is free to move and to turn: Table G1 case e, a flagpole, Ke = 2.10. ℓ = (H − z_g) / cos α, from grade to the underside of the beam, where the gusset carries the beam into the legs. Soil near the surface gives, so the real point of fixity is below grade and the real effective length longer; the result says so.
- **Along the beam on pads** (d = 0): each foot can turn on its pad and the frame can turn about the bolt, so no Table G1 case applies and the check is not computed. The reason it gives says that the ground anchors and how tightly the bolts clamp are what hold the frame along the beam, for an experienced builder to judge.
- **Net area:** the crossbar and gusset bolts cross each leg along the beam, so the leg's net area is (w − D_h) · t, with D_h the larger of their holes (1/16" over the bolt). f_c = P / A_n is compared with Fc', which includes C_P. That is more cautious than NDS 3.6.3 asks, which uses the net area only where a hole is in the part most likely to buckle, and then compares it with Fc*.
- **Conditions:** as the beam's (wet service, C_t = 1.0, C_D = 1.0, water-borne treatment).

### Checklist

Leg-to-beam bolt and gusset; beam plies (built-up beams only); beam held against rotation at each frame; racking of the A-frames and crossbars, with what holds the frames along the beam (on pads, nothing in the frames themselves: the bolts' clamping, the anchors, or corner braces; buried, the legs' bending at grade, with how far the frames lean depending on the bolts' clamping); burial, or on pads the ground anchors' type, soil, fastening to the legs, and sliding; swing hanger installation; lumber quality in the beam and legs; an inspection routine (CPSC Pub. 324, p. 5).

### Worked examples (hand-checked)

Geometry from the worked example above: the gusset (a 2x8, gt = 1.5) is under the beam from 10.5 to 12, so the supports are at 12 − 0.75 = 11.25 and 120 − 11.25 = 108.75 (span L = 97.5), and the hangers at 30, 50, 70, 90 are 18.75, 38.75, 58.75, and 78.75 from the left support. Version 22 and earlier used 13.75 and 106.25 (span 92.5); their numbers are in the version 22 spec. Southern Pine No.2, not incised, beam moisture content 30%, θ = 60° (3 − 2·cos θ = 2), dynamic factor 2, deflection limit L/240, hanger rating 1200 lb.

Design values (Table 4B, 5"–6" wide): Fb = 1000, Fv = 175, E = 1,400,000, Emin = 510,000 psi, G = 0.55. Wet service: C_M = 1.0 for Fb (Fb·C_F = 1000 ≤ 1150 psi), 0.97 for Fv, 0.9 for E and Emin. So Fv' = 169.75 psi, E' = 1,260,000 psi, Emin' = 459,000 psi.

Beam weight at 30%: G_b = 0.55 / 1.14575 = 0.480035, ρ = 62.4 · 0.480035 · 1.30 = 38.940 lb/ft³. A 4x6 (19.25 in²) weighs w = 38.940 · 19.25 / 1728 = 0.433798 lb/in (5.21 lb/ft); two 2x6 plies (16.5 in²) weigh 0.371827 lb/in, 0.185914 per ply.

Beam stability: ℓu/d = 97.5/5.5 = 17.7 > 14.3, so ℓe = 1.84·97.5 = 179.4.

| | 4x6, b = 3.5 | One ply of 2x6, b = 1.5 |
|---|---|---|
| R_B = √(ℓe·d / b²) | 8.9748 | 20.9412 |
| F_bE = 1.20·Emin' / R_B² | 6838.2 | 1256.0 |
| C_L | 0.99159 | 0.89116 |
| Fb' | 991.59 | 891.16 |
| S = b·d²/6, I = b·d³/12 | 17.6458, 48.5260 | 7.5625, 20.7969 |

**Example 1, symmetric, 4x6:** 150 lb riders on both swings. T = 300 per swing; 150 per hanger for deflection, 300 for strength.

| Quantity | Value |
|---|---|
| Reactions, 600 + w·L/2 | 621.15, 621.15 |
| M at midspan: hangers 600·48.75 − 300·30 − 300·10 = 17,250, plus w·L²/8 = 515.47 | 17,765.47 lb·in |
| f_b = M/S on the gross section | 1006.78 psi |
| Net section at each hanger: one 1/2" bolt down through the beam, hole 9/16", b_net = 3.5 − 0.5625 = 2.9375 | S_net = 2.9375·5.5²/6 = 14.8099 in³ |
| M at the inner hangers (38.75 from the left support): 600·38.75 − 300·20 = 17,250, plus w·(48.75·38.75 − 38.75²/2) = 493.78 | 17,743.78 lb·in; at the outer hangers 11,570.27 |
| f_b at the inner hangers, 17,743.78 / 14.8099 | 1198.10 psi; margin 991.59 / 1198.10 = 0.83 (the outer hangers 781.25 psi, margin 1.27) |
| f_v at the supports, 3·621.15 / (2·3.5·5.5), gross section | 48.40 psi (margin 3.51 before version 36) |
| Shear just inside the outer hangers (18.75 from the support): V = 621.15 − w·18.75 = 621.15 − 8.13 | 613.01 lb; at the inner hangers 304.34 |
| Net section for shear at each hanger, A_v = 2.9375·5.5 | 16.15625 in² |
| f_v beside the outer hangers, 3·613.01 / (2·16.15625) | 56.91 psi; margin 169.75 / 56.91 = 2.98 |
| δ·EI at midspan: two symmetric pairs (DA6 Fig. 9), [150·18.75·(3·97.5² − 4·18.75²) + 150·38.75·(3·97.5² − 4·38.75²)] / 24 = 8,629,492, plus 5·w·L⁴/384 = 510,440 (DA6 Fig. 1) | 9,139,933 / 61,142,813 = 0.1495 in |
| Limit 97.5/240 | 0.4063 in; margin 2.72 |
| Hanger | 300 lb against 1200; margin 4.0 |
| Break-even dynamic factor, bending | At the inner hangers, Fb'·S_net = 991.59 · 14.8099 = 14,685.37 lb·in; the hangers give 8,625 per unit factor and the weight 493.78, so C = (14,685.37 − 493.78) / 8,625 = 1.645 (not margin × factor, 0.828 · 2 = 1.655, since the weight is not multiplied). On the gross section at midspan it would be (17,497.46 − 515.47) / 8,625 = 1.969. |
| Break-even dynamic factor, shear | Beside the outer hangers, Fv'·2·A_v/3 = 169.75·2·16.15625/3 = 1,828.35 lb; the hangers give 300 per unit factor and the weight 21.15 − 8.13 = 13.02, so C = (1,828.35 − 13.02) / 300 = 6.051. At the supports on the gross section it would be (2,178.46 − 21.15) / 300 = 7.191. |
| Break-even dynamic factor, hanger | 1200 / 150 = 8.0 |
| Next deeper stock, 4x8 | Fb = 925 (Table 4B, 8" wide; C_M = 1.0 since 925 ≤ 1150). ℓu/d = 97.5/7.25 = 13.45, so ℓe = 1.63·97.5 + 3·7.25 = 180.675; R_B = √(180.675·7.25/3.5²) = 10.3407, F_bE = 1.20·459,000/R_B² = 5151.0, C_L = 0.98931, Fb' = 915.12. S_net = 2.9375·7.25²/6 = 25.7337; w = 38.940·25.375/1728 = 0.571825 lb/in, 650.90 lb·in at the inner hangers. C = (915.12·25.7337 − 650.90) / 8,625 = 2.655; margin 23,549.6 / (17,250 + 650.90) = 1.32 |
| Next deeper stock, three plies of 2x8 | Per ply b = 1.5: R_B = √(180.675·7.25/1.5²) = 24.1283, F_bE = 946.1, C_L = 0.82629, Fb' = 764.32. The hole is centered on the middle ply, which keeps 1.5 − 0.5625 = 0.9375: S_net = 0.9375·7.25²/6 = 8.2129. Per ply the hangers give 2,875 per unit factor and the weight (0.245068 lb/in) 278.96. C = (764.32·8.2129 − 278.96) / 2,875 = 2.086; margin 6,277.3 / (5,750 + 278.96) = 1.04 |

**Example 2, asymmetric, 4x6:** 200 lb on the left swing, 80 lb on the right. Strength loads per hanger 400, 400, 160, 160.

| Quantity | Value |
|---|---|
| R1 = (400·(78.75 + 58.75) + 160·(38.75 + 18.75)) / 97.5 + w·L/2 | 658.46 + 21.15 = 679.61; R2 = 1120 + 42.30 − 679.61 = 482.69 |
| M under the second hanger, 679.61·38.75 − 400·20 − w·38.75²/2 | 18,009.17 lb·in (the shear changes sign there) |
| f_b on the gross section | 1020.59 psi |
| f_b at the second hanger, on the net section, 18,009.17 / 14.8099 | 1216.02 psi; margin 0.82 (0.8154) |
| f_v at the supports, 3·679.61 / 38.5, gross section | 52.96 psi |
| f_v just inside the left outer hanger, V = 679.61 − w·18.75 = 671.48, 3·671.48 / (2·16.15625) | 62.34 psi; margin 2.72 |
| δ (deflection loads 200, 200, 80, 80, plus w) | 0.1403 in, at x = 58.29; margin 2.90 |
| Hanger | 400 lb against 1200; margin 3.0 |

**Example 3, two-ply 2x6, example 1's loads:** each ply carries half of every load and half the beam's weight.

| Quantity | Value |
|---|---|
| M per ply, 8,625 + 0.185914·97.5²/8 | 8,845.92 lb·in |
| f_b = 8845.92 / 7.5625 on the gross section | 1169.71 psi |
| Net section: the 9/16" hole centered on the seam, so each ply loses 0.28125 | S_net = 1.21875·5.5²/6 = 6.1445 in³ |
| M per ply at the inner hangers, 8,625 + 0.185914·(48.75·38.75 − 38.75²/2) | 8,836.62 lb·in |
| f_b at the inner hangers, 8,836.62 / 6.1445 | 1438.13 psi; margin 891.16 / 1438.13 = 0.62 |
| f_v at the supports, 3·309.06 / (2·1.5·5.5), gross section | 56.19 psi (margin 3.02 before version 36) |
| f_v just inside the outer hangers, V = 309.063 − 0.185914·18.75 = 305.58 per ply, on A_v = 1.21875·5.5 = 6.703125 | 68.38 psi; margin 2.48 |
| δ | 0.1730 in; margin 2.35 |
| Break-even dynamic factor, bending | At the inner hangers, Fb'·S_net = 891.16 · 6.1445 = 5,475.78 per ply; the weight gives 211.62, so C = (5,475.78 − 211.62) / 4,312.5 = 1.221 |

**Example 4, two-ply 2x6, bolts sideways:** example 3 with each hanger on a bracket with 3/8" bolts across the beam, holes 7/16", their centers 1.5 above the beam's bottom. Per ply, b = 1.5, d = 5.5, D_h = 0.4375, h = 1.5.

| Quantity | Value |
|---|---|
| Net area, 1.5·(5.5 − 0.4375) | 7.59375 in² |
| ȳ = (1.5·5.5·2.75 − 1.5·0.4375·1.5) / 7.59375 | 2.858025 in |
| I_net = 20.796875 + 8.25·0.108025² − (0.010468 + 0.65625·1.358025²) | 19.672403 in⁴ |
| c = max(2.858025, 2.641975), S_net = 19.672403 / 2.858025 | 6.883217 in³ |
| f_b at the inner hangers, 8,836.62 / 6.883217 | 1283.79 psi; margin 891.16 / 1283.79 = 0.69 |
| Shear at each hanger: the seat hangs from the bolts, so d_e = 1.5 (NDS 2024 3.4.4.1). The outer hangers are 30 from the beam's ends, at least 5d = 27.5, so Eq. 3.4-9: A_v = 1.5·1.5 | 2.25 in² per ply |
| f_v just inside the outer hangers, 3·305.58 / (2·2.25) | 203.72 psi; margin 169.75 / 203.72 = 0.83 (3.02 at the supports on the gross section) |
| Break-even dynamic factor, shear | Fv'·2·A_v/3 = 254.63 lb per ply; per ply the hangers give 150 per unit factor and the weight 9.06 − 3.49 = 5.58, so C = (254.63 − 5.58) / 150 = 1.660 |
| Swings centered at 35 and 85 instead, hangers at 25, 45, 75, 95 | The outer hangers are 25 from the ends, within 5d, so Eq. 3.4-8: A_v = 2.25·(1.5/5.5)² = 0.167355; V = 309.063 − 0.185914·13.75 = 306.51, f_v = 2,747.25 psi, margin 0.06 |

A horizontal hole at mid-depth costs far less: in the 4x6, a 9/16" hole there gives S_net = 3.5·(5.5³ − 0.5625³)/12 / 2.75 = 17.627 against 17.646, 0.1%.

The two-ply 2x6 has less margin in bending than the 4x6 under the same inputs, for two reasons: two 2x6 plies (3.0 in) are narrower than a 4x6 (3.5 in), and one ply is far more slender for beam stability. The beam's weight lowers each bending margin by about 3%. Maximum moments and deflections were also found by sampling the summed DA6 curves at 200,000 points; the code finds them exactly, and both agree to the precision shown. Version 23's numbers were recomputed by a separate script that first reproduced every version 22 number above from the old supports. Version 29's net sections, moments at the hangers, and break-even factors were checked by a separate script that searched the moment curve at 1,000,000 points and solved each break-even factor by bisection. Version 36's shear beside the hangers was checked by a separate script from NDS 2024 Eq. 3.4-2, 3.4-8, and 3.4-9, taking the shear on both sides of every hanger and solving each break-even factor by bisection. Version 32's deeper stock was checked by a separate script from the NDS formulas above, not from Kerf's code; the gross section at midspan gives larger factors (3.17 for the 4x8, 3.39 for the plies), so the hangers govern.

The supports at the frame centerlines give a shorter span and so a larger margin in bending and deflection, but in example 2 a slightly smaller one in shear (3.19 against 3.21), since the left reaction is then larger (683.85 against 679.61). The difference is under 1%, and the bolt carries load only after the gusset bears, so Kerf reports the gusset position alone.

**Example 4, uplift on pads:** the worked example on pads (d = 0, ground falling g = 1"/ft toward the front), example 2's riders (200 and 80 lb), θ = 60°, dynamic factor 2, the 4x6 beam's weight above, 1 anchor per foot rated 500 lb.

| Quantity | Value |
|---|---|
| Q_y = 1.75 + 3.5 / (2·0.93969) | 3.61232 |
| Back foot | z_b = 3.1182, y_b = 3.61232 + 92.8818·0.36397 = 37.4185 |
| Front foot | z_f = −3.3133, y_f = −(3.61232 + 99.3133·0.36397) = −39.7594 |
| y_b − y_f | 77.1779 |
| W_f, left frame | (100·(78.75 + 58.75) + 40·(38.75 + 18.75)) / 97.5 = 164.615; right frame 280 − 164.615 = 115.385 |
| D = w·L / 2 | 0.433798·60 = 26.0279 |
| Back foot lifting (pivot on the front foot) | c_v = 39.7594 / 77.1779 = 0.51517, c_h = 99.3133 / 77.1779 = 1.28681 |
| Minimum, at φ = 47.14° (cos 0.68039, sin 0.73285) | (3·0.68039 − 1)·(0.51517·0.68039 − 1.28681·0.73285) = 1.04117·(−0.59252) = −0.61692 |
| S, D·c_v, left frame | 164.615·0.61692 = 101.555; 26.0279·0.51517 = 13.409 |
| Uplift, left back foot, at C = 2 | 2·101.555 − 13.409 = 189.70 lb; at C = 1, 88.15 |
| Front foot lifting | c_v = 0.48483, c_h = 1.20348, minimum −0.57483 at φ = 47.20°: left front foot 2·94.625 − 12.619 = 176.63 |
| Right frame | back foot 2·71.183 − 13.409 = 128.96; front foot 2·66.326 − 12.619 = 120.03 |
| Anchor | 189.70 / 1 = 189.70 lb against 500; margin 2.64 |
| Break-even dynamic factor | (1·500 + 13.409) / 101.555 = 5.056 |
| Largest fore-and-aft force, left frame | cos φ = (0.5 + √18.25) / 6 = 0.79535 (φ = 37.31°): 0.84016·164.615 = 138.30 lb |

On level ground (g = 0) with θ = 90° the closed form checks the search. Example 1's riders (150 each, so W_f = 150 on each frame), 2 anchors per foot rated 250 lb, dynamic factor 2: b = 3.61232 + 96·0.36397 = 38.5535, h = 96 / 38.5535 = 2.49004, √(1 + h²) = 2.68334, so the minimum is 0.75·(1 − 2.68334) = −1.26251 at φ = 90° − 68.12°/2 = 55.94°. S = 150·1.26251 = 189.376, D / 2 = 13.014, uplift at every foot 2·189.376 − 13.014 = 365.74 lb, 182.87 per anchor against 250: margin 1.37; break-even (2·250 + 13.014) / 189.376 = 2.709. The largest fore-and-aft force on each frame is 1.5·150 = 225 lb, at φ = 45°.

**Example 5, legs:** example 1's inputs, with the legs Southern Pine No.2, not incised. Fc = 1450, Emin = 510,000 psi (Table 4B, 2"–4" wide). Fc* = 1450 · 0.8 = 1160 psi; Emin' = 510,000 · 0.9 = 459,000 psi.

Worked example geometry, buried: the front leg's centerline meets the ground at z_g = −3.3133 and the back leg's at 3.1182, so the front leg governs. Along the beam ℓ = (96 + 3.3133) / 0.939693 = 105.687 and ℓe/d = 2.10 · 105.687 / 3.5 = 63.4, over 50: not computed. (The back leg: 98.843 and 59.3.) In the frame's plane the front leg's longer stretch is the crossbar to the gusset, (92.375 − 37.25) / 0.939693 = 58.663, ℓe/d = 16.8. The same geometry on pads is not computed either, for want of an end condition along the beam.

A lower frame, the worked example with H = 72, the crossbar's top at zc = 30, and level ground (both legs meet the ground at z_g = 0), is computed:

| Quantity | Value |
|---|---|
| In the frame's plane: crossbar middle 30 − 2.75 = 27.25, gusset middle 72 − 3.625 = 68.375 | ℓ = max(27.25, 41.125) / 0.939693 = 43.764; ℓe/d = 43.764 / 3.5 = 12.50 |
| Along the beam | ℓ = 72 / 0.939693 = 76.621; ℓe/d = 2.10 · 76.621 / 3.5 = 45.97, which governs |
| F_cE = 0.822 · 459,000 / 45.972² | 178.52 psi; F_cE / Fc* = 0.15390 |
| C_P = 1.15390/1.6 − √(0.72119² − 0.15390/0.8) | 0.72119 − 0.57249 = 0.14870 |
| Fc' = 1160 · 0.14870 | 172.49 psi |
| R_s, the swing loads on a frame at factor 1 (symmetric) | 300 lb |
| R_w = 0.433798 · 120 / 2 | 26.028 lb |
| P = (2 · 300 + 26.028) / (2 · 0.939693) | 333.10 lb |
| A_n = (3.5 − 0.5625) · 3.5 | 10.28125 in² |
| f_c = 333.10 / 10.28125 | 32.399 psi; margin 172.49 / 32.399 = 5.32 |
| Break-even dynamic factor | (172.49 · 10.28125 · 2 · 0.939693 − 26.028) / 300 = 11.02 |

Computed by hand and by a separate script before the code, and matched by `structural.test.ts`.

These inputs are only for testing. The real values are the owner's to choose with an experienced builder.

## Open questions

- The site's measured slope and the burial depth, chosen with an experienced builder.
- Whether the leg-to-beam bolt's hole counts in the leg's end distance under the beam's weight (#536). It crosses the gusset bolts' line at the beam's mid-depth, between the top gusset bolt and the flush cut: (98.75 − 94.1875) / 0.93969 = 4.855 (9.7D) above that bolt in the worked example, over 4D. It belongs to another joint, and Tables 12.5.1A and 12.5.1B measure a bolt's distances to the member's end and to bolts in its own row, so Kerf measures to the end and does not report this distance.
