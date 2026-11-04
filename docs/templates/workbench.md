# Template: workbench

Status: Draft (November 3, 2026), for the owner's review (#576). Not built. Joint-first: the build (#577) declares each joint below and derives the parts' lengths, end cuts, and features from them (`docs/explorations/joint-model.md`). It is the joint model's test, and it lives on `explore/joint-model` until the owner decides whether to adopt the model.

The design is the sketch the owner agreed on November 3, 2026, from photos of a hardwood bench (recorded on #576). Sizes and proportions taken from those photos are suggestions with the `example` basis. Brand names in the photos are left out (hard rule 11).

## Design covered

- **A top of hardwood strips glued on edge** into one slab, overhanging the base at each end and a little at the front and back. Round dog holes run along the front, and in line with the end vise.
- **Two vises.** A face vise at the front left: a wooden jaw (chop) on a bought screw, clamping against the top's front edge. An end vise at the right end: a chop across the top's end on a bought screw, clamping between dogs in the chop and dogs in the top.
- **A base of four legs on two feet.** The feet run front to back at each end. Each end frame is two legs tenoned into a foot below and an end rail under the top. Long rails at the bottom, front and back, tenon into the legs and carry the case.
- **A case between the legs**, of panels in dadoes like the record cabinet's, with a back:
  - **Drawers** under the top: two side by side over one full width, on bought side-mount slides. Each drawer is a box with through dovetails at all four corners and a separate front screwed on.
  - **Two hinged doors** below the drawers, frame and panel like the record cabinet's doors, closing the space to the low rails.
- **Glued mortise and tenon** throughout the base. The base does not come apart.

Not covered in version 1: a leg vise, a planing stop, a tool tray or till, casters, drawers in the lower case, or a top of laminated 2x stock or sheet goods.

## Coordinates

x along the bench from the top's left end, y from the top's front edge toward the back, z up from the floor. Inches.

## Parameters

Every parameter starts from a suggestion with its basis (owner's standing preference). Structural inputs and hardware sizes are entered or confirmed by the owner (hard rule 3).

| Symbol | Parameter | Range, and why | Suggested, and its basis |
|---|---|---|---|
| H | Height to the top surface | 28 to 42: from a low planing bench to standing assembly | From the owner's height, by a sourced rule (#582). Until then 34-1/8 (`example`, owner's photo) |
| L | Top length | 36 to 96 | 61-7/8: the owner's 64-3/8 overall less the end vise chop (`example`) |
| D | Top depth | 14 to 30 | 17-5/8: the owner's 20-1/8 overall less the face vise chop (`example`; open question 1) |
| T | Top thickness, after flattening | 1-1/2 to 4: holdfasts are commonly made to grip through tops up to about 4" (to source from a woodworking reference, not a maker, before use) | 2-1/2 (`rule-of-thumb`; open question 2) |
| c | Chop thickness, both vises | 1-1/2 to 3 | 2-1/2, matching T (`rule-of-thumb`) |
| o_e | Top overhang past the legs at each end | 2 to 12 | 5 (`example`, owner's photo) |
| i | Top overhang past the legs at the front and back | 0 to 3 | 1 (`example`; open question 4) |
| s | Leg size, square | 2-1/2 to 4 | 3 (`example`; open question 3) |
| h_f | Foot height | 2 to 4 | 3 (`example`) |
| f_o | Foot past the legs, front and back | 0 to 3 | 1 (`example`) |
| h_r | Low rail height | 2 to 5 | 3 (`example`) |
| h_db | Drawer band height, under the top | 6 to 14 | 10 (`example`, owner's photo) |
| t_c | Case panel thickness | 5/8 to 1 | 3/4, as the record cabinet's |
| j | Dado depth | 1/16 to t_c / 2 | 3/16 = t_c / 4, the record cabinet's rule of thumb (#317) |
| d_h | Dog hole diameter | fixed per hardware | 3/4: the common size for dogs and holdfasts ([Lost Art Press](https://blog.lostartpress.com/page/676/?cat=-1); #581) |
| — | Dovetail slope | 1:6 to 1:8 | 1:8 in hardwood, by convention ([Wikipedia](https://en.wikipedia.org/wiki/Dovetail_joint), [Fine Woodworking](https://www.finewoodworking.com/2007/02/06/laying-out-dovetails)); the strength rationale is disputed (#578) |
| — | Slide side clearance and lengths | from the maker | Entered by the owner from the slide's instructions (#579). The worked example uses 1/2 per side, illustrative |
| — | Vise screws, hinges | from the maker | Entered by the owner (#581, #584) |
| — | Board stock | as the record cabinet's | The record cabinet's board stock and allowances |

## Parts and their joints

Joint-first: each part is declared by where it stands and how it joins its neighbors. Joints the joint model has: trim, bolted lap, housed end, mortise and tenon, tenon in a groove, floating panel, slotted screws. New ones are marked with their issue.

| Part | Qty | Joins |
|---|---|---|
| Top | 1 | Strips glued on edge (#580). Sits on the end rails; how it is held down is open question 5 |
| Foot | 2 | Mortised for the two legs at its end |
| Leg | 4 | Tenoned into its foot below and its end rail above |
| End rail | 2 | Between the two legs of an end, under the top; tenoned into both |
| Low rail, front and back | 2 | Between the legs along the bench at h_f; tenoned into both. Carries the case |
| Case side | 2 | Housed in the case bottom's dadoes; the drawer frames housed in it (#583) |
| Case bottom | 1 | On the low rails; houses the sides |
| Case back | 1 | Floating panel in grooves, or in rabbets (open question 6) |
| Drawer divider | 1 | Between the two upper drawers, housed in the drawer frames (#583) |
| Drawer frames | 2 | Above and below the upper drawers (#583) |
| Drawer box sides, front, back | 3 sets | Through dovetails at each corner (#578); bottom in a groove (#585) |
| Drawer front | 3 | Screwed to its box, with a pull |
| Door stiles and rails | 2 doors | Stub tenons in grooves, panel floating, as the record cabinet's doors; hung on hinges (#584) |
| Face vise chop, end vise chop | 1 each | On the vise screw (#581); the end chop's dog holes in line with the top's |

## Derived geometry

- Overall length with the end vise closed: L + c. Overall depth with the face vise closed: D + c.
- Underside of the top: z_u = H − T.
- Base, outside of the legs: L_b = L − 2·o_e along the bench, D_b = D − 2·i front to back.
- Each leg stands on its foot (top at z = h_f) and reaches the top's underside: visible length z_u − h_f, with tenons added by the joints.
- Feet: D_b + 2·f_o long.
- End rails: D_b − 2·s between the legs, with tenons added by the joints.
- Low rails: L_b − 2·s between the legs, from z = h_f to h_f + h_r.
- Case: between the legs, L_b − 2·s wide and D_b deep, from z = h_f + h_r to z_u.
- Drawer band: the top h_db of the case. Inside it, three frames t_c thick (under the top, between the rows, and above the doors) leave h_db − 3·t_c for the two rows of openings, split upper : lower = 3.25 : 4.5 in the example (`example`, owner's photo). The upper row's two openings are split by a divider t_c thick.
- Drawer boxes: each opening's width less the slides' side clearance on each side (#579).
- Doors: the case's height below the drawer band.

## Worked example (hand-checked)

The owner's sizes, from their photo (`example`): overall 64-3/8 long and 20-1/8 deep with the vises closed, 34-1/8 high. Chops 2-1/2, so L = 64-3/8 − 2-1/2 = **61-7/8** and D = 20-1/8 − 2-1/2 = **17-5/8**. T = 2-1/2, o_e = 5, i = 1, s = 3, h_f = 3, f_o = 1, h_r = 3, h_db = 10, t_c = 3/4.

| Quantity | Working | Value |
|---|---|---|
| Underside of the top | 34-1/8 − 2-1/2 | 31-5/8 |
| Base, outside of the legs | 61-7/8 − 2·5; 17-5/8 − 2·1 | 51-7/8 long, 15-5/8 deep |
| Leg, visible | 31-5/8 − 3 | 28-5/8 |
| Foot | 15-5/8 + 2·1 | 17-5/8, the top's depth |
| End rail, between the legs | 15-5/8 − 2·3 | 9-5/8 |
| Low rail, between the legs | 51-7/8 − 2·3 | 45-7/8, from z = 3 to 6 |
| Case | 45-7/8 wide, 15-5/8 deep; 31-5/8 − 6 | 25-5/8 high, from z = 6 |
| Inside the case | 45-7/8 − 2·3/4 | 44-3/8 wide |
| Drawer band | z = 21-5/8 to 31-5/8; 10 − 3·3/4 = 7-3/4 of openings | upper 3-1/4, lower 4-1/2 |
| Upper drawer openings | (44-3/8 − 3/4) / 2 | 21-13/16 each |
| Lower drawer opening | | 44-3/8 |
| Drawer boxes, 1/2 slide clearance each side (illustrative) | 21-13/16 − 1; 44-3/8 − 1 | 20-13/16 and 43-3/8 wide |
| Door space | 21-5/8 − 6 | 15-5/8 high, 44-3/8 wide inside the case |

Tenon lengths, dado and groove depths, dovetail layouts, drawer box depths, and door sizes follow from the joints and the open issues, and are added to this example as each lands. An edge-of-range example (the shortest and tallest bench, a 4" top) is added before the build.

## Hardware, operations, build steps, drawings

- **Hardware:** two vise screws (#581), three pairs of drawer slides (#579), hinges (#584), screws for the drawer fronts, pulls or finger recesses, and whatever holds the top down (open question 5).
- **Operations:** the record cabinet's panel work and dadoes; mortises and tenons as the cabinet's base; dovetails (#578); bored dog holes (#581); flattening the top (#580); hinge mortises or bored hinge cups (#584).
- **Build steps:** glue up and flatten the top, build the end frames, join them with the low rails, build and fit the case, the drawers, and the doors, then mount the vises and bore the dog holes.
- **Drawings:** the record cabinet's elevations and exploded view; cut details of the dovetails, mortises, and tenons.

## Validation and flags

Refused, at least: a base with no room for the case (L_b − 2·s too small for the drawer openings), a drawer band taller than the case, drawer openings narrower than twice the slide clearance, and dog holes deeper than the top is thick. Flags, at least: **router technique** and **table saw operations** for dadoes and dovetails cut by machine; **jointers, planers** for flattening the top; **load-bearing or tip-prone designs** for heavy work on the overhang past the legs.

## Structural model

Open (question 7). A bench is not a span carrying people, as the swing set is. Candidates: the top's deflection between the end frames under a load the owner enters (a heavy machine, or someone kneeling on it), and racking under planing on the checklist, as the record cabinet's racking is. No load is defaulted (hard rule 3).

## Starting questions

- The owner's height, suggesting H (#582).
- The space the bench goes in, suggesting L and D.
- The board stock, as the record cabinet asks it.

## Open questions

1. **Do the owner's example sizes include the vise jaws?** The draft assumes 64-3/8 and 20-1/8 are overall with both vises closed, giving a 61-7/8 by 17-5/8 top. If they are the top alone, the top is 64-3/8 by 20-1/8.
2. **Top thickness.** 2-1/2 is a common slab thickness; thicker is heavier and stiffer, and a holdfast grips up to about 4.
3. **Leg stock.** Solid 3x3 hardwood is hard to buy; legs are often glued up from two or more boards. That is a glue-up like the top's, face to face.
4. **The front legs' place.** Flush with the top's front edge, as many benches have so work in the face vise rests against the leg, or set back 1 as drawn.
5. **How the top is held down.** Bolts or screws through the end rails, dowels, or the legs tenoned into the top.
6. **The case back.** A panel floating in grooves, or in rabbets and screwed.
7. **What the structural review checks** (above).
8. **Drawer and door details** wait on #579, #583, #584, and #585.

## Decided

- The design and the choices on #576: drawers two over one, through dovetails behind a separate front, hinged doors, glued mortise and tenon, a height suggested from the owner's (owner, November 3, 2026).
