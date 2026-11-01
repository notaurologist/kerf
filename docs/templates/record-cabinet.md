# Template: record cabinet

Status: template version 1 is built (#301), in `packages/core/src/templates/record-cabinet/`. The worked example uses the owner's rough window measurements (stool about 22" high and 56" wide). That's enough for the spec, since every size is a parameter: the owner enters exact measurements in the app when planning the build. Not built yet: assembling the case and finishing in the build steps (#313), and the starting questions (#314).

A low cabinet with record bays, for a turntable and a speaker, to stand in front of a window. Following `docs/templates/README.md`: this spec comes before any code, and the template depends on generic work that lands first. Edge-glued panels (#278, #297), wood movement (#284), and shelf deflection for furniture species and long-term loads (#288) have landed. The design-system review (#71) is still to come.

## Design covered by template version 1

- **A case of solid-wood panels,** each edge-glued from boards (#274, #278). Two **sides** and one or more **partitions** stand full height, from the floor to the underside of the top. They divide the case into equal **bays**.
- **Each bay has its own bottom shelf,** housed in dadoes in the panels on either side. Each shelf spans one bay. A single bottom running the full width would rest only on the sides. In the first worked example, a 51" span instead of 17-1/4" would sag about 76 times as much (deflection grows with the fourth power of span; Structural model).
- **The top** is one panel. It overhangs the sides at each end and the case at the front, and it's flush at the back. The sides and partitions are housed in stopped dadoes in its underside.
- **Feet:** below the bottom shelves, each side and partition has a rectangular cutout, leaving a foot at the front and back. The floor shows between the feet.
- **A back rail** under the top at the back of each bay resists racking. The back is otherwise open, for air and cords.
- **Every panel's grain runs the long way:** horizontal in the top and shelves, vertical in the sides and partitions. So every panel moves front to back, together, and no joint fixes one panel across another's grain (`DOMAIN.md`, Wood movement). The back rails are glued into dadoes with their grain across the panels' grain, an interlocking end-to-edge-grain joint. The plan reports each rail's movement (#284) and flags it (owner, #283). Gluing one species, with compatible grain directions, at the moisture content expected in service is what the Wood Handbook recommends to keep these stresses down (Ch. 10, p. 10-7; Ch. 10, p. 10-17).
- **Open bays,** no doors (owner, October 31, 2026).
- **Turntable and speaker:** the turntable sits on the top. The speaker sits on the top, or on the shelf of a bay the owner picks. The owner's plan puts it on the top, so every bay holds records (October 31, 2026).

Not covered in version 1: doors, drawers, a back panel, adjustable shelves, a raised shelf for the speaker inside a bay, separate legs or a stand, arched or shaped cutouts, bays of different widths, a solid top on a frame with fasteners that allow movement (#292).

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
| Panel thickness | t | 5/8–1 | Actual, after flattening. One thickness for every panel in version 1. Hardwood 4/4 is 13/16" surfaced two sides (Wood Handbook, Table 6-4, p. 6-6), so 3/4" comes from 4/4 flattened after glue-up. Boards bought already surfaced to 3/4" end up a little thinner once the glued-up panel is flattened, so t is what's left after flattening, and the board stock must be at least t thick (`lumber/panel.ts` refuses a thinner board). |
| Dado depth | j | owner-entered, 0 < 2·j < t | Depth of every dado. Partitions take a shelf dado on both faces at the same height, leaving t − 2·j between them. No source sets a limit, so the plan shows that thickness and flags the joint for an experienced builder (owner, #283). |
| Stopped-dado setback | s_d | owner-entered, 0 < s_d < D_c | How far the top's dadoes stop short of the case's front edge, so the joint doesn't show from the front. A design choice, not a strength rule (owner, #283). |
| End overhang | o_s | 0–2 | Top beyond each side. |
| Front overhang | o_f | 0–2 | Top beyond the case's front. |
| Shelf height | h_f | 3–10 | Floor to the underside of the bottom shelves. |
| Cutout height | h_c | 0 to h_f − 1 | Height of the cutout between the feet. 0 means no cutout. |
| Foot width | f_w | 2 to D_c / 3 | Front-to-back width of each foot. |
| Back rail height | h_r | 2–4 | Vertical width of each back rail. |
| Record jacket | s_r | owner-entered | Measured from one of the owner's LPs (commonly 12-3/8" square; confirm by measuring). |
| Turntable footprint | T_w × T_d | owner-entered | Width and depth of the turntable's base. Not bought yet, so a range to fit. |
| Turntable lid height | T_h | owner-entered | Height with the lid fully open, for clearance below the window. |
| Speaker | S_w × S_h × S_d, place | owner-entered | Sonos lists the Five at 14.33" W × 7.99" H × 6.06" D, 13.89 lb. [S1] It plays stereo lying flat and mono standing upright. [S1] Place: on the top, or on bay k's shelf. |
| Board stock | | owner-entered | Name, actual thickness and width, and the lengths the store sells, for the boards the panels are glued from (owner, #278). Dealer hardwood sold by the board foot is #296. |
| Panel allowances | | owner-entered | Jointing per glued edge, rip, and trim per end (`DOMAIN.md`, Edge-glued panels). No source gives them (owner, #278). |
| Species and grain | | owner-entered | Species for every panel, and ring orientation (flatsawn, quartersawn, unknown) for movement (#284). |

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
- Back rail: from z = H − t − h_r to z = H − t, at the back, y = D_c − t to D_c.

### Part sizes

| Part | Qty | Length | Width | Thickness | Joints |
|---|---|---|---|---|---|
| Top | 1 | W | D_t | t | Stopped dadoes across the underside, one per side and partition, j deep, t wide, from the back edge to s_d short of the case's front edge |
| Left side, right side | 1 each | H_p | D_c | t | Shelf dado on the inside face, j deep; foot cutout. Mirror images, so two parts with their own letters (`docs/design/README.md`, Stage 11) |
| Partition | n − 1 | H_p | D_c | t | Shelf dadoes on both faces, j deep; foot cutout |
| Bottom shelf | n | b + 2·j | D_c | t | Housed in dadoes at both ends |
| Back rail | n | b + 2·j | h_r | t | Housed in dadoes at both ends (rail dadoes in the sides and partitions) |

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

- **Hardware:** glue, and finish. No metal fasteners in version 1.
- **Operations:** generic code makes each panel's work from its stock (#297): cut its boards to length, joint the glued edges, glue up, flatten, rip to width, and crosscut its ends. A back rail narrower than a board is one board, cut to length and ripped. The template adds the dadoes, stopped dadoes, foot cutouts, easing edges, and finish, each of which needs an operation type and methods first.
- **Build steps:** glue up panels; cut panels to size; cut dadoes; cut feet; dry-fit; glue up the case; fit the top; finish. Each operation's methods come from the knowledge base, for the owner's tools.
- **Drawings:** front and end elevations with bay widths and heights; a section through a bay showing the shelf, dadoes, and back rail; each panel's cut detail with dadoes and cutout; an exploded view. Showing grain direction and movement on drawings is for #71.

## Validation and flags

Refused:
- Bay clear height below the record jacket: h_b < s_r
- Case depth below the record jacket: D_c < s_r
- Speaker in bay k when b < S_w or h_b < S_h
- Speaker on the top when T_w + S_w > W, or turntable depth T_d > D_t
- h_c ≥ h_f, or 2·f_w ≥ D_c
- 2·j ≥ t (no wood left between a partition's dadoes), or s_d ≥ D_c

Flags (`DOMAIN.md`, Expert-check categories):
- **Router technique** and **table saw operations:** dadoes and stopped dadoes.
- **Jointers, planers** and **table saw operations:** raised by the panel methods that use those machines (#297).
- **Wood movement:** the back rails' cross-grain joint, with each rail's movement across its height (#284), and the top's dadoes if species or ring orientation differ between the top and the panels.
- **Load-bearing or tip-prone designs:** the wood left between a partition's back-to-back dadoes, t − 2·j.
- **Load-bearing or tip-prone designs:** record shelves, and a heavy turntable or speaker on top.

Checklist, not computed:
- Racking: an open back, with only dadoes and back rails.
- Tipping: whether the loaded cabinet can tip forward. Low and deep, but confirm.
- Joint strength of glued dadoes.

## Worked example (hand-checked)

From the rough measurements: stool about 22" high, 56" wide. The owner's choices so far: top about 2" below the stool, width to match the window trim. The trim width isn't measured, so 54" stands in for it. The owner's exact measurements go in the app, not here.

Parameters: W = 54, H = 20, D_c = 15, n = 3, t = 3/4, j = 3/16, s_d = 1/2, o_s = 3/4, o_f = 3/4, h_f = 5-1/4, h_c = 4, f_w = 2-1/2, h_r = 3. The template's worked example adds a turntable 16-1/2 wide, 13-1/2 deep, and 15 high with its lid open, and 20 lb, all illustrative since it isn't bought yet, and the Five on the top. Its structural inputs are cherry, flatsawn, 6% to 10% moisture content (the Wood Handbook's range for individual pieces indoors, Table 13-2), 40 lb per foot of records, the Five's 13.89 lb [S1], and L/144.

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

Cut list: top 54 × 15-3/4; left side, right side, and partitions (2) 19-7/16 × 15; bottom shelves (3) 16-7/8 × 15; back rails (3) 16-7/8 × 3. All 3/4 thick.

Panels, with example board stock and allowances (the owner enters both; these are for checking the arithmetic only): boards 3/4 × 5-1/2, jointing 1/16 per glued edge, rip 1/2, trim 1 per end. Boards per panel n = ⌈(width + 1/2 − 1/8) / (5-1/2 − 1/8)⌉ = ⌈(width + 0.375) / 5.375⌉; glued width n·5.5 − 0.125·(n − 1); board length = part length + 2.

| Part | Width | n | Glued width | Board length | Boards |
|---|---|---|---|---|---|
| Top | 15.75 | ⌈16.125 / 5.375⌉ = 3, exactly | 16.25 | 56 | 3 |
| Each side and partition | 15 | ⌈15.375 / 5.375⌉ = ⌈2.86⌉ = 3 | 16.25 | 21.4375 (21-7/16) | 4 × 3 = 12 |
| Bottom shelf | 15 | 3 | 16.25 | 18.875 (18-7/8) | 3 × 3 = 9 |
| Back rail | 3 | ⌈3.375 / 5.375⌉ = 1 | 5.5 | 18.875 (18-7/8) | 3 |

The top is an exact fit: 3 boards glue to 16.25, which is its 15.75 plus the 1/2 rip allowance, so the template's tests cover the whole-number case.

Checks: a 12-3/8" jacket fits (13.25 high, 15 deep). The Five fits in a bay lying flat (14.33 ≤ 16.5 wide, 7.99 ≤ 13.25 high), or on the top beside a turntable up to 54 − 14.33 = 39.67" wide.

Standing at the window: the top at 20" is 2" below the stool. If the bottom of the apron is below 20", the cabinet stands off the wall by at least the stool's depth. Both are unmeasured.

## Edge of range (hand-checked)

Parameters: W = 30, H = 30, D_c = 13, n = 2, t = 1, j = 1/4, s_d = 1/2, o_s = 1, o_f = 1, h_f = 10, h_c = 8, f_w = 3, h_r = 3. Speaker in bay 1.

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

Validation: the speaker in bay 1 is refused, since 12.5 < 14.33. A 12-3/8" jacket fits 13 deep with 5/8" to spare.

## Structural model

Computed (#288; `DOMAIN.md`, Structural checks):

- **Each bottom shelf:** a simply supported span between the centerlines of the panels on either side, L = b + t, breadth D_c, depth t, under a uniform long-term load of records (lb per foot of shelf, owner-entered). Deflection only, with E from Wood Handbook Table 5-3b, total = 1.5 × immediate (NDS 2024 3.5.2). Taking span to centerlines, where the shelf really bears in a dado, overstates the span slightly, which is conservative.
- **The top, under the turntable and speaker:** each span between panels as a simply supported span, L = b + t, breadth D_t, depth t, with each item's weight as a point load at midspan. The top is continuous over the partitions, and treating each span as simply supported overstates deflection. The turntable's weight is owner-entered. The speaker's is 13.89 lb from Sonos [S1], or owner-entered.
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

At these bay widths, shelf sag is small. The check still runs, because a wider bay or a heavier load changes that quickly.

## Starting questions

Answers suggest parameters (M8), each labeled as the owner's choice:

- **Stool height A:** suggests H = A − 2 (owner's choice: top a couple of inches below the stool).
- **Casing width D:** suggests W = D (owner's choice: match the trim). The stool width E is shown for reference.
- **Stool depth B and apron bottom C:** no parameter. If H > C, the plan notes that the cabinet stands at least B from the wall.
- **Turntable and speaker:** their sizes and where the speaker goes.

## Sources

- [S1] Sonos, Five product page, specifications, read October 31, 2026: https://www.sonos.com/en-us/shop/five
- Wood Handbook (2021), chapter 6, Commercial Lumber, Table 6-4, p. 6-6: https://research.fs.usda.gov/treesearch/62245
- AWI, AWMAC, and WI, Architectural Woodwork Standards, 1st edition (2009), Section 10, Casework: https://woodworkinstitute.com/wp-content/uploads/2014/09/WI_AWS_sec10NM.pdf
- Wood Handbook (2021) and NDS 2024, as cited in `DOMAIN.md`. Chapter 10 (Wood Adhesives): Moisture Content and Dimensional Changes, p. 10-7; End-to-Edge-Grain Joints, p. 10-17: https://research.fs.usda.gov/treesearch/62250

## Open questions

1. **Measurements:** decided, not needed for the spec (owner, November 1, 2026). The worked example uses the rough ones. The owner enters exact measurements in the app (stool height A, stool depth B, apron bottom C, casing width D, stool width E) when planning the build.
2. **Dado depth:** decided, owner-entered with no limit, since no source gives one. The plan shows what's left of each partition and flags it (owner, #283).
3. **Stopped dadoes:** decided, the setback s_d is owner-entered as a design choice (owner, #283).
4. **Back:** decided, back rails with an open back (owner, October 31, 2026). Racking stays on the checklist for an experienced builder. If more is needed, the next step is a second rail at the bottom back of each bay, before a full back panel.
5. **Speaker placement:** decided for the owner's plan, on the top beside the turntable, so all three bays hold records (October 31, 2026). Its top stands about 6" above the window stool. The template still offers a bay's bottom shelf.
6. **Bays:** decided, equal bays, three in the owner's plan (October 31, 2026). Two or four cost or gain only 3/4" of record width per partition. Three keeps shelf sag negligible and gives an even front under the window.
7. **Panel stock:** decided on #278. The owner enters board stock and allowances, with no defaults. Panels from dealer hardwood wait on #296.
