# Template: record cabinet

Status: draft for the owner's review (#273). The window measurements are rough (stool about 22" high and 56" wide), so the first worked example is provisional until the owner measures. Nothing here is implemented.

A low cabinet with record bays, for a turntable and a speaker, to stand in front of a window. Following `docs/templates/README.md`: this spec comes before any code, and the template depends on generic work that lands first: edge-glued panels (#278), shelf deflection for furniture species and long-term loads (#288), and the design-system review (#71).

## Design covered by template version 1

- **A case of solid-wood panels,** each edge-glued from boards (#274, #278). Two **sides** and one or more **partitions** stand full height, from the floor to the underside of the top. They divide the case into equal **bays**.
- **Each bay has its own bottom shelf,** housed in dadoes in the panels on either side. Each shelf spans one bay. A single bottom running the full width would rest only on the sides. In the first worked example, a 51" span instead of 17-1/4" would sag about 76 times as much (deflection grows with the fourth power of span; Structural model).
- **The top** is one panel. It overhangs the sides at each end and the case at the front, and it's flush at the back. The sides and partitions are housed in stopped dadoes in its underside.
- **Feet:** below the bottom shelves, each side and partition has a rectangular cutout, leaving a foot at the front and back. The floor shows between the feet.
- **A back rail** under the top at the back of each bay resists racking. The back is otherwise open, for air and cords.
- **Every panel's grain runs the long way:** horizontal in the top and shelves, vertical in the sides and partitions. So every panel moves front to back, together, and no joint fixes one panel across another's grain (`DOMAIN.md`, Wood movement). The back rails are narrow, with their grain across the partitions' grain. Owner's check: confirm that's acceptable once #283 has a source.
- **Open bays,** no doors (owner, October 31, 2026).
- **Turntable and speaker:** the turntable sits on the top. The speaker sits on the top, or on the shelf of a bay the owner picks.

Not covered in version 1: doors, drawers, a back panel, adjustable shelves, separate legs or a stand, arched or shaped cutouts, bays of different widths, a solid top on a frame with fasteners that allow movement (#283).

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
| Panel thickness | t | 5/8–1 | Actual, after flattening. One thickness for every panel in version 1. |
| Dado depth | j | t/8–t/4 | Depth of every dado. Partitions take a shelf dado on both faces at the same height, so up to t/2 of their thickness goes. The limit is unsourced (Open questions). |
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
| Top | 1 | W | D_t | t | Stopped dadoes across the underside, one per side and partition, j deep, t wide, from the back edge to 1/2" short of the case's front edge |
| Side | 2 | H_p | D_c | t | Shelf dado on the inside face, j deep; foot cutout |
| Partition | n − 1 | H_p | D_c | t | Shelf dadoes on both faces, j deep; foot cutout |
| Bottom shelf | n | b + 2·j | D_c | t | Housed in dadoes at both ends |
| Back rail | n | b + 2·j | h_r | t | Housed in dadoes at both ends (rail dadoes in the sides and partitions) |

The stopped dadoes in the top hide the joint at the front. How far short they stop, and the matching notch at each panel's front top corner, need a source (#283).

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
- **Operations:** rip and crosscut boards; joint, glue up, flatten, and cut each panel to size (#278); dado; stopped dado; cut the foot cutouts; ease edges; finish.
- **Build steps:** glue up panels; cut panels to size; cut dadoes; cut feet; dry-fit; glue up the case; fit the top; finish. Each operation's methods come from the knowledge base, for the owner's tools.
- **Drawings:** front and end elevations with bay widths and heights; a section through a bay showing the shelf, dadoes, and back rail; each panel's cut detail with dadoes and cutout; an exploded view. Showing grain direction and movement on drawings is for #71.

## Validation and flags

Refused:
- Bay clear height below the record jacket: h_b < s_r
- Case depth below the record jacket: D_c < s_r
- Speaker in bay k when b < S_w or h_b < S_h
- Speaker on the top when T_w + S_w > W, or turntable depth T_d > D_t
- h_c ≥ h_f, or 2·f_w ≥ D_c
- 2·j > t/2 (both faces of a partition)

Flags (`DOMAIN.md`, Expert-check categories):
- **Router technique** and **table saw operations:** dadoes and stopped dadoes.
- **Jointers, planers:** panel glue-up (#278).
- **Wood movement:** the back rails' cross-grain joint, and the top's dadoes if species or ring orientation differ between the top and the panels.
- **Load-bearing or tip-prone designs:** record shelves, and a heavy turntable or speaker on top.

Checklist, not computed:
- Racking: an open back, with only dadoes and back rails.
- Tipping: whether the loaded cabinet can tip forward. Low and deep, but confirm.
- Joint strength of glued dadoes.

## Worked example (hand-checked, provisional)

From the rough measurements: stool about 22" high, 56" wide. The owner's choices so far: top about 2" below the stool, width to match the window trim. The trim width isn't measured yet, so 54" stands in for it.

Parameters: W = 54, H = 20, D_c = 15, n = 3, t = 3/4, j = 3/16, o_s = 3/4, o_f = 3/4, h_f = 5-1/4, h_c = 4, f_w = 2-1/2, h_r = 3.

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

Cut list: top 54 × 15-3/4; sides (2) and partitions (2) 19-7/16 × 15; bottom shelves (3) 16-7/8 × 15; back rails (3) 16-7/8 × 3. All 3/4 thick.

Checks: a 12-3/8" jacket fits (13.25 high, 15 deep). The Five fits in a bay lying flat (14.33 ≤ 16.5 wide, 7.99 ≤ 13.25 high), or on the top beside a turntable up to 54 − 14.33 = 39.67" wide.

Standing at the window: the top at 20" is 2" below the stool. If the bottom of the apron is below 20", the cabinet stands off the wall by at least the stool's depth. Both are unmeasured.

## Edge of range (hand-checked)

Parameters: W = 30, H = 30, D_c = 13, n = 2, t = 1, j = 1/4, o_s = 1, o_f = 1, h_f = 10, h_c = 8, f_w = 3, h_r = 3. Speaker in bay 1.

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
| 2·j vs t/2 | 0.5 vs 0.5 | at the limit, allowed |

Validation: the speaker in bay 1 is refused, since 12.5 < 14.33. A 12-3/8" jacket fits 13 deep with 5/8" to spare.

## Structural model

Computed (#288; `DOMAIN.md`, Structural checks):

- **Each bottom shelf:** a simply supported span between the centerlines of the panels on either side, L = b + t, breadth D_c, depth t, under a uniform long-term load of records (lb per foot of shelf, owner-entered). Deflection only, with E from Wood Handbook Table 5-3b, total = 1.5 × immediate (NDS 2024 3.5.2). Taking span to centerlines, where the shelf really bears in a dado, overstates the span slightly, which is conservative.
- **The top, under the turntable and speaker:** each span between panels as a simply supported span, L = b + t, breadth D_t, depth t, with each item's weight as a point load at midspan. The top is continuous over the partitions, and treating each span as simply supported overstates deflection. The turntable's weight is owner-entered. The speaker's is 13.89 lb from Sonos [S1], or owner-entered.
- **Deflection limit:** owner-entered.

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
- Wood Handbook (2021) and NDS 2024, as cited in `DOMAIN.md`.

## Open questions

1. **Measurements:** stool height A, stool depth B, apron bottom C, casing width D, stool width E.
2. **Dado depth limit for partitions** taking dadoes on both faces: is t/2 the right limit, and what's its source? (#283 covers joints.)
3. **Stopped dadoes in the top:** how far short of the front, and the matching notch. Needs a source (#283).
4. **Back rails:** enough for racking with an open back, or add a back panel? An experienced builder's check either way.
5. **Speaker on a bottom shelf** sits about 6" off the floor. Is that acceptable for listening, or does the speaker bay need a raised shelf (a version 2 option)?
6. **Equal bays only,** or let the speaker bay be its own width?
