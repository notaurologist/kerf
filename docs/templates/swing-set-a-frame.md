# Template: two-swing A-frame swing set

Status: v1, approved by the owner October 2026

This is the geometry spec for the first template (`PRODUCT.md`, First template). The template code in `packages/core/src/templates/swing-set-a-frame/` implements exactly what is written here, and its tests use the worked example below. Structural checks (M2) and hangers and site layout (a later M1 change) build on it.

## Design covered by template version 1

Matches the owner's earlier build (photos reviewed October 2026).

- A top beam held by two A-frames, one near each end. The beam overhangs the frames. It is one solid member, or two or three 2x plies fastened face to face (decision 0012); the owner's earlier build used two 2x6s.
- **Legs cut flush to the beam.** The two legs of each A-frame rise alongside the beam, one against its front face and one against its back face. The inside of each leg's top is cut with a vertical face so it sits flush against the beam, and each leg's top is cut off level with the top of the beam. One bolt passes through the front leg, the beam, and the back leg.
- **A board under the beam** (a gusset) is fastened across both legs on the outside face of the frame, with its level top edge against the beam's underside. The beam rests on it and is also held by the bolt.
- **One crossbar per A-frame**, horizontal, fastened to the outside face of the legs (the face away from the swings). Its ends are cut at the splay angle, flush with the legs' outer faces.
- **Ground that slopes front to back.** The ground is level along the beam, so the beam is the same height above the ground everywhere. The front legs are downhill. The beam stays level and each A-frame stays plumb, so the front legs are longer.
- **Feet either buried or on pads.** A burial depth of 0 means each foot sits on a level pad or footing with ground anchors. A depth greater than 0 means each leg continues that far below grade. Either way, each foot gets a level cut.

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

The ground is the line z_g(y) = k·y with k = g / 12, the same at every x.

## Derived geometry

Each A-frame is symmetric about y = 0 above the ground, so these formulas are given for the back leg (positive y). The front leg is the mirror image, except at the foot, where its own ground height applies: replace k with −k.

### Leg faces

The leg's inner face, before the flush cut, passes through the beam's lower back corner (bw/2, H), so the flush cut removes nothing at the beam's underside and the most at its top.

- Inner face: y_in(z) = bw/2 + (H − z)·tan α.
- Outer face: y_out(z) = y_in(z) + w / cos α.

### Top of the leg

- **Level cut** at the top of the beam, z = H + bd, across the leg from the flush face to the outer face.
- **Flush cut:** a vertical face at y = bw/2, from the beam's underside (z = H) to the top. On the leg, it starts on the inner face and runs at α to that face for a distance bd·cos α along the leg, ending at the top cut bd·sin α in from the inner face (measured square to the face).
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

Horizontal, on the outside face of the legs, ends flush with the legs' outer faces.

- Top edge: 2·y_out(zc). Bottom edge (overall, stock needed): 2·y_out(zc − cw).

### Gusset

A trapezoid with its top edge against the beam's underside (z = H) and its sides flush with the legs' outer faces.

- Top width: 2·y_out(H). Bottom width: 2·y_out(H − gh). Height: gh.
- One per frame, on the outside face.

### Positions along the beam

- Left frame legs occupy x from e to e + t; right frame legs from L − e − t to L − e.
- The gusset and the crossbar sit on the outside face (x < e on the left frame).
- Frame centerlines (the supports for the structural checks) are at x = e + t/2 and L − e − t/2.

### Swings

- **Hangers:** two per swing, at x_i ± s_h/2. These are the beam's load points for the structural checks.
- **Seat edges:** x_i ± s_w/2.
- **Chain length to set:** H − h_s, from the hanger's pivot to the seat's underside. The hanger hardware's own drop comes out of this; measure it before cutting or adjusting chain.

### Site layout

Plan view, values from the CPSC home handbook (`DOMAIN.md`, Layout and clearances), each shown with its source:

- **Frame footprint at grade:** x from 0 to L (the beam), y from −(front outer at grade) to +(back outer at grade).
- **Clear area:** the footprint plus 72 inches on every side.
- **Swing zones:** for each swing, x across its seat (x_i ± s_w/2), y from −2·H to +2·H.
- The area to keep clear of structures and cover with surfacing is the union of the clear area and the swing zones.

## Validation

Rejected combinations, each with a message saying which values conflict:

- w − bd·sin α ≤ 0 (the flush cut would go through the leg). Less than 1 inch left also gets an **expert check** flag.
- The crossbar overlaps the gusset (zc > H − gh), or its bottom edge is at or below grade at the back (uphill) leg.
- Ground so steep that a leg meets the ground at or above the beam.
- 2·(e + t) ≥ L (the frames don't fit on the beam).
- More than one ply of anything other than 2x stock.
- A seat closer than 8 inches to the other seat or to a frame's inside face (CPSC).
- A seat underside less than 8 inches above the ground (CPSC).
- Hangers of the two swings overlapping, or a hanger outside the span between the frames' inside faces.
- Any length, stock dimension, or angle outside its range in the parameter schema.

## Flags

- The leg-to-beam bolt and the flush cut: **expert check** on bolt size, the wood left at the bolt, and bearing on the tilted outer face.
- Buried legs (d > 0): **expert check** on burial depth, and on lumber rated for ground contact, since decay is fastest at the ground line.
- Pads (d = 0): **expert check** on ground anchors (`DOMAIN.md`, Tipping and anchoring).
- Built-up beam (n > 1): **expert check** on how the plies are fastened together.
- Sloped ground (g ≠ 0): **expert check**, since the CPSC handbook recommends a level site.

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
| Crossbar top edge, bottom edge | 51.714, 55.718 |
| Gusset top, bottom, height | 10.949, 16.227, 7.25 (one per frame) |
| Cut settings | Leg top, leg foot, crossbar ends, and gusset sides 20.0°; flush cut a taper at 20.0° to the face |

With d = 0 (pads), the same inputs give back legs of 105.970 (106") and front legs of 112.814 (112-13/16"). Tests cover both.

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
| Crossbar top edge, bottom edge | 51.214, 55.218 |
| Gusset top, bottom | 10.449, 15.727 |

Tests compare template output with these values to within 0.001 inch and 0.01°.

## Open questions

- The site's measured slope and the burial depth, chosen with an experienced builder.
