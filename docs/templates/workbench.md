# Template: workbench

Status: Draft (November 3, 2026), for the owner's review (#576). Every design question is decided, and the generic issues it waited on (#578 to #585) have landed. Not built. Joint-first: the build (#577) declares each joint below and derives the parts' lengths, end cuts, and features from them (`docs/explorations/joint-model.md`). It is the joint model's test, and it lives on `explore/joint-model` until the owner decides whether to adopt the model.

The design is the sketch the owner agreed on November 3, 2026, from photos of a hardwood bench (recorded on #576). Sizes and proportions taken from those photos are suggestions with the `example` basis. Brand names in the photos are left out (hard rule 11).

## Design covered

- **A top of hardwood strips glued on edge** into one slab, overhanging the base at each end and a little at the front and back. Round dog holes run along the front, and in line with the end vise.
- **Two vises.** A face vise at the front left: a wooden jaw (chop) on a bought screw, clamping against the top's front edge. An end vise at the right end: a chop across the top's end on a bought screw, clamping between dogs in the chop and dogs in the top.
- **A base of four legs on two feet.** The feet run front to back at each end. Each end frame is two legs tenoned into a foot below and an end rail under the top. Long rails at the bottom, front and back, tenon into the legs and carry the case.
- **A case between the legs**, of panels in dadoes like the record cabinet's, with a back:
  - **Drawers** under the top: two side by side over one full width, on bought side-mount slides. Three solid drawer shelves cross the case, under the top, between the rows, and above the doors, and a full-depth divider between the upper drawers is housed in the two above and below it (#583). Each drawer is a box with through dovetails at all four corners and a separate front screwed on.
  - **Two hinged doors** below the drawers, frame and panel like the record cabinet's doors, closing the space to the low rails.
- **Glued mortise and tenon** throughout the base. The base does not come apart.

Not covered in version 1: a leg vise, a planing stop, a tool tray or till, casters, drawers in the lower case, or a top of laminated 2x stock or sheet goods.

## Coordinates

x along the bench from the top's left end, y from the top's front edge toward the back, z up from the floor. Inches.

## Parameters

Every parameter starts from a suggestion with its basis (owner's standing preference). Structural inputs and hardware sizes are entered or confirmed by the owner (hard rule 3).

| Symbol | Parameter | Range, and why | Suggested, and its basis |
|---|---|---|---|
| H | Height to the top surface | 28 to 42: from a low planing bench to standing assembly | Wrist height, estimated as 0.485 × the owner's height and rounded to 1/16 (`rule-of-thumb`, `knowledge/workHeight.ts`, #582). The worked example keeps the owner's 34-1/8 (`example`, owner's photo) |
| L | Top length | 36 to 96 | 61-7/8: the owner's 64-3/8 overall less the end vise chop (`example`) |
| D | Top depth | 14 to 30 | 17-5/8: the owner's 20-1/8 overall less the face vise chop (`example`) |
| T | Top thickness, after flattening | 1-1/2 to 4: holdfasts are commonly made to grip through tops up to about 4" (to source from a woodworking reference, not a maker, before use) | 2-1/2 (`rule-of-thumb`, chosen by the owner) |
| c | Chop thickness, both vises | 1-1/2 to 3 | 2-1/2, matching T (`rule-of-thumb`) |
| o_e | Top overhang past the legs at each end | 2 to 12 | 5 (`example`, owner's photo) |
| i_f | Top overhang past the front legs | 0 to 3 | 0: flush, so work in the face vise rests against the leg (owner) |
| i_b | Top overhang past the back legs | 0 to 3 | 1 (`example`, owner's photo) |
| s | Leg size, square | 2-1/2 to 4 | 3 (`example`), glued up from the board stock (owner) |
| h_f | Foot height | 2 to 4 | 3 (`example`) |
| f_o | Foot past the legs, front and back | 0 to 3 | 1 (`example`) |
| h_r | Low rail height | 2 to 5 | 3 (`example`) |
| h_e | End rail height | 2 to 5 | 3, as the low rails (`rule-of-thumb`) |
| t_r | Rail thickness, end and low rails | 1 to s | 1-1/2 = s / 2 (`rule-of-thumb`), glued up from the board stock like the legs |
| — | Rail tenons | | t_r / 3 thick, rounded down to 1/16; 1/4 shoulders above and below; s/2 + 1/4 long. The record cabinet's rules of thumb for its aprons' tenons (`rule-of-thumb`) |
| — | Leg tenons | | s / 3 thick, rounded down to 1/16, with 1/4 shoulders, centered. Into the foot h_f/2 + 1/4 deep, the cabinet's rule applied to the foot; through the top. The long side runs along the foot below and along the bench above, so neither mortise crosses the grain of the part it is in (`rule-of-thumb`) |
| h_db | Drawer band height, under the top | 6 to 14 | 10 (`example`, owner's photo) |
| h_u | Upper drawer opening; the lower opening is the rest of the band, h_db − 3·t_c − h_u | 2 to h_db − 3·t_c − 2 | 3-1/4 (`example`, owner's photo) |
| — | The case back's grooves | | 1/4 wide and 3/8 deep, as the record cabinet's door grooves, set 3/8 in from the case's back edge; the back t_c thick with a 1/4 tongue, grain up, 1/32 short at each end and short at each edge by its movement; the middle and lower shelves stop 1/16 in front of it (`rule-of-thumb`, owner, November 4, 2026) |
| t_c | Case panel thickness | 5/8 to 1 | 3/4, as the record cabinet's |
| j | Dado depth | 1/16 to t_c / 2 | 3/16 = t_c / 4, the record cabinet's rule of thumb (#317) |
| s_d | Stopped-dado setback | 1/16 to the case depth | 1/2, as the record cabinet's: how far the drawer shelves' and divider's dadoes stop short of the case's front edge, so none shows from the front. A design choice, not a strength rule |
| d_h | Dog hole diameter | fixed per hardware | 3/4: the common size for dogs and holdfasts ([Lost Art Press](https://blog.lostartpress.com/page/676/?cat=-1); #581) |
| — | Dovetail slope | 1:6 to 1:8 | 1:8 in hardwood, by convention ([Wikipedia](https://en.wikipedia.org/wiki/Dovetail_joint), [Fine Woodworking](https://www.finewoodworking.com/2007/02/06/laying-out-dovetails)); the strength rationale is disputed (#578) |
| — | Slide side clearance and lengths | from the maker | Entered by the owner from the slide's instructions (#579). The worked example uses 1/2 per side, illustrative |
| — | Drawers | | Box parts and bottoms 1/2, planed from the board stock (owner); inset fronts, flush with the case front, 1/16 in from the opening all round, 3/4 asked for (owner), which keeps the board's 13/16 when that is within the flattening allowance (#609); boxes 1/4 clear of their opening above and below; the bottom's groove 1/4 wide, 1/4 deep, 1/4 up from the box's bottom edge, the bottom's top flush with its upper wall; dovetails 1:8 with core's suggested layout (`rule-of-thumb`, owner, November 4, 2026) |
| — | Doors | | Two inset doors, flush with the case front, 1/16 gap all round and between them, hung on the outer case sides; each a frame of stiles and rails 2 wide around a solid 3/4 panel, as thick as a part of one board, with stub tenons and grooves 3/8 deep and 1/4 wide; two cup hinges each, their cups 3 from the door's ends (`rule-of-thumb`, owner, November 4, 2026) |
| — | Vise screws, hinges | from the maker | Entered by the owner (#581, #584). The hinges are concealed cup hinges, inset type (owner); a door thicker than the hinge allows is refused |
| — | Board stock | as the record cabinet's | The record cabinet's board stock and allowances |

## Parts and their joints

Joint-first: each part is declared by where it stands and how it joins its neighbors. Joints the joint model has: trim, bolted lap, housed end, mortise and tenon, tenon in a groove, floating panel, slotted screws. New ones are marked with their issue.

| Part | Qty | Joins |
|---|---|---|
| Top | 1 | Strips glued on edge (#580). Sits on the end rails, held by the legs' tenons through it |
| Foot | 2 | Mortised for the two legs at its end |
| Leg | 4 | Glued up face to face from strips of the board stock, a glue-up like the top's (#580). Tenoned into its foot below, and through the top above; the end rail is tenoned into it |
| End rail | 2 | Between the two legs of an end, under the top; tenoned into both |
| Low rail, front and back | 2 | Between the legs along the bench at h_f; tenoned into both. Carries the case |
| Case side | 2 | Housed in the case bottom's dadoes. Houses the three drawer shelves in stopped dadoes on its inside face (#583) |
| Case bottom | 1 | On the low rails; houses the sides |
| Case back | 1 | A solid panel glued up from the board stock, floating in grooves in the case sides, the case bottom, and the upper drawer shelf, with its movement gap, as the record cabinet's door panels |
| Drawer shelf: upper, middle, lower | 3 | A solid panel t_c thick, grain left to right. Both ends housed in stopped dadoes in the case sides, front corners notched. The upper (under the top) houses the divider's top end in a stopped dado across its underside, the middle (between the rows) its bottom end in one across its top face; the lower is above the doors (#583) |
| Drawer divider | 1 | Between the two upper drawers, the full depth of the case, grain vertical. Both ends housed in the upper and middle drawer shelves, front corners notched. The upper drawers' inner slides screw to its faces (#583) |
| Drawer box sides, front, back | 3 sets | Through dovetails at each corner (#578). The back is cut short so the bottom slides under it |
| Drawer bottom | 3 | Solid, glued up from the board stock, grain side to side, floating in grooves in the front and sides, held by a screw up into the back through a slot (owner, #585) |
| Drawer front | 3 | Screwed to its box, with a pull |
| Door stiles and rails | 2 doors | Stub tenons in grooves, panel floating, as the record cabinet's doors; hung on concealed cup hinges in 35 mm cups bored in the stiles (#584, #581) |
| Face vise chop, end vise chop | 1 each | On the vise screw (#581); the end chop's dog holes in line with the top's |

## Derived geometry

- Overall length with the end vise closed: L + c. Overall depth with the face vise closed: D + c.
- Underside of the top: z_u = H − T.
- Base, outside of the legs: L_b = L − 2·o_e along the bench, D_b = D − i_f − i_b front to back. The front legs' front faces are at y = i_f.
- Each leg stands on its foot (top at z = h_f) and reaches the top's underside: visible length z_u − h_f, with tenons added by the joints.
- Feet: D_b + 2·f_o long, s wide and h_f tall.
- End rails: D_b − 2·s between the legs, with tenons added by the joints.
- Low rails: L_b − 2·s between the legs, from z = h_f to h_f + h_r.
- Case: between the legs, L_b − 2·s wide and D_b deep, from z = h_f + h_r to z_u.
- Drawer band: the top h_db of the case. Inside it, three drawer shelves t_c thick (under the top, between the rows, and above the doors) leave h_db − 3·t_c for the two rows of openings: h_u for the upper and the rest for the lower, 3-1/4 and 4-1/2 in the example (`example`, owner's photo). The upper row's two openings are split by a divider t_c thick.
- Drawer shelves: the inside width of the case + 2·j long, from the case's front edge. The upper runs to the back edge and holds the back's top in a groove in its underside; the middle and lower stop 1/16 in front of the back.
- Case back: floats in grooves in the case bottom, the upper shelf, and both sides, each cut into the part's face from end to end, centered on the back.
- Divider: the upper opening's height + 2·j long (vertical), as deep as the shelves, centered in the case.
- Drawer boxes: each opening's width less the slides' side clearance on each side (#579).
- Drawer bottoms: grain side to side, so the bottom moves front to back, where nothing holds it but the slotted screw. Side to side it is the box's inside width plus the depth of the side grooves, less a fit clearance, since wood barely moves along its grain. Front to back it runs from the bottom of the front's groove to past the back, with the gap at the front groove and the screw's slot each sized from the movement estimate (`movement/`, `DOMAIN.md`, Joints that let wood move). Its edges are rabbeted to a tongue that floats in the grooves, as the record cabinet's door panels. The back is cut short at the top of the grooves, so the bottom slides in under it after the box is glued up.
- Doors: the case's height below the drawer band.

## Worked example (hand-checked)

The owner's sizes, from their photo (`example`): overall 64-3/8 long and 20-1/8 deep with the vises closed, 34-1/8 high. Chops 2-1/2, so L = 64-3/8 − 2-1/2 = **61-7/8** and D = 20-1/8 − 2-1/2 = **17-5/8**. T = 2-1/2, o_e = 5, i_f = 0, i_b = 1, s = 3, h_f = 3, f_o = 1, h_r = 3, h_db = 10, t_c = 3/4.

| Quantity | Working | Value |
|---|---|---|
| Underside of the top | 34-1/8 − 2-1/2 | 31-5/8 |
| Base, outside of the legs | 61-7/8 − 2·5; 17-5/8 − 0 − 1 | 51-7/8 long, 16-5/8 deep |
| Leg, visible | 31-5/8 − 3 | 28-5/8 |
| Foot | 16-5/8 + 2·1 | 18-5/8, 1 past the top's front edge and flush with its back |
| End rail, between the legs | 16-5/8 − 2·3 | 10-5/8 |
| Low rail, between the legs | 51-7/8 − 2·3 | 45-7/8, from z = 3 to 6 |
| Leg, with its tenons | 28-5/8 + 1-3/4 into the foot + 2-1/2 through the top | 32-7/8 |
| End rail, with its tenons | 10-5/8 + 2·1-3/4 | 14-1/8, from z = 28-5/8 to 31-5/8, centered on the legs |
| Low rail, with its tenons | 45-7/8 + 2·1-3/4 | 49-3/8, centered on the legs |
| Rail tenons | 1-1/2 / 3; 3 − 2·1/4 | 1/2 thick, 2-1/2 wide, 1-3/4 long |
| Leg tenons | 3 / 3; 3 − 2·1/4 | 1 thick, 2-1/2 wide |
| The top's mortises | centered on each leg, long along the bench | x 5-1/4 to 7-3/4 and 54-1/8 to 56-5/8; y 1 to 2 and 14-5/8 to 15-5/8; the back two longer toward the back by the top's movement |
| Case | 45-7/8 wide, 16-5/8 deep; 31-5/8 − 6 | 25-5/8 high, from z = 6 |
| Inside the case | 45-7/8 − 2·3/4 | 44-3/8 wide |
| Drawer band | z = 21-5/8 to 31-5/8; 10 − 3·3/4 = 7-3/4 of openings | upper 3-1/4, lower 4-1/2 |
| Upper drawer openings | (44-3/8 − 3/4) / 2 | 21-13/16 each |
| Lower drawer opening | | 44-3/8 |
| Case bottom, between the legs | 51-7/8 − 2·3 | 45-7/8 long, 16-5/8 deep, z = 6 to 6-3/4 |
| Case sides | from the case bottom's dado, 6-3/4 − 3/16, to the top's underside, 31-5/8 | 25-1/16 |
| The back's middle and grooves | 16-5/8 − 3/8 − 1/4 / 2 | y = 16-1/8; grooves y 16 to 16-1/4 |
| Drawer shelves | 44-3/8 + 2·3/16 | 44-3/4 long; the upper 16-5/8 deep, to the back edge; the middle and lower 16-1/8 − 3/8 − 1/16 = 15-11/16 deep. Tops at z = 31-5/8, 27-5/8, and 22-3/8 |
| Divider | 3-1/4 + 2·3/16 | 3-5/8 high, 15-11/16 deep, centered at x = 30-15/16 |
| Case back, with 1/8 at each edge (illustrative) | z 6-3/8 to 31-1/4, less 2·1/32; x 8-3/8 to 53-1/2, less 2·1/8 | 24-13/16 high, 44-7/8 wide |
| Drawer fronts, 13/16 thick | 21-13/16 − 2·1/16 by 3-1/4 − 2·1/16; 44-3/8 − 1/8 by 4-1/2 − 1/8 | 21-11/16 by 3-1/8, and 44-1/4 by 4-3/8 |
| Drawer boxes, 1/2 slide clearance each side (illustrative) | 21-13/16 − 1; 44-3/8 − 1 | 20-13/16 and 43-3/8 wide |
| Box depth, typical slides 10 to 28 by 2 (illustrative) | the back's front face, 15-3/4, less the front's 13/16: 14-15/16, so the longest slide that fits | 14 deep, from y = 13/16 |
| Box heights | 3-1/4 − 2·1/4; 4-1/2 − 2·1/4 | 2-3/4 and 4; the backs 1/2 less, 2-1/4 and 3-1/2 |
| Dovetails | (width − 3/4 + 1/4) / 2" on center | 2 tails at each front corner and the lower back's, 1 at the upper backs' |
| Drawer bottoms, 1/8 short at the front (illustrative) | between the side grooves' bottoms less 2·1/32; from the front groove's bottom to the back's outside face | 20-1/4 by 13-5/8, and 42-13/16 by 13-5/8 |
| Door opening | the case bottom's top, 6-3/4, to the lower shelf's underside, 21-5/8 | 14-7/8 high, 44-3/8 wide inside the case |
| Each door, 13/16 thick | (44-3/8 − 3·1/16) / 2; 14-7/8 − 2·1/16 | 22-3/32 wide, 14-3/4 high |
| Stiles and rails | rails 22-3/32 − 2·2 + 2·3/8 | stiles 14-3/4, rails 18-27/32, all 2 wide |
| Door panel, 1/8 at each edge (illustrative) | 18-27/32 − 2·1/8 across; 14-3/4 − 4 + 3/4 − 2·1/32 up | 18-19/32 by 11-7/16, 3/4 thick |
| Hinge cups and plates (illustrative hinge: 35 mm cup 3/16 from the edge, plate 5/8 behind the door, two screws 1-1/4 apart) | cups 3 from each end of the hinge stile | cups at 3 and 11-3/4; plates at y = 1-7/16 on each case side |

Tenon lengths, dado and groove depths, dovetail layouts, drawer box depths, and door sizes follow from the joints and the open issues, and are added to this example as each lands. An edge-of-range example (the shortest and tallest bench, a 4" top) is added before the build.

### The top's tenons and wood movement

Each leg's tenon passes up through the top and is trimmed flush with its surface. The top moves across its depth with the seasons, and the front and back legs of an end are 16-5/8 apart in the example, so tenons fixed tight at both would fight that movement. As the record cabinet's case bottom is held at its front and slotted behind, the front tenon is fitted tight and glued, and the back mortise is made longer toward the back by the top's movement across the distance between the tenons (`movement/`, `DOMAIN.md`, Joints that let wood move). The movement needs the species and its moisture range, which the owner enters, so the back mortise's length is "input needed" until then. In the joint model this is the mortise and tenon with the mortise lengthened on one side, as the slotted screw is lengthened.

## Hardware, operations, build steps, drawings

- **Hardware:** two vise screws (#581), three pairs of drawer slides (#579), hinges (#584), screws for the drawer fronts, and pulls or finger recesses.
- **Operations:** the record cabinet's panel work, dadoes, stopped dadoes, and notched corners; mortises and tenons as the cabinet's base; four through mortises in the top for the legs, trimmed flush after glue-up; dovetails (#578); bored dog holes (#581); flattening the top (#580); bored hinge cups (#584).
- **Build steps:** glue up and flatten the top, build the end frames, join them with the low rails, build and fit the case, the drawers, and the doors, then mount the vises and bore the dog holes.
- **Drawings:** the record cabinet's elevations and exploded view; cut details of the dovetails, mortises, and tenons.

## Validation and flags

Refused, at least: a base with no room for the case (L_b − 2·s too small for the drawer openings), a drawer band taller than the case, drawer openings narrower than twice the slide clearance, and dog holes deeper than the top is thick. Checked against the owner's slide: the two slides on the divider screw in from opposite faces at the same height, so if their holes line up, screws longer than t_c / 2 meet inside it; the plan refuses that or says to stagger the holes. Flags, at least: **wood movement** for the top held at its front and back legs (below); **router technique** and **table saw operations** for dadoes and dovetails cut by machine; **jointers, planers** for flattening the top; **load-bearing or tip-prone designs** for heavy work on the overhang past the legs.

## Structural model

Chosen by the owner (November 3, 2026): the top's deflection is computed, and the rest is on the checklist. It follows the record cabinet's top check (`docs/templates/record-cabinet.md`, Structural model), with the same sources.

- **The top:** a simply supported span between the end frames' leg centerlines, L = L_b − s, breadth D, depth T, under one point load P at midspan, where it bends the top most. P is what the owner puts on the bench: a machine, or their weight kneeling on it, owner-entered (hard rule 3). The top really runs past the legs and is held by their tenons, which stiffens it, so a simple span overstates the deflection. The dog holes and the mortises at the ends take a little out of the section and are left out, which understates it slightly; the first is the larger.
- **Deflection only,** with E from the Wood Handbook (2021), Table 5-3b, for the species the owner enters, and the long-term deflection 1.5 times the immediate (NDS 2024 3.5.2), as the cabinet's. No bending or shear check: furniture lumber has no design values.
- **Deflection limit:** owner-entered. The cabinet's reference, L/144 for a shelf (Architectural Woodwork Standards, 1st edition, 2009), is shown for comparison only; a bench may want stiffer.
- **Checklist, not computed:** racking under planing (the base's mortises and tenons), tipping when planing at the overhang or with a vise open, the through tenons' glue and the back mortises' room to move, and the glue joints of the top and legs.

### Worked example (hand-checked)

Illustrative inputs, not suggestions: black cherry (E = 1,490,000 psi), P = 300 lb, limit L/144.

| Quantity | Working | Value |
|---|---|---|
| Span | 51-7/8 − 3 | 48.875 |
| I | 17.625 × 2.5³ / 12 | 22.94922 in⁴ |
| Immediate deflection | 300 × 48.875³ / (48 × 1,490,000 × 22.94922) | 0.021340" |
| Long-term | 1.5 × 0.021340 | 0.032009" (span / 1,527) |
| Margin against L/144 | 0.339410 / 0.032009 | 10.6x under these assumptions |

## Starting questions

- The owner's height, suggesting H (#582).
- The space the bench goes in, suggesting L and D.
- The board stock, as the record cabinet asks it.

## Open questions

None. The joint sizes the worked example leaves out (tenons, grooves, dovetail layouts, the bottoms' and back's gaps) come from the joints in the build (#577).

## Decided

- Concealed cup hinges, inset type, for the doors, and solid-wood drawer bottoms floating in grooves (owner, November 3, 2026; #584, #585). The bottoms' grain runs side to side so their movement is front to back and they cannot shrink out of the side grooves; the back is cut short so the bottom slides in after glue-up and is not glued; a nail into the back, as on many antique drawers, is a common cause of split bottoms, so the bottom is held by a screw through a slot. Sources: Garrett Hack, ["How to Build Solid Drawer Bottoms"](https://www.finewoodworking.com/2010/06/03/how-to-build-solid-drawer-bottoms), *Fine Woodworking* #213, 2010 (grain, floating edges, the short back, nailing as a cause of splits; only the free part read); Gerald Curry, ["How To Build Perfect Drawers"](https://www.finewoodworking.com/2014/07/23/how-to-build-perfect-drawers), *Fine Woodworking* #242, 2014 (grain side to side, the bottom rabbeted to fit grooves in the front and sides, the back left short, screws in slotted holes as one common way to hold it; only the free part read).
- The structural review computes the top's deflection, with racking and tipping on the checklist (owner, November 3, 2026).
- The case back is a solid panel floating in grooves (owner, November 3, 2026).
- The legs are tenoned through the top, the traditional heavy bench's joint, so the top is part of the frame and never comes off (owner, November 3, 2026). The back tenons' mortises are lengthened for the top's movement.
- The front legs are flush with the top's front edge, so a board in the face vise rests against the leg (owner, November 3, 2026). The back legs stay set back 1, as sketched, until the owner says otherwise.
- The legs are glued up face to face from strips of the board stock, so one kind of lumber covers the bench (owner, November 3, 2026).
- The top is 2-1/2 thick after flattening (owner, November 3, 2026).
- The owner's example sizes are overall, with both vises closed: 64-3/8 long and 20-1/8 deep, so the top is 61-7/8 by 17-5/8 (owner, November 3, 2026).
- The design and the choices on #576: drawers two over one, through dovetails behind a separate front, hinged doors, glued mortise and tenon, a height suggested from the owner's (owner, November 3, 2026).
- **Solid drawer shelves, not web frames** (#583; owner, November 4, 2026). With side-mount slides the slides carry the drawers, so a web frame's runners would carry nothing; the shelves still tie the case sides, which are housed only in the case bottom, keep them parallel for the slides, and give the divider something to join. The divider runs the full depth so each slide screws to one flat surface; in a web frame its ends would sit in both the front rail and a center runner, which the joint model's housed end does not do. Every panel's cross grain runs front to back, as in the record cabinet, so they move together. The shelves also keep shavings out of the drawers below, at about 2-1/2 times the wood of web frames. Sources: Bill Hylton, *The Drawer Book* (Popular Woodworking Books, 2009), ch. 2, "Supporting a Drawer", pp. 26–37 ([chapter PDF](https://www.popularwoodworking.com/app/uploads/2010/10/Drawer_Book-Runners_Guides_Kickers.pdf)): drawer dividers keep the case sides straight and parallel (p. 28), runners and web frames and their allowance for movement (pp. 30–33), solid panels as drawer pockets (p. 28), the stopped dado with a notched corner (p. 29); Gerald Curry, ["How to engineer a chest of drawers"](https://www.finewoodworking.com/2014/06/04/how-to-engineer-a-chest-of-drawers), *Fine Woodworking* #241, 2014: a solid case's depth changes through the year while runners do not; Ken Burton, ["Drawer Slides: The Inside Story"](https://www.woodcraft.com/blogs/cabinetry-furniture-making/drawer-slides-the-inside-story), Woodcraft, 2014: side-mount slides go between the drawer's and the case's sides.
