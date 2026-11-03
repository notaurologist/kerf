# Template: record cabinet

Status: template version 18 is built (#301; version 2 adds the flattening allowance, #319, version 3 keeps a one-board rail at its board's thickness, #320, version 4 adds assembly and finishing, #313, version 5 adds dealer hardwood, #296, version 6 lets the lumber settle before cutting, #332, version 7 asks about what stands on the top, #331, version 8 sets the case on a Shaker-modern leg base, #338, version 9 adds sliding doors on the end bays, #339, version 10 rewords a screw note and a structural assumption that used "pass", #418, version 11 rewrites the screws note to say how to find the size, #438, version 12 stores a plan without the part lists it leaves empty, #430, and version 13 names the input behind each entered value in the working, so a suggested moisture range or deflection limit says so until confirmed, #417, version 14 lists, when no method fits the tools, every method closest to the tools owned first, #459, and version 15 has every power-tool method say what protection to wear, and the leg taper cut with a circular saw let the blade stop before the saw is lifted, #457, version 16 names the screw length to buy and shows each item's notes on its shopping line, #449, version 17 gives each lumber line the boards that hold its pieces when the store has none of its own, #450, and version 18 checks the case bottom's sag in each bay again, #464), in `packages/core/src/templates/record-cabinet/`. The worked example uses the owner's rough window measurements (stool about 22" high and 56" wide). That's enough for the spec, since every size is a parameter: the owner enters exact measurements in the app when planning the build. The starting questions are built (#314).

A low cabinet with record bays, with room on the top for a turntable, a speaker, or whatever the owner puts there, to stand in front of a window. Following `docs/templates/README.md`: this spec comes before any code, and the template depends on generic work that lands first. Edge-glued panels (#278, #297), wood movement (#284), and shelf deflection for furniture species and long-term loads (#288) have landed. The design-system review (#71) is still to come.

## Design covered by template version 1

- **A case of solid-wood panels,** each edge-glued from boards (#274, #278). Two **sides** and one or more **partitions** stand full height, from the floor to the underside of the top. They divide the case into equal **bays**.
- **Each bay has its own bottom shelf,** housed in dadoes in the panels on either side. Each shelf spans one bay. A single bottom running the full width would rest only on the sides. In the first worked example, a 51" span instead of 17-1/4" would sag about 76 times as much (deflection grows with the fourth power of span; Structural model).
- **The top** is one panel. It overhangs the sides at each end and the case at the front, and it's flush at the back. The sides and partitions are housed in stopped dadoes in its underside.
- **Feet:** below the bottom shelves, each side and partition has a rectangular cutout, leaving a foot at the front and back. The floor shows between the feet.
- **A back rail** under the top at the back of each bay resists racking. The back is otherwise open, for air and cords.
- **Every panel's grain runs the long way:** horizontal in the top and shelves, vertical in the sides and partitions. So every panel moves front to back, together, and no joint fixes one panel across another's grain (`DOMAIN.md`, Wood movement). The back rails are glued into dadoes with their grain across the panels' grain, an interlocking end-to-edge-grain joint. The plan reports each rail's movement (#284) and flags it (owner, #283). Gluing one species, with compatible grain directions, at the moisture content expected in service is what the Wood Handbook recommends to keep these stresses down (Ch. 10, p. 10-7; Ch. 10, p. 10-17).
- **Open bays,** no doors (owner, October 31, 2026).
- **What stands on the top:** Kerf asks for the largest item that will stand there (its footprint and height) and the total weight on the top, not for particular products (owner, #331, November 1, 2026). The owner makes sure anything else fits. Every bay holds records.

Not covered in version 1: doors, drawers, a back panel, adjustable shelves, a bay for anything but records, separate legs or a stand, arched or shaped cutouts, bays of different widths, a solid top on a frame with fasteners that allow movement (#292).

## The Shaker-modern base (template version 8, #338)

The cabinet first stood on its panels with a cutout between them, which looked plainer than the direction on #273: Shaker with mid-century proportions. On November 1, 2026 the owner chose to build that style in stages: this base first, then doors on the two end bays (#339). Version 8 builds the base. Where the sections below describe the panels standing on the floor (shelf height h_f, the foot cutout, the bottom shelves and their check), they are versions 1 to 7, kept for plans stored then; this section replaces them.

### What changed

- **The case sits on a base** of four legs joined by aprons. A **case bottom**, one panel the full width and depth of the case, replaces the three bottom shelves and is the floor of every bay. The sides and partitions stand in stopped dadoes across its top face, the mirror of the top's, so the sides' at its two ends are stopped rabbets (open at the end). Each side and partition is notched at both front corners to fit them. The foot cutouts, h_f, h_c, and f_w go away.
- **Height comes from the parts** (owner, November 1, 2026: "taller cabinet"), not from the window: H = h_l + h_a + t + h_b + t, with the bay's clear height h_b a parameter. The cabinet stands in front of the stool, off the wall by at least the stool's depth B, and the starting questions say so.
- **Legs** are cut from square leg stock the owner buys, such as 1-1/2" hardwood squares (owner, #344), rather than laminated. They taper on their two inside faces only, from the bottom of the aprons to the foot, the Shaker way. Their outside faces stay straight and flush with the case's corners.
- **Aprons** are one board ripped to h_a, so as thick as the board stock. Each joins its legs with a **mortise and tenon**, set back r_a from the legs' outside faces. Tenons are centered in the apron with 1/4" shoulders above and below (rule of thumb), and mitered where two meet inside a leg.
- **The case fastens to the base with screws in slotted holes** (owner, #292; `DOMAIN.md`, Joints that let wood move). They go up through a 1"-wide cleat (rule of thumb) glued inside each side apron, flush with its top, into the case bottom: a round hole 1" from the front, so the front stays flush and the case bottom moves toward the back, and slots at the middle and 1" from the back, each ΔD + 1/16" longer than the round hole. ΔD is the case bottom's movement across D_c from the species, ring orientation, and moisture range; until those are entered, it is sized for the species in Kerf's list that moves most (white oak, C_T = 0.00376) over 6% to 10% (Wood Handbook, Table 13-2), and the plan says so. The screws are outside hard rule 3 (see Hardware below).

### Parameters added and removed

| Parameter | Symbol | Suggested | Basis |
|---|---|---|---|
| Bay clear height | h_b | 13-1/4 | The worked example; a little over a 12-3/8 jacket |
| Leg showing below the aprons | h_l | 5 | The owner's choice for this cabinet |
| Apron height | h_a | 2-1/2 | Rule of thumb, mid-century proportion; checked for sag below |
| Leg stock size and lengths sold | s | 1-1/2; 3, 4 ft | Rule of thumb; measured at the store |
| Foot | s_f | 2/3 × s, rounded down to 1/16 | Rule of thumb for a Shaker taper |
| Apron setback from the legs' faces | r_a | 1/8 | Rule of thumb, a shadow line |
| Tenon thickness | t_t | board thickness / 3, rounded down to 1/16 | Rule of thumb |
| Tenon length | l_t | s/2 + 1/4 | Rule of thumb |

H, h_f, h_c, and f_w are removed. Validation refuses s_f ≥ s (no taper), l_t ≥ s (a tenon through the leg), and r_a + t_t ≥ s (an apron off its leg).

### Worked example (hand-checked)

The worked example: boards 13/16 × 5-1/2, t = 3/4, h_b = 13-1/4, W = 54, D_c = 15, o_s = o_f = 3/4, three bays; h_l = 5, h_a = 2-1/2, s = 1-1/2, s_f = 1, r_a = 1/8, t_t = 1/4, l_t = 1; cherry, flatsawn, 6% to 10%.

- z_b = h_l + h_a = **7.5**; H = 7.5 + 0.75 + 13.25 + 0.75 = **22.25**, 1/4 above a 22 stool.
- Sides and partitions: h_b + 2j = 13.25 + 0.375 = **13.625**, from z_b + t − j = 8.0625.
- Legs **7.5** long, tapering over the bottom 5 to a 1" foot: each taper at atan(0.5/5) = 5.71°.
- Aprons: front and back 52.5 − 3 + 2 = **51.5**, sides 15 − 3 + 2 = **14**, all 13/16 thick, so each tenon's cheeks are (13/16 − 1/4)/2 = **9/32** and its mortise starts 1.5 − 0.125 − 0.8125 + 0.28125 = **27/32** from the leg's inside face, from 5.25 to 7.25 up the leg.
- Cleats **12** long; slots ΔD + 1/16 = 15 × 0.00248 × 4 + 0.0625 = **0.2113**; without the species, 15 × 0.00376 × 4 + 0.0625 = **0.2881**.

### Structural model, version 8

- **Each front and back apron** as a simply supported span between legs, L = 52.5 − 2 × 1.5 = 49.5, breadth 13/16 (the board), depth h_a = 2.5 (I = 0.8125 × 2.5³ / 12 = 1.05794 in⁴), carrying half of everything in the case: records along three 16.5 bays at 40 lb/ft, 3.3333 × 49.5 = 165 lb, plus 35 lb on the top, 200 lb in all, spread as w = 200 / 49.5 / 2 = 2.0202 lb/in on each apron.
  - δ = 5 × 2.0202 × 49.5⁴ / (384 × 1,490,000 × 1.05794) = 0.10019"
  - Long-term: 1.5 × 0.10019 = **0.15028"** (span / 329), against L/144's 0.344
  - Taking the apron alone ignores the case bottom and sides above it, which stiffen it, so this overstates the sag.
- **The case bottom in each bay** (from version 18, #464): the bottom shelves' check, on the case bottom. Each bay of it spans along its grain between the panels on either side, which stand on it over the front and back aprons, so the model is the bottom shelf's: L = b + t, breadth D_c, depth t, records at the owner's pounds per foot. Version 8 dropped this check when the case bottom replaced the shelves, though the reason for it (below, under Structural model) still holds for a wider bay. The front and back aprons under its edges also carry it, so taking it as spanning only along its grain overstates its sag. With the doors' 17" case (version 9): I = 17 × 0.75³ / 12 = 0.597656 in⁴, w = 40/12 = 3.3333 lb/in, E = 1,490,000 psi.
  - δ = 5 × 3.3333 × 17.25⁴ / (384 × 1,490,000 × 0.597656) = 1,475,724 / 341,953,500 = 0.0043156"
  - Long-term: 1.5 × 0.0043156 = **0.0064733"** (span / 2,665)
  - Edge of range, walnut: the bottom shelf's numbers below, 0.000792" and **0.001188"** long-term.
- The top's check is unchanged.
- **On the checklist,** not computed: the mortise-and-tenon joints under racking, and the loaded cabinet tipping. Both are for an experienced builder.

### Build steps, version 8

After the panels and their dadoes and rabbets: cut the notches, the mortises in the legs, and the tenons on the aprons, and drill the cleats' screw holes; fit everything dry; glue up the base, then the cleats into it, then the case on it, then the top; screw the case to the base (a generic `fasten` operation, by drill/driver or impact driver); ease the edges; finish.

### Decided

The owner agreed to the design on November 1, 2026, with the legs bought as square stock rather than laminated. It was built in this order, each its own pull request: mortise and tenon joints (#343), parts from board stock and slotted screw holes (#344), then the template (#338).

## Sliding doors on the end bays (template version 9, #339)

Stage 2 of the Shaker-modern cabinet. The owner chose on November 1, 2026: two **sliding doors in two tracks**, one per end bay, each sliding over the open middle bay; each door a **frame with a solid floating panel**; and a **routed finger recess** for a pull. This replaces the hinged doors first scoped on #339.

### How it works

- **Tracks:** two grooves along the case bottom's top face and two along the top's underside, between the sides, at the front. The front track holds the left door and the rear track the right, so the doors pass each other and both end bays can be open at once. With both closed, the middle bay stays open.
- **The partitions stop short of the front** by the track zone d_t, so the doors run in front of them. The sides run the full depth, and each door stops against its side.
- **Lifting a door in:** the top's grooves are deeper than the bottom's. A door is lifted up into the top groove, swung in at the bottom, and dropped into the bottom groove.
- **Doors** are as thick as the board stock, so they come from the same lumber without planing. Each is two stiles and two rails, joined with stub tenons in grooves, around a solid panel. The panel's edges are rabbeted to a tongue that floats in the grooves, unglued, with its gap from the movement estimate (`DOMAIN.md`, Joints that let wood move).
- **Pull:** a shallow recess routed into each door's face near its outer stile, so nothing stands proud to catch the other door.
- **Records still fit:** the track zone comes off the bays' depth, so the case gets deeper. Records need D_c − d_t − r ≥ the jacket, where r is the back rail's thickness.

### New parameters, each with a suggestion

| Parameter | Symbol | Suggested | Basis |
|---|---|---|---|
| Groove clearance on a door | c_g | 1/16 | Rule of thumb: the groove is the door's thickness plus this, so it slides freely |
| Land between and around the grooves | l_g | 1/4 | Rule of thumb |
| Bottom groove depth | d_b | 1/4 | Rule of thumb |
| Top groove depth | d_u | 9/16 | Rule of thumb: twice the bottom's, plus 1/16 to lift the door in |
| Door overlap past the partition | o_d | 1/2 | Rule of thumb, so no gap shows at the middle bay |
| Stile and rail width | w_s | 2 | Rule of thumb, Shaker proportion |
| Stub tenon and groove depth | g_s | 3/8 | Rule of thumb |
| Finger recess | | 3/4 wide, 3 tall, 1/4 deep, centered on the outer stile | Rule of thumb; fixed, not a parameter |
| Case depth | D_c | 17 (was 15) | So records fit behind the tracks; see below |
| Doors | | sliding | The owner's choice; "none" leaves every bay open, as in version 8 |

The panel grooves are as wide as the aprons' tenons, t_t, and the rails' stub tenons as thick, so one setting cuts both. A stored version 8 plan reads back with no doors and these suggestions, ready if the owner turns them on. The editor shows the door sizes only with sliding doors, so a cabinet with no doors needs none and keeps none it was not given; with sliding doors, each is required (#501).

Derived: the groove width is t_d + c_g, where t_d is the board's thickness; the track zone is d_t = 3·l_g + 2·(t_d + c_g); the door height is h_b + d_b + d_b (seated 1/4 in the bottom and 1/4 up into the top); the door width is b + t + o_d.

### Worked example (hand-checked)

Boards 13/16, t = 3/4, b = 16-1/2, h_b = 13-1/4, back rails 13/16 thick.

- Groove 13/16 + 1/16 = **7/8**; track zone d_t = 3 × 1/4 + 2 × 7/8 = **2-1/2**.
- Record depth behind the tracks, D_c − 2.5 − 0.8125: at 15, **11-11/16**, less than a 12-3/8 jacket; at 16, **12-11/16**, 5/16 to spare; at 17, **13-11/16**. The suggestion is 17.
- Door **13-3/4** high (13.25 + 0.25 + 0.25), **17-3/4** wide (16.5 + 0.75 + 0.5). Lifted in, its top rises into the 9/16 top groove: it has 13.25 + 0.5625 − 13.75 + 0.25 = 5/16 of lift, and needs 1/4 to clear the bottom groove, so 1/16 to spare.
- Stiles 2 × 13-3/4; rails 17.75 − 2 × 2 + 2 × 3/8 = **14-1/2** long, 2 wide. The panel opening is 13-3/4 × 9-3/4. The grooves are t_t = 1/4 wide, centered in the 13/16 frame, 9/32 from each face.
- Panel thickness t = 3/4, rabbeted 3/8 wide and (3/4 − 1/4)/2 = 1/4 deep on both faces at every edge, to a 1/4 tongue.
- Panel: across its grain (horizontal) 13.75 + 2 × 3/8 = 14.5 into the grooves; flatsawn cherry, 6% to 10%, moves ΔD = 14.5 × 0.00248 × 4 = 0.144, so a gap of 0.072 + 1/32 = **0.103** at each edge, and the panel is **14.29** wide. Along its grain, 9.75 + 2 × 3/8 − 2 × 1/32 = **10-7/16** high.

- Clamps for each door's glue-up open across its 17-3/4 width. With 17" of case, the top is 17-3/4 deep and glues up from four boards, the side aprons are 16 long, and the cleats 14, slotted 17 × 0.00248 × 4 + 1/16 = 0.2311. The top's check under 35 lb becomes 1.5 × 0.0040254 = 0.006038 (I = 17.75 × 0.75³ / 12 = 0.624023 in⁴).

### Parts, refusals, and build steps

- **Tracks** are dadoes stopped at both ends, between the sides' inside faces, so none shows at the case's ends: a generic operation, cut with a router between two stops or with a drill and chisel. The partitions' stopped dadoes in the top and case bottom start d_t + s_d from the front.
- **Each door** is an outer stile, with the finger recess in its front face, an inner stile, two rails, and a panel. The two doors' parts are the same, so each is cut twice: the right door's outer stile is the left one's turned end for end.
- **Refused:** a top track less than twice the bottom's depth (the door cannot lift out), a panel groove as deep as the frame is wide, a groove as thick as the panel (no tongue), a recess that would break into the groove, a panel that pulls out of its grooves at its narrowest (2 × gap − 1/32 ≥ g_s), and fewer than s_r of bay between the tracks and the back rails.
- **Build steps:** the tracks with the other dadoes; then the doors' grooves, stub tenons, rabbets, and recesses; the doors are glued up after the case is screwed to the base, each frame around its panel, which is not glued and is best finished first. The hardware notes say how to lift a door in. The door panel's movement is on the plan with the other parts'.

### Decided

The owner agreed on November 1, 2026: a 17" case depth and a 2" frame. It was built in this order, each its own pull request: edge grooves, edge rabbets, and finger recesses, then the template, which also added the dado stopped at both ends for the tracks.

## Coordinates

- **x** runs along the cabinet, from the left end of the top (x = 0) to the right end (x = W), looking at the front.
- **y** runs front to back, from the front edge of the case (y = 0) to the back (y = D_c). The top's front overhang is at negative y.
- **z** is up from the floor.
- Lengths in decimal inches (`DOMAIN.md`, Units).

## Parameters

Ranges are proposals for the owner's review.

| Parameter | Symbol | Range | Meaning and why |
|---|---|---|---|
| Overall width | W | 30–72 | Length of the top. 30 fits two bays. 72 is longer than any window this is for. |
| Overall height | H | 16–30 | Floor to the top surface. Below 16 there's no room for a record bay and feet. 30 is table height. |
| Case depth | D_c | 13–20 | Front to back of the sides, partitions, and shelves. Must hold a record jacket (Validation). |
| Bays | n | 2–4 | Number of equal bays. Partitions: n − 1. |
| Panel thickness | t | 5/8–1 | Actual, after flattening. One thickness for every panel in version 1. Hardwood 4/4 is 13/16" surfaced two sides (Wood Handbook, Table 6-4, p. 6-6), so 3/4" comes from 4/4 flattened after glue-up. Boards bought already surfaced to 3/4" end up a little thinner once the glued-up panel is flattened, so t is what's left after flattening: a glued-up panel's boards must be at least t plus the flattening allowance thick, and a part of one board at least t (`lumber/panel.ts` refuses a thinner board). Suggested as the board thickness less the flattening, 11/16 from 3/4 boards (#319). |
| Dado depth | j | 0 < 2·j < t; suggested t/4, rounded down to 1/16 | Depth of every dado. Partitions take a shelf dado on both faces at the same height, leaving t − 2·j between them. No published source sets a limit, so the plan shows that thickness and flags the joint for an experienced builder (owner, #283). The suggestion is a rule of thumb: a dado at most a third of the thickness it's cut into, and t/4 on both faces leaves half the partition, rounded down to the 1/16 a router is set in, 1/8 for 11/16 panels (#317). |
| Stopped-dado setback | s_d | 0 < s_d < D_c; suggested 1/2 | How far the top's dadoes stop short of the case's front edge, so the joint doesn't show from the front. A design choice, not a strength rule (owner, #283). |
| End overhang | o_s | 0–2 | Top beyond each side. |
| Front overhang | o_f | 0–2 | Top beyond the case's front. |
| Shelf height | h_f | 3–10 | Floor to the underside of the bottom shelves. |
| Cutout height | h_c | 0 to h_f − 1 | Height of the cutout between the feet. 0 means no cutout. |
| Foot width | f_w | 2 to D_c / 3 | Front-to-back width of each foot. |
| Back rail height | h_r | 2–4 | Vertical width of each back rail. |
| Record jacket | s_r | owner-entered | Measured from one of the owner's LPs (commonly 12-3/8" square; confirm by measuring). |
| Largest item on the top | I_w × I_d × I_h | from the starting questions | The footprint of the largest item that stands on the top, and its height at its tallest (such as a turntable with its lid open), for comparing with the window. |
| Board stock | | suggested 3/4 × 5-1/2; 4, 6, 8 ft | Actual thickness and width, and the lengths the store sells, for the boards the panels are glued from (owner, #278). The suggested size is a dry 1x6 board (American Softwood Lumber Standard, PS 20-10, Table 3), to be checked against the store's boards (#317). Or a lumber dealer's hardwood by the board foot (#296): thickness class (suggested 4/4), surfaced thickness (13/16, Wood Handbook Table 6-4), the width to plan with (6, FAS's minimum width, pp. 6-3 to 6-4), lengths 4 to 16 ft (p. 6-3), and a waste allowance (20%, a rule of thumb). A starting question asks which. |
| Panel allowances | | suggested 1/16, 1/2, 1, 1/16 | Jointing per glued edge, rip, trim per end, and flattening (`DOMAIN.md`, Edge-glued panels). No published source gives them, so the suggestions are rules of thumb (#317, #319). |
| Species and grain | | owner-entered | Species for every panel, and ring orientation (flatsawn, quartersawn, unknown) for movement (#284). |

### Ranges that bound generation (#421)

Every number has a minimum and a maximum. A panel takes n = ⌈(width + rip − 2a) / (w − 2a)⌉ boards (`DOMAIN.md`, Edge-glued panels), so a board width w near twice the jointing allowance a asked for thousands of boards: a 0.13" board took 5.7 seconds to generate and 0.1251" did not finish. Values far past any real one also overflowed the display formatting. These ranges were set without the owner on November 2, 2026, as conservative proposals for review. None changes the plan for values inside it, so the template version stays 11.

| Parameter | Range | Basis |
|---|---|---|
| Board width (store) and plan width (dealer) | 1-1/2 to 12 | From a 1x2 board (1-1/2" actual) to past a 1x12 (11-1/4"), rule of thumb. With the jointing range below, w − 2a is at least 1, so the top, at most 22 deep with 2 of rip, glues up from at most ⌈(22 + 2 − 1/2) / 1⌉ = 24 boards. |
| Board thickness (store) and surfaced thickness (dealer) | 5/8 to 2 | Thinner than the thinnest panel makes no panel; 2 is past 8/4 surfaced (1-3/4, Wood Handbook Table 6-4) |
| Jointing per edge | 0 to 1/4 | Rule of thumb: four times the suggested 1/16 |
| Rip | 0 to 2 | Rule of thumb: four times the suggested 1/2 |
| Trim per end | 0 to 4 | Rule of thumb: four times the suggested 1 |
| Flattening | 0 to 1/4 | Rule of thumb: four times the suggested 1/16 |
| Lengths sold, boards and leg stock | 1 to 16 ft | A dealer's hardwood comes in 4 to 16 ft (Wood Handbook, p. 6-3); a store's 1x boards are shorter |
| Dado depth j | 1/16 to 1/2 | 1/16 is the smallest router setting the suggestion rounds to; 2·j < t ≤ 1 |
| Stopped-dado setback s_d | 1/16 to 20 | s_d < D_c ≤ 20 |
| Foot s_f, tenon length l_t | 1/16 to 3 | Each is less than the leg stock, at most 3 |
| Apron setback r_a | 0 to 3 | r_a + t_t < s ≤ 3 |
| Tenon thickness t_t | 1/16 to 2 | Thinner than the apron, a board at most 2 thick |
| Record jacket s_r | 1/16 to 18 | No more than the tallest bay, 18 |
| Largest item on the top, each way | 1/16 to 72 | No wider than the longest top; 72 high for anything that stands on a low cabinet |

1/16 is the smallest length Kerf shows. Before these ranges, Kerf refused a too-large dado, foot, tenon, setback, jacket, or item only by validation, which still applies inside them.

## Derived geometry

### Case width and bays

- Case width: W_c = W − 2·o_s
- Clear width inside the sides: C = W_c − 2·t
- Bay clear width: b = (C − (n − 1)·t) / n
- Left face of the left side: x = o_s. Left face of partition k (k = 1 to n − 1): x_k = o_s + t + k·b + (k − 1)·t
- Top depth: D_t = D_c + o_f

### Heights

- Underside of the top: z = H − t
- Top of the bottom shelves: z = h_f + t
- Bay clear height: h_b = (H − t) − (h_f + t)
- Side and partition length (height): H_p = H − t + j. The panel runs into the top's dado.
- Back rail: from z = H − t − h_r to z = H − t, at the back, y = D_c − r to D_c, where r is the rail's thickness.

### Part sizes

| Part | Qty | Length | Width | Thickness | Joints |
|---|---|---|---|---|---|
| Top | 1 | W | D_t | t | Stopped dadoes across the underside, one per side and partition, j deep, t wide, from the back edge to s_d short of the case's front edge |
| Left side, right side | 1 each | H_p | D_c | t | Shelf dado on the inside face, j deep; foot cutout. Mirror images, so two parts with their own letters (`docs/design/README.md`, Stage 11) |
| Partition | n − 1 | H_p | D_c | t | Shelf dadoes on both faces, j deep; foot cutout |
| Bottom shelf | n | b + 2·j | D_c | t | Housed in dadoes at both ends |
| Back rail | n | b + 2·j | h_r | r | Housed in dadoes at both ends (rail dadoes in the sides and partitions, r wide). A rail of one board isn't flattened, so r is the board's thickness; a rail glued from boards is t (#320). |

Each side and partition gets a notch at its front top corner, s_d long and j deep, so it fits the stopped dado.

### Foot cutout

On each side and partition, a rectangle from the floor up to z = h_c, from y = f_w to y = D_c − f_w. Width D_c − 2·f_w.

### Placements

Each part's placement follows `DOMAIN.md`, Implications for the data model (Geometry), from the coordinates above. The fit tests:
- every panel's top end meets the top's dado
- every shelf's ends meet the shelf dadoes
- the right side's right face is at x = W − o_s
- the feet reach z = 0

## Hardware, operations, build steps, drawings

- **Hardware:** glue, finish, and (from version 8) the wood screws that fasten the case to the base. The screws are `structural: false` and are not `confirmed` fields. They hold the case to the base through slotted holes so the case bottom can move; the case's weight rests on the cleats and the side aprons, and no structural check reads a screw size, so hard rule 3 has nothing to ask the owner to confirm. From version 16 (#449) Kerf computes the length from that rule of thumb, the cleat's thickness plus two-thirds of the case bottom's, to the nearest quarter inch, and names the line by it ("Wood screws, 1-1/4" long"). Rounding to the nearest adds at most 1/8", and a third of the thinnest case bottom the form allows (5/8") is 0.208", so the points always stop inside the bottom. The note gives the thicknesses, how far short of the top face the points stop, and to take the next shorter screw if the cut parts measure thinner; the gauge still comes from the lumber or hardware supplier. Worked example: 13/16 + 2/3 × 3/4 = 1.3125, so 1-1/4", stopping 0.8125 + 0.75 − 1.25 = 5/16" short. Edge of range: 1-1/16 + 2/3 × 1 = 1.729, so 1-3/4", also 5/16" short. What would change this: a check that depends on screw size or withdrawal (for example, if the case had to resist being pulled off the base). Then the screws become a confirmed field and a hardware check, with a source for the withdrawal value (#438).
- **Version 11 (#438):** only the screws' note changes (`outputs.design.hardware[].notes[]`).
- **Version 16 (#449):** the screws' name and note, and each shopping line's notes, which both shopping lists now show (`outputs.design.hardware[].name` and `.notes[]`, `outputs.hardware[].description` and `.notes[]`).
- **Version 17 (#450):** each lumber line's other lengths for when the store has none of its boards (`outputs.lumber.lines[].alternatives[]`; `DOMAIN.md`, Buyable lengths). Board stock is named by the owner, so the template offers no other stock.
- **Version 12 (#430):** a stored plan leaves out each part list that is empty. Reading fills them back in, so nothing a plan shows changes.
- **Operations:** generic code makes each panel's work from its stock (#297): cut its boards to length, joint the glued edges, glue up, flatten, rip to width, and crosscut its ends. A back rail narrower than a board is one board, cut to length and ripped, and keeps the board's thickness. The template adds the dadoes, stopped dadoes, notches, foot cutouts, a dry fit of every part, gluing the case (sides, partitions, shelves, and rails, clamped across the case width W − 2·o_s), gluing on the top (clamped from the top down, H), easing the edges, and finishing every part.
- **Build steps:** let the lumber settle indoors, before any board is cut (`DOMAIN.md`, Moisture content when bought; #332); cut the boards; glue up panels; cut panels to size; cut dadoes; cut notches and feet; dry-fit; glue up the case; glue on the top; ease the edges, once the joints are closed so no edge that meets another is rounded; finish. Each operation's methods come from the knowledge base, for the owner's tools. The worked example's clamps must open 52-1/2 across the case and 20 for the top; with shorter clamps there is no method for gluing the case, and the step names the clamp opening it needs.
- **Drawings:** front and end elevations with bay widths and heights; a section through a bay showing the shelf, dadoes, and back rail; each panel's cut detail with dadoes and cutout; an exploded view. Showing grain direction and movement on drawings is for #71.

## Validation and flags

Refused:
- Bay clear height below the record jacket: h_b < s_r
- Case depth below the record jacket: D_c < s_r
- The largest item on the top when I_w > W or I_d > D_t
- h_c ≥ h_f, or 2·f_w ≥ D_c
- 2·j ≥ t (no wood left between a partition's dadoes), or s_d ≥ D_c

Flags (`DOMAIN.md`, Expert-check categories):
- **Router technique** and **table saw operations:** dadoes and stopped dadoes.
- **Jointers, planers** and **table saw operations:** raised by the panel methods that use those machines (#297).
- **Wood movement:** the back rails' cross-grain joint, with each rail's movement across its height (#284), and the top's dadoes if species or ring orientation differ between the top and the panels.
- **Load-bearing or tip-prone designs:** the wood left between a partition's back-to-back dadoes, t − 2·j.
- **Load-bearing or tip-prone designs:** record shelves, and heavy things on the top.

Checklist, not computed:
- Racking: an open back, with only dadoes and back rails.
- Tipping: whether the loaded cabinet can tip forward. Low and deep, but confirm.
- Joint strength of glued dadoes.

## Worked example (hand-checked)

From the rough measurements: stool about 22" high, 56" wide. The owner's choices so far: top about 2" below the stool, width to match the window trim. The trim width isn't measured, so 54" stands in for it. The owner's exact measurements go in the app, not here.

Parameters: W = 54, H = 20, D_c = 15, n = 3, t = 3/4, j = 3/16, s_d = 1/2, o_s = 3/4, o_f = 3/4, h_f = 5-1/4, h_c = 4, f_w = 2-1/2, h_r = 3. The template's worked example adds a largest item on the top 16-1/2 wide, 13-1/2 deep, and 15 high, such as a turntable with its lid open, all illustrative. Its structural inputs are cherry, flatsawn, 6% to 10% moisture content (the Wood Handbook's range for individual pieces indoors, Table 13-2), 40 lb per foot of records, 35 lb on the top (illustrative), and L/144.

| Value | Working | Result |
|---|---|---|
| W_c | 54 − 2(0.75) | 52.5 |
| C | 52.5 − 2(0.75) | 51.0 |
| b | (51 − 2(0.75)) / 3 | 16.5 |
| x₁ | 0.75 + 0.75 + 16.5 | 18.0 |
| x₂ | 0.75 + 0.75 + 2(16.5) + 0.75 | 35.25 |
| Right side's left face | 35.25 + 0.75 + 16.5 | 52.5 = W − o_s − t ✓ |
| D_t | 15 + 0.75 | 15.75 |
| h_b | (20 − 0.75) − (5.25 + 0.75) | 13.25 |
| H_p | 20 − 0.75 + 0.1875 | 19.4375 (19-7/16) |
| Shelf and rail length | 16.5 + 2(0.1875) | 16.875 (16-7/8) |
| Cutout width | 15 − 2(2.5) | 10 |
| Left in a partition | 0.75 − 2(0.1875) | 0.375 (3/8), flagged |
| Notch | s_d × j | 1/2 × 3/16 |

Cut list: top 54 × 15-3/4; left side, right side, and partitions (2) 19-7/16 × 15; bottom shelves (3) 16-7/8 × 15; back rails (3) 16-7/8 × 3. The panels are 3/4 thick; the rails, each one 13/16 board ripped to width, are 13/16, and their dadoes run from 15 − 13/16 = 14-3/16 to the back edge.

Panels, with the suggested allowances and 4/4 hardwood surfaced two sides, 13/16 thick (Wood Handbook, Table 6-4), which flattens to t = 3/4: boards 13/16 × 5-1/2, jointing 1/16 per glued edge, rip 1/2, trim 1 per end, flattening 1/16 (13/16 − 1/16 = 3/4). Boards per panel n = ⌈(width + 1/2 − 1/8) / (5-1/2 − 1/8)⌉ = ⌈(width + 0.375) / 5.375⌉; glued width n·5.5 − 0.125·(n − 1); board length = part length + 2.

| Part | Width | n | Glued width | Board length | Boards |
|---|---|---|---|---|---|
| Top | 15.75 | ⌈16.125 / 5.375⌉ = 3, exactly | 16.25 | 56 | 3 |
| Each side and partition | 15 | ⌈15.375 / 5.375⌉ = ⌈2.86⌉ = 3 | 16.25 | 21.4375 (21-7/16) | 4 × 3 = 12 |
| Bottom shelf | 15 | 3 | 16.25 | 18.875 (18-7/8) | 3 × 3 = 9 |
| Back rail | 3 | ⌈3.375 / 5.375⌉ = 1 | 5.5 | 18.875 (18-7/8) | 3 |

The top is an exact fit: 3 boards glue to 16.25, which is its 15.75 plus the 1/2 rip allowance, so the template's tests cover the whole-number case.

Checks: a 12-3/8" jacket fits (13.25 high, 15 deep). The largest item fits on the top: 16.5 ≤ 54 wide, 13.5 ≤ 15.75 deep.

Standing at the window: the top at 20" is 2" below the stool. If the bottom of the apron is below 20", the cabinet stands off the wall by at least the stool's depth. Both are unmeasured.

## Edge of range (hand-checked)

Parameters: W = 30, H = 30, D_c = 13, n = 2, t = 1, j = 1/4, s_d = 1/2, o_s = 1, o_f = 1, h_f = 10, h_c = 8, f_w = 3, h_r = 3. Largest item on the top 15 × 13 × 15.

| Value | Working | Result |
|---|---|---|
| W_c | 30 − 2(1) | 28 |
| C | 28 − 2(1) | 26 |
| b | (26 − 1) / 2 | 12.5 |
| x₁ | 1 + 1 + 12.5 | 14.5 |
| D_t | 13 + 1 | 14 |
| h_b | (30 − 1) − (10 + 1) | 18 |
| H_p | 30 − 1 + 0.25 | 29.25 |
| Shelf and rail length | 12.5 + 2(0.25) | 13 |
| Cutout width | 13 − 2(3) | 7 |
| Left in the partition | 1 − 2(0.25) | 0.5, flagged |

Validation: a 12-3/8" jacket fits 13 deep with 5/8" to spare, and the 13" deep item fits the 14" top (D_t = 13 + 1).

## Structural model

Computed (#288; `DOMAIN.md`, Structural checks):

- **Each bottom shelf:** a simply supported span between the centerlines of the panels on either side, L = b + t, breadth D_c, depth t, under a uniform long-term load of records (lb per foot of shelf, owner-entered). Deflection only, with E from Wood Handbook Table 5-3b, total = 1.5 × immediate (NDS 2024 3.5.2). Taking span to centerlines, where the shelf really bears in a dado, overstates the span slightly, which is conservative.
- **The top, under everything on it:** each span between panels as a simply supported span, L = b + t, breadth D_t, depth t, with the whole weight on the top (owner-entered, #331) as one point load at midspan, where it bends the top most. Spreading the weight out, or across spans, deflects it less, and the top is continuous over the partitions, so treating each span as simply supported also overstates deflection.
- **Deflection limit:** owner-entered. For reference, the Architectural Woodwork Standards (1st edition, 2009, Section 10, 1.2.21.3.1.1) call L/144 "the industry standard for the maximum acceptable deflection of a shelf". That edition is superseded by ANSI/AWI 0641-2019, which hasn't been checked. It also treats creep as not a defect, while Kerf includes it.

Not computed (checklist): bending and shear of these members (no design values for furniture lumber), racking, tipping, and glue joints.

### Worked examples (hand-checked)

40 lb per foot is illustrative; the owner weighs a run of records.

**First worked example, cherry shelf:** L = 16.5 + 0.75 = 17.25; I = 15 × 0.75³ / 12 = 0.52734 in⁴; w = 40/12 = 3.3333 lb/in; E = 1,490,000 psi.
- L⁴ = 88,543.4
- δ = 5 × 3.3333 × 88,543.4 / (384 × 1,490,000 × 0.52734) = 1,475,724 / 301,725,000 = 0.004891"
- Long-term: 1.5 × 0.004891 = 0.007336" (span / 2,351)

**Edge of range, walnut shelf:** L = 12.5 + 1 = 13.5; I = 13 × 1³ / 12 = 1.08333 in⁴; E = 1,680,000 psi.
- δ = 5 × 3.3333 × 33,215.1 / (384 × 1,680,000 × 1.08333) = 553,584 / 698,880,000 = 0.000792"
- Long-term: 0.001188"

**First worked example, the top under 35 lb:** L = 17.25; I = 15.75 × 0.75³ / 12 = 0.553711 in⁴; P = 35 lb at midspan; E = 1,490,000 psi.
- L³ = 5,132.95
- δ = P·L³ / (48·E·I) = 35 × 5,132.95 / (48 × 1,490,000 × 0.553711) = 179,653.4 / 39,601,406 = 0.004537"
- Long-term: 1.5 × 0.004537 = 0.006805" (span / 2,535)

At these bay widths, shelf sag is small. The check still runs, because a wider bay or a heavier load changes that quickly.

## Starting questions

Answers suggest parameters (M8), each labeled as the owner's choice:

- **Stool height A:** suggests H = A − 2 (owner's choice: top a couple of inches below the stool).
- **Casing width D:** suggests W = D (owner's choice: match the trim). The stool width E is shown for reference.
- **Stool depth B and apron bottom C:** no parameter. If H > C, the plan notes that the cabinet stands at least B from the wall.
- **The largest item on the top:** its width, depth, and height, put straight in. When the top's height plus the item's stands above the stool A, the plan says by how much.
- **Everything else** in the parameters: the worked example's case, a 1x6 board from the lumber standard, and rules of thumb for the dado depth, setback, and allowances, each labeled. Two structural inputs are suggested from their sources, each stored with its basis and unconfirmed until the owner ticks it in the structural review or changes it (hard rule 3, #417): moisture content 6% to 10% (Wood Handbook, Table 13-2, interior woodwork in most of the United States) and L/144 (Architectural Woodwork Standards). The others stay empty.

## Sources

- Wood Handbook (2021), chapter 6, Commercial Lumber, Table 6-4, p. 6-6: https://research.fs.usda.gov/treesearch/62245
- AWI, AWMAC, and WI, Architectural Woodwork Standards, 1st edition (2009), Section 10, Casework: https://woodworkinstitute.com/wp-content/uploads/2014/09/WI_AWS_sec10NM.pdf
- Wood Handbook (2021) and NDS 2024, as cited in `DOMAIN.md`. Chapter 10 (Wood Adhesives): Moisture Content and Dimensional Changes, p. 10-7; End-to-Edge-Grain Joints, p. 10-17: https://research.fs.usda.gov/treesearch/62250

## Open questions

1. **Measurements:** decided, not needed for the spec (owner, November 1, 2026). The worked example uses the rough ones. The owner enters exact measurements in the app (stool height A, stool depth B, apron bottom C, casing width D, stool width E) when planning the build.
2. **Dado depth:** decided, no limit, since no published source gives one. The plan shows what's left of each partition and flags it (owner, #283). Suggested as t/4, a rule of thumb (owner, #317, November 1, 2026).
3. **Stopped dadoes:** decided, the setback s_d is a design choice (owner, #283), suggested at 1/2 (#317).
4. **Back:** decided, back rails with an open back (owner, October 31, 2026). Racking stays on the checklist for an experienced builder. If more is needed, the next step is a second rail at the bottom back of each bay, before a full back panel.
5. **What the top holds:** decided on #331 (owner, November 1, 2026). Kerf asks for the largest item and the total weight on the top, not a particular turntable or speaker, and every bay holds records.
6. **Bays:** decided, equal bays, three in the owner's plan (October 31, 2026). Two or four cost or gain only 3/4" of record width per partition. Three keeps shelf sag negligible and gives an even front under the window.
7. **Panel stock:** decided on #278, then changed on #317 (owner, November 1, 2026): the board stock and allowances start from suggested values the owner can change, so a beginner need not know them. Dealer hardwood by the board foot was added on #296.
8. **Flattening:** decided on #319 (owner, November 1, 2026). A flattening allowance sits with the other panel allowances, and a glued-up panel must be no thicker than its boards less it. The dado methods say to cut each dado to the part it holds as made, measured, rather than to the plan's number.
